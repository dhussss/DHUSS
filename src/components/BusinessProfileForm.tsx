"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Building2, CheckCircle2, Save, Trash2, Upload } from "lucide-react";
import { updateBusinessProfileAction } from "@/app/actions";
import { createClient } from "@/lib/supabase/browser";

type BusinessProfileFormValue = {
  tradingName: string;
  invoicePrefix: string;
  legalName: string;
  abn: string;
  acn: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  defaultHourlyRate: string;
  gstRegistered: boolean;
  gstRate: string;
  bankAccountName: string;
  bsb: string;
  accountNumber: string;
  paymentTermsDays: number;
  defaultInvoiceNotes: string;
  defaultInvoiceEmailMessage: string;
  signatureFooter: string;
};

export function BusinessProfileForm({
  profile,
  logoUrl,
  saved
}: {
  profile: BusinessProfileFormValue;
  logoUrl: string | null;
  saved: boolean;
}) {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(logoUrl);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [gstRegistered, setGstRegistered] = useState(profile.gstRegistered);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState(saved);
  const [pending, setPending] = useState(false);

  const logoPreview = useMemo(() => (removeLogo ? null : preview), [preview, removeLogo]);

  async function handleSubmit(formData: FormData) {
    setError("");
    setSavedMessage(false);
    setPending(true);

    try {
      const validationError = validateBusinessProfile(formData, gstRegistered, logoFile);
      if (validationError) {
        setError(validationError);
        return;
      }

      formData.set("gstRegistered", gstRegistered ? "on" : "");
      formData.delete("logo");

      if (logoFile && !removeLogo) {
        const supabase = createClient();
        const {
          data: { user },
          error: userError
        } = await supabase.auth.getUser();

        if (userError || !user) {
          setError("Please log in again before uploading a logo.");
          return;
        }

        const extension = extensionForLogo(logoFile);
        const logoPath = `${user.id}/logo-${Date.now()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("business-logos").upload(logoPath, logoFile, {
          cacheControl: "3600",
          contentType: logoFile.type || contentTypeForExtension(extension),
          upsert: false
        });

        if (uploadError) {
          setError(uploadError.message || "Logo upload failed. Your profile has not been changed.");
          return;
        }

        formData.set("logoPath", logoPath);
      }

      if (removeLogo) {
        formData.set("removeLogo", "on");
      } else {
        formData.delete("removeLogo");
      }

      await updateBusinessProfileAction(formData);
      setSavedMessage(true);
      setLogoFile(null);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Business profile could not be saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={handleSubmit} className="grid gap-5">
      {savedMessage ? (
        <div className="flex items-center gap-2 rounded-lg border border-mint/30 bg-mint/10 p-3 text-sm font-bold text-moss">
          <CheckCircle2 size={18} aria-hidden="true" />
          Business profile saved.
        </div>
      ) : null}
      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-gum/30 bg-gum/10 p-3 text-sm font-bold text-gum">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      <section className="card">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-mint/10 text-mint">
            <Building2 size={20} aria-hidden="true" />
          </span>
          <div>
            <p className="section-title">Business identity</p>
            <h2 className="text-xl font-black tracking-normal">Profile details</h2>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label>
            Trading/business name <span className="text-gum">*</span>
            <input name="tradingName" defaultValue={profile.tradingName} required />
          </label>
          <label>
            Invoice prefix <span className="text-gum">*</span>
            <input name="invoicePrefix" defaultValue={profile.invoicePrefix || "INV-"} required maxLength={16} />
          </label>
          <label>
            Legal entity name
            <input name="legalName" defaultValue={profile.legalName} />
          </label>
          <label>
            ABN
            <input name="abn" defaultValue={profile.abn} />
          </label>
          <label>
            ACN
            <input name="acn" defaultValue={profile.acn} />
          </label>
          <label>
            Contact name
            <input name="contactName" defaultValue={profile.contactName} />
          </label>
          <label>
            Email
            <input name="email" type="email" defaultValue={profile.email} />
          </label>
          <label>
            Phone
            <input name="phone" type="tel" defaultValue={profile.phone} />
          </label>
          <label>
            Website
            <input name="website" type="url" defaultValue={profile.website} />
          </label>
          <label className="md:col-span-2">
            Business address
            <textarea name="address" defaultValue={profile.address} />
          </label>
        </div>
      </section>

      <section className="card">
        <p className="section-title">Invoice defaults</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label>
            Default hourly rate
            <input name="defaultHourlyRate" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={profile.defaultHourlyRate} />
          </label>
          <label>
            Payment terms days
            <input name="paymentTermsDays" type="number" min="0" step="1" defaultValue={profile.paymentTermsDays} />
          </label>
          <label className="flex min-h-12 cursor-pointer grid-cols-none flex-row items-center gap-3 rounded-lg border border-line bg-white px-3">
            <input
              className="size-5 min-h-0 w-auto"
              type="checkbox"
              checked={gstRegistered}
              onChange={(event) => setGstRegistered(event.target.checked)}
            />
            GST registered
          </label>
          <label>
            GST rate
            <input
              name="gstRate"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              defaultValue={profile.gstRate || "10"}
              disabled={!gstRegistered}
              aria-disabled={!gstRegistered}
            />
          </label>
          <label className="md:col-span-2">
            Default invoice notes
            <textarea name="defaultInvoiceNotes" defaultValue={profile.defaultInvoiceNotes} />
          </label>
          <label className="md:col-span-2">
            Default invoice email message
            <textarea name="defaultInvoiceEmailMessage" defaultValue={profile.defaultInvoiceEmailMessage} />
          </label>
          <label className="md:col-span-2">
            Signature/footer
            <textarea name="signatureFooter" defaultValue={profile.signatureFooter} />
          </label>
        </div>
      </section>

      <section className="card">
        <p className="section-title">Payment details</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label>
            Bank account name
            <input name="bankAccountName" defaultValue={profile.bankAccountName} />
          </label>
          <label>
            BSB
            <input name="bsb" inputMode="numeric" defaultValue={profile.bsb} />
          </label>
          <label>
            Account number
            <input name="accountNumber" inputMode="numeric" defaultValue={profile.accountNumber} />
          </label>
        </div>
      </section>

      <section className="card">
        <p className="section-title">Logo</p>
        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center">
          {logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoPreview} alt="Business logo preview" className="h-24 w-24 rounded-lg border border-line object-contain bg-white" />
          ) : (
            <div className="grid h-24 w-24 place-items-center rounded-lg border border-line bg-white text-xs font-bold text-moss">No logo</div>
          )}
          <div className="grid flex-1 gap-3">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  const validationError = validateLogo(file);
                  if (validationError) {
                    setError(validationError);
                    event.target.value = "";
                    return;
                  }
                  setRemoveLogo(false);
                  setLogoFile(file);
                  setPreview(file.type === "image/svg+xml" ? null : URL.createObjectURL(file));
                }
              }}
            />
            <p className="text-xs font-bold text-moss">PNG, JPG, WEBP, or SVG. 500 KB preferred, 1 MB absolute maximum.</p>
            {logoFile?.type === "image/svg+xml" ? (
              <p className="flex items-center gap-2 text-sm font-bold text-moss">
                <Upload size={16} aria-hidden="true" />
                SVG selected. It will be stored privately and shown as an image after saving.
              </p>
            ) : null}
            <label className="flex cursor-pointer grid-cols-none flex-row items-center gap-3 text-sm font-bold text-moss">
              <input
                className="size-5 min-h-0 w-auto"
                type="checkbox"
                name="removeLogo"
                checked={removeLogo}
                onChange={(event) => setRemoveLogo(event.target.checked)}
              />
              <Trash2 size={16} aria-hidden="true" />
              Remove current logo
            </label>
          </div>
        </div>
      </section>

      <button className="tap-primary" type="submit" disabled={pending} aria-busy={pending}>
        <Save size={20} aria-hidden="true" />
        {pending ? "Saving profile..." : "Save Business Profile"}
      </button>
    </form>
  );
}

const allowedLogoTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
const maxLogoBytes = 1024 * 1024;

function validateBusinessProfile(formData: FormData, gstRegistered: boolean, logoFile: File | null) {
  if (!String(formData.get("tradingName") ?? "").trim()) return "Trading/business name is required.";
  if (!String(formData.get("invoicePrefix") ?? "").trim()) return "Invoice prefix is required.";

  const abn = digitsOnly(String(formData.get("abn") ?? ""));
  if (abn && abn.length !== 11) return "ABN must be 11 digits.";

  const acn = digitsOnly(String(formData.get("acn") ?? ""));
  if (acn && acn.length !== 9) return "ACN must be 9 digits.";

  const email = String(formData.get("email") ?? "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address.";

  const bsb = digitsOnly(String(formData.get("bsb") ?? ""));
  if (bsb && bsb.length !== 6) return "BSB must be 6 digits.";

  const accountNumber = digitsOnly(String(formData.get("accountNumber") ?? ""));
  if (accountNumber && (accountNumber.length < 5 || accountNumber.length > 12)) {
    return "Account number must be 5 to 12 digits.";
  }

  if (gstRegistered) {
    const gstRate = Number.parseFloat(String(formData.get("gstRate") ?? "10"));
    if (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100) return "GST rate must be between 0 and 100.";
  }

  return logoFile ? validateLogo(logoFile) : "";
}

function validateLogo(file: File) {
  if (!allowedLogoTypes.has(file.type)) return "Logo must be PNG, JPG, WEBP, or SVG.";
  if (file.size > maxLogoBytes) return "Logo is too large. Please choose a file under 1 MB.";
  return "";
}

function extensionForLogo(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && ["png", "jpg", "jpeg", "webp", "svg"].includes(fromName)) return fromName;
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/svg+xml") return "svg";
  return "png";
}

function contentTypeForExtension(extension: string) {
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "webp") return "image/webp";
  if (extension === "svg") return "image/svg+xml";
  return "image/png";
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}
