import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { invoiceBusinessDetails, invoiceClientDetails, invoicePdfFileName } from "@/lib/invoice-data";
import { buildPreparedInvoiceEmailBody, invoiceDueDate, renderTemplate } from "@/lib/invoice-documents";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

type DeliveryData = Awaited<ReturnType<typeof loadInvoiceDeliveryData>>;

export async function loadInvoiceDeliveryData(ownerId: string, invoiceId: string) {
  const [invoice, profile] = await Promise.all([
    prisma.invoice.findFirst({
      where: { id: invoiceId, ownerId },
      include: {
        project: { select: { title: true } },
        client: true,
        lineItems: { orderBy: { sortOrder: "asc" } }
      }
    }),
    prisma.businessProfile.findUnique({ where: { ownerId } })
  ]);

  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status === "VOID") throw new Error("Void invoices cannot be sent.");

  const business = invoiceBusinessDetails(invoice, profile);
  const client = invoiceClientDetails(invoice);
  const publicInvoicePath = invoice.publicToken ? `/public/invoices/${invoice.publicToken}` : null;
  const publicInvoiceUrl = invoice.publicTokenEnabled && publicInvoicePath ? absoluteAppUrl(publicInvoicePath) : null;

  return { invoice, profile, business, client, publicInvoiceUrl };
}

export async function sendInvoiceEmailWithPdf(ownerId: string, invoiceId: string) {
  return sendPreparedInvoiceEmailWithPdf(ownerId, invoiceId, {});
}

export async function sendPreparedInvoiceEmailWithPdf(
  ownerId: string,
  invoiceId: string,
  options: { to?: string; subject?: string; body?: string }
) {
  const data = await loadInvoiceDeliveryData(ownerId, invoiceId);
  const to = options.to?.trim() || data.client.email;
  if (!to) throw new Error("Add an email address to this client before emailing the invoice.");

  const preview = buildInvoiceEmailMessage(data);
  const subject = options.subject?.trim() || preview.subject;
  const body = options.body?.trim() || preview.body;
  const confirmationCopyEmail = invoiceEmailConfirmationCopyAddress(data.business.email);
  const pdf = await renderDeliveryPdf(data);
  const filename = invoicePdfFileName(data.invoice.invoiceNumber);
  await sendSmtpMail({
    to,
    bcc: shouldSendConfirmationCopy(to, confirmationCopyEmail) ? confirmationCopyEmail : null,
    replyTo: data.business.email,
    fromName: data.business.name,
    subject,
    text: body,
    attachment: { filename, content: pdf }
  });

  await prisma.invoice.update({
    where: { id: data.invoice.id },
    data: {
      lastEmailedAt: new Date(),
      emailSendCount: { increment: 1 }
    }
  });

  return {
    ok: true,
    message: confirmationCopyEmail
      ? `Invoice email sent to ${to} with the PDF attached. A confirmation copy was sent to ${confirmationCopyEmail}.`
      : `Invoice email sent to ${to} with the PDF attached.`
  };
}

export async function sendInvoiceMmsWithPdf(ownerId: string, invoiceId: string) {
  const data = await loadInvoiceDeliveryData(ownerId, invoiceId);
  if (!data.client.phone) throw new Error("Add a phone number to this client before texting the invoice.");

  const token = await ensurePublicInvoiceToken(data.invoice.id, data.invoice.publicToken);
  const mediaUrl = requiredAbsoluteAppUrl(`/public/invoices/${token}/pdf`);
  const body = buildSmsMessage(data, mediaUrl);
  const to = normalisePhoneForMessaging(data.client.phone);
  await sendTwilioMms({ to, body, mediaUrl });

  return { ok: true, message: `Invoice SMS/MMS sent to ${data.client.phone} with the PDF attached.` };
}

