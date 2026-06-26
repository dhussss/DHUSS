"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Clipboard, Download, Printer } from "lucide-react";

export function InvoiceExportActions({
  invoiceText,
  pdfHref,
  pdfFileName
}: {
  invoiceText: string;
  pdfHref: string;
  pdfFileName: string;
}) {
  const [message, setMessage] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copied.`);
    } catch {
      setMessage("Copy failed. Select and copy the invoice text manually.");
    }
  }

  async function downloadPdf() {
    setMessage("");
    setIsDownloading(true);

    try {
      const response = await fetch(pdfHref, {
        credentials: "same-origin",
        headers: { Accept: "application/pdf" }
      });

      if (!response.ok) {
        throw new Error("PDF download failed.");
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/pdf")) {
        throw new Error("PDF response was not a PDF.");
      }

      const blob = await response.blob();
      if (!blob.size) {
        throw new Error("PDF download was empty.");
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = pdfFileName;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage("PDF downloaded.");
    } catch {
      setMessage("PDF download failed. Try Print Preview as a fallback.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="grid gap-2">
      {message ? <p className="rounded-lg border border-mint/30 bg-mint/10 p-2 text-xs font-bold text-moss">{message}</p> : null}
      <button className="tap-primary w-full" type="button" onClick={downloadPdf} disabled={isDownloading}>
        <Download size={20} aria-hidden="true" />
        {isDownloading ? "Creating PDF..." : "Create PDF"}
      </button>
      <button className="tap-secondary w-full" type="button" onClick={() => window.print()}>
        <Printer size={20} aria-hidden="true" />
        Print Preview
      </button>
      <button className="tap-secondary w-full" type="button" onClick={() => copy("Invoice text", invoiceText)}>
        <Clipboard size={20} aria-hidden="true" />
        Copy Invoice Text
      </button>
    </div>
  );
}

export function CopyTextButton({
  value,
  label,
  copiedLabel,
  className = "tap-secondary w-full",
  children
}: {
  value: string;
  label: string;
  copiedLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  const [message, setMessage] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(copiedLabel ?? `${label} copied.`);
    } catch {
      setMessage("Copy failed.");
    }
  }

  return (
    <span className="grid gap-1">
      <button className={className} type="button" onClick={copy}>
        {children}
      </button>
      {message ? <span className="text-xs font-bold text-moss">{message}</span> : null}
    </span>
  );
}
