"use client";

import { useMemo, useState } from "react";
import { Building2, Save, Trash2 } from "lucide-react";
import { updateBusinessProfileAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";

type BusinessProfileFormValue = {
  tradingName: string;
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
  logoUrl
}: {
  profile: BusinessProfileFormValue;
  logoUrl: string | null;
}) {
  const [preview, setPreview] = useState<string | null>(logoUrl);
  const [removeLogo, setRemoveLogo] = useState(false);

  const logoPreview = useMemo(() => (removeLogo ? null : preview), [preview, removeLogo]);

  return (
    <form action={updateBusinessProfileAction} className="grid gap-5">
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
            Trading/business name
            <input name="tradingName" defaultValue={profile.tradingName} required />
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
            <input className="size-5 min-h-0 w-auto" type="checkbox" name="gstRegistered" defaultChecked={profile.gstRegistered} />
            GST registered
          </label>
          <label>
            GST rate
            <input name="gstRate" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={profile.gstRate || "10"} />
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
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  setRemoveLogo(false);
                  setPreview(URL.createObjectURL(file));
                }
              }}
            />
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

      <SubmitButton className="tap-primary" pendingLabel="Saving profile...">
        <Save size={20} aria-hidden="true" />
        Save Business Profile
      </SubmitButton>
    </form>
  );
}