export async function renderPublicInvoicePdf(token: string) {
  const invoice = await prisma.invoice.findFirst({
    where: {
      publicToken: token,
      publicTokenEnabled: true,
      status: { not: "VOID" }
    },
    include: {
      project: { select: { title: true } },
      client: true,
      lineItems: { orderBy: { sortOrder: "asc" } }
    }
  });

  if (!invoice) return null;

  const profile = invoice.ownerId ? await prisma.businessProfile.findUnique({ where: { ownerId: invoice.ownerId } }) : null;
  const business = invoiceBusinessDetails(invoice, profile);
  const client = invoiceClientDetails(invoice);
  const logo = await loadLogoBuffer(business.logoPath);
  const pdf = await renderInvoicePdf({ invoice, business, client, logo });

  return {
    pdf,
    filename: mmsSafePdfFileName(invoice.invoiceNumber)
  };
}

export async function publicInvoicePdfHeaders(token: string) {
  const invoice = await prisma.invoice.findFirst({
    where: {
      publicToken: token,
      publicTokenEnabled: true,
      status: { not: "VOID" }
    },
    select: { invoiceNumber: true }
  });

  if (!invoice) return null;
  return pdfHeaders(mmsSafePdfFileName(invoice.invoiceNumber));
}

export function buildInvoiceEmailMessage(data: DeliveryData) {
  const { invoice, profile, business, client, publicInvoiceUrl } = data;
  const dueDate = invoiceDueDate(invoice);
  const templateValues = {
    invoiceNumber: invoice.invoiceNumber,
    businessName: business.name,
    clientName: client.contactName || client.businessName,
    clientBusinessName: client.businessName,
    projectTitle: invoice.project.title,
    projectName: invoice.project.title,
    total: formatMoney(invoice.grandTotalCents),
    totalDue: formatMoney(invoice.grandTotalCents),
    amountDue: formatMoney(invoice.grandTotalCents),
    dueDate: formatEmailDate(dueDate),
    senderName: business.contactName || business.name
  };
  const subjectTemplate = profile?.defaultInvoiceEmailSubjectTemplate || "Invoice {{invoiceNumber}} from {{businessName}}";

  return {
    subject: renderTemplate(subjectTemplate, templateValues),
    body: buildPreparedInvoiceEmailBody({
      invoice,
      business,
      client,
      publicUrl: publicInvoiceUrl,
      greeting: profile?.defaultEmailGreeting,
      intro: profile?.defaultEmailIntro,
      paymentLine: profile?.defaultEmailPaymentLine,
      signOff: profile?.defaultEmailSignOff,
      includePaymentDetails: profile?.includePaymentDetailsInEmail ?? false,
      includeInvoiceSummary: profile?.includeInvoiceSummaryInEmail ?? false,
      includePublicInvoiceLink: profile?.includePublicInvoiceLinkInEmail ?? true
    })
  };
}

export function invoiceEmailConfirmationCopyAddress(businessEmail: string | null) {
  return businessEmail || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || null;
}

function buildSmsMessage(data: DeliveryData, mediaUrl: string) {
  const dueDate = invoiceDueDate(data.invoice);
  return [
    `${data.business.name}: Invoice ${data.invoice.invoiceNumber} for ${data.invoice.project.title}.`,
    `Amount due: ${formatMoney(data.invoice.grandTotalCents)}. Due date: ${formatEmailDate(dueDate)}.`,
    `PDF: ${mediaUrl}`
  ].join(" ");
}

async function renderDeliveryPdf(data: DeliveryData) {
  const logo = await loadLogoBuffer(data.business.logoPath);
  return renderInvoicePdf({ invoice: data.invoice, business: data.business, client: data.client, logo });
}

