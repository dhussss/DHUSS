"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Palette, Save, Settings2, ShieldCheck } from "lucide-react";
import { updateSettingsAction } from "@/app/actions";
import { themePresets } from "@/lib/themes";

type SettingsFormValue = {
  taxSetAsideEnabled: boolean;
  customTaxPercentageOverride: string;
  includeGstInTaxEstimate: boolean;
  includeSuperInSetAsidePlanning: boolean;
  superPlanningEnabled: boolean;
  superContributionPercentage: string;
  superFundName: string;
  superMemberNumber: string;
  themeAccent: string;
  themeMode: string;
};

export function SettingsForm({ settings }: { settings: SettingsFormValue }) {
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setSaved(false);
    setError("");

    try {
      await updateSettingsAction(formData);
      setSaved(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Settings could not be saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={handleSubmit} className="grid gap-5">
      {saved ? (
        <div className="flex items-center gap-2 rounded-lg border border-mint/30 bg-mint/10 p-3 text-sm font-bold text-moss">
          <CheckCircle2 size={18} aria-hidden="true" />
          Settings saved.
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
          <span className="icon-tile">
            <Palette size={20} aria-hidden="true" />
          </span>
          <div>
            <p className="section-title">Appearance</p>
            <h2 className="text-xl font-black tracking-normal">App theme</h2>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label>
            Accent colour
            <select name="themeAccent" defaultValue={settings.themeAccent || "emerald"}>
              {Object.entries(themePresets).map(([value, preset]) => (
                <option key={value} value={value}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Display mode
            <select name="themeMode" defaultValue={settings.themeMode || "system"}>
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </div>
      </section>

      <section className="card">
        <div className="flex items-center gap-3">
          <span className="icon-tile">
            <Settings2 size={20} aria-hidden="true" />
          </span>
          <div>
            <p className="section-title">Tax planning</p>
            <h2 className="text-xl font-black tracking-normal">Set-aside estimates</h2>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="flex min-h-12 grid-cols-none flex-row items-center gap-3 rounded-lg border border-line bg-white px-3">
            <input className="size-5 min-h-0 w-auto" type="checkbox" name="taxSetAsideEnabled" defaultChecked={settings.taxSetAsideEnabled} />
            Show tax set-aside estimate
          </label>
          <label>
            Custom tax percentage override
            <input
              name="customTaxPercentageOverride"
              type="number"
              inputMode="decimal"
              min="0"
              max="100"
              step="0.1"
              placeholder="Use bracket estimate"
              defaultValue={settings.customTaxPercentageOverride}
            />
          </label>
          <label className="flex min-h-12 grid-cols-none flex-row items-center gap-3 rounded-lg border border-line bg-white px-3">
            <input className="size-5 min-h-0 w-auto" type="checkbox" name="includeGstInTaxEstimate" defaultChecked={settings.includeGstInTaxEstimate} />
            Include GST set-aside
          </label>
        </div>
      </section>

      <section className="card">
        <div className="flex items-center gap-3">
          <span className="icon-tile">
            <ShieldCheck size={20} aria-hidden="true" />
          </span>
          <div>
            <p className="section-title">Super planning</p>
            <h2 className="text-xl font-black tracking-normal">Optional estimates</h2>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="flex min-h-12 grid-cols-none flex-row items-center gap-3 rounded-lg border border-line bg-white px-3">
            <input className="size-5 min-h-0 w-auto" type="checkbox" name="superPlanningEnabled" defaultChecked={settings.superPlanningEnabled} />
            Show optional super planning
          </label>
          <label className="flex min-h-12 grid-cols-none flex-row items-center gap-3 rounded-lg border border-line bg-white px-3">
            <input className="size-5 min-h-0 w-auto" type="checkbox" name="includeSuperInSetAsidePlanning" defaultChecked={settings.includeSuperInSetAsidePlanning} />
            Include super in combined set-aside
          </label>
          <label>
            Super contribution percentage
            <input
              name="superContributionPercentage"
              type="number"
              inputMode="decimal"
              min="0"
              max="100"
              step="0.1"
              defaultValue={settings.superContributionPercentage || "11.5"}
            />
          </label>
          <label>
            Super fund name
            <input name="superFundName" defaultValue={settings.superFundName} />
          </label>
          <label>
            Member number
            <input name="superMemberNumber" defaultValue={settings.superMemberNumber} />
          </label>
        </div>
        <p className="mt-4 rounded-lg border border-line bg-paper p-3 text-xs font-bold leading-5 text-moss">
          These figures are planning estimates only. They are not tax, accounting, or superannuation advice.
        </p>
      </section>

      <button className="tap-primary" type="submit" disabled={pending} aria-busy={pending}>
        <Save size={20} aria-hidden="true" />
        {pending ? "Saving settings..." : "Save Settings"}
      </button>
    </form>
  );
}