async function sendSmtpMail({
  to,
  bcc,
  replyTo,
  fromName,
  subject,
  text,
  attachment
}: {
  to: string;
  bcc: string | null;
  replyTo: string | null;
  fromName: string;
  subject: string;
  text: string;
  attachment: { filename: string; content: Buffer };
}) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const fromEmail = process.env.SMTP_FROM_EMAIL || user;
  const port = Number(process.env.SMTP_PORT || 587);

  if (!host || !user || !pass || !fromEmail) {
    throw new Error("SMTP delivery is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM_EMAIL.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: { user, pass }
  });

  await transporter.sendMail({
    from: formatEmailAddress(process.env.SMTP_FROM_NAME || fromName, fromEmail),
    to,
    bcc: bcc || undefined,
    replyTo: replyTo || undefined,
    subject,
    text,
    attachments: [
      {
        filename: attachment.filename,
        content: attachment.content,
        contentType: "application/pdf"
      }
    ]
  });
}

function shouldSendConfirmationCopy(to: string, confirmationCopyEmail: string | null) {
  if (!confirmationCopyEmail) return false;
  const recipients = to
    .split(/[;,]/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return !recipients.includes(confirmationCopyEmail.toLowerCase());
}

async function sendTwilioMms({ to, body, mediaUrl }: { to: string; body: string; mediaUrl: string }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (!accountSid || !authToken || (!from && !messagingServiceSid)) {
    throw new Error("Twilio MMS is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and either TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID.");
  }

  const payload = new URLSearchParams({
    To: to,
    Body: body,
    MediaUrl: mediaUrl
  });
  if (messagingServiceSid) payload.set("MessagingServiceSid", messagingServiceSid);
  else if (from) payload.set("From", from);

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: payload
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Twilio could not send the invoice MMS. ${detail.slice(0, 240)}`);
  }
}

async function ensurePublicInvoiceToken(invoiceId: string, existingToken: string | null) {
  const token = existingToken ?? (await generateUniqueInvoiceToken());
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      publicToken: token,
      publicTokenEnabled: true
    }
  });
  return token;
}

async function generateUniqueInvoiceToken() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = crypto.randomBytes(32).toString("base64url");
    const existing = await prisma.invoice.findUnique({ where: { publicToken: token }, select: { id: true } });
    if (!existing) return token;
  }

  throw new Error("Could not generate a public invoice link. Please try again.");
}

export function pdfHeaders(filename: string) {
  return {
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="${filename}"`,
    "Cache-Control": "no-store"
  };
}

async function loadLogoBuffer(logoPath: string | null) {
  if (!logoPath) return null;

  try {
    const supabase = await createClient();
    const { data } = await supabase.storage.from("business-logos").createSignedUrl(logoPath, 60 * 5);
    if (!data?.signedUrl) return null;

    const response = await fetch(data.signedUrl);
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || (!contentType.includes("png") && !contentType.includes("jpeg") && !contentType.includes("jpg"))) {
      return null;
    }

    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

function absoluteAppUrl(path: string) {
  const baseUrl = process.env.APP_BASE_URL?.replace(/\/$/, "") || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/\/$/, "")}` : "");
  return baseUrl ? `${baseUrl}${path}` : path;
}

function requiredAbsoluteAppUrl(path: string) {
  const url = absoluteAppUrl(path);
  if (!url.startsWith("https://")) {
    throw new Error("Set APP_BASE_URL to your public https production URL before sending invoice PDFs by SMS/MMS.");
  }
  return url;
}

function normalisePhoneForMessaging(phone: string) {
  const trimmed = phone.replace(/[\s()-]/g, "");
  if (trimmed.startsWith("+")) return trimmed;
  if (trimmed.startsWith("0")) return `+61${trimmed.slice(1)}`;
  return trimmed;
}

function formatEmailDate(date: Date | string | number) {
  const value = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(value);
}

function formatEmailAddress(name: string, email: string) {
  const cleanName = name.replace(/"/g, "");
  return `"${cleanName}" <${email}>`;
}

function mmsSafePdfFileName(invoiceNumber: string) {
  const clean = invoiceNumber.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "invoice";
  return `${clean.slice(0, 15)}.pdf`;
}
