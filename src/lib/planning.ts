type TaxBracket = {
  thresholdCents: number;
  baseTaxCents: number;
  marginalRate: number;
};

export const AUSTRALIAN_RESIDENT_TAX_BRACKETS = {
  "2025-26": [
    { thresholdCents: 0, baseTaxCents: 0, marginalRate: 0 },
    { thresholdCents: 1_820_000, baseTaxCents: 0, marginalRate: 0.16 },
    { thresholdCents: 4_500_000, baseTaxCents: 428_800, marginalRate: 0.3 },
    { thresholdCents: 13_500_000, baseTaxCents: 3_128_800, marginalRate: 0.37 },
    { thresholdCents: 19_000_000, baseTaxCents: 5_163_800, marginalRate: 0.45 }
  ],
  "2026-27": [
    { thresholdCents: 0, baseTaxCents: 0, marginalRate: 0 },
    { thresholdCents: 1_820_000, baseTaxCents: 0, marginalRate: 0.15 },
    { thresholdCents: 4_500_000, baseTaxCents: 402_000, marginalRate: 0.3 },
    { thresholdCents: 13_500_000, baseTaxCents: 3_102_000, marginalRate: 0.37 },
    { thresholdCents: 19_000_000, baseTaxCents: 5_137_000, marginalRate: 0.45 }
  ]
} satisfies Record<string, TaxBracket[]>;

const MEDICARE_LEVY_RATE = 0.02;
const WEEKS_PER_YEAR = 52;
const MONTHS_PER_YEAR = 12;

type PlanningProfile = {
  gstRegistered?: boolean | null;
  gstRate?: unknown;
  taxSetAsideEnabled?: boolean | null;
  customTaxPercentageOverride?: unknown;
  includeGstInTaxEstimate?: boolean | null;
  includeSuperInSetAsidePlanning?: boolean | null;
  superPlanningEnabled?: boolean | null;
  superContributionPercentage?: unknown;
};

export type SetAsidePlanning = {
  taxEnabled: boolean;
  superEnabled: boolean;
  includeSuperInSetAsidePlanning: boolean;
  includeGstInTaxEstimate: boolean;
  currentWeekEarningsCents: number;
  estimatedAnnualIncomeCents: number;
  estimatedAnnualTaxCents: number;
  estimatedEffectiveTaxRate: number;
  suggestedTaxWeeklyCents: number;
  suggestedTaxMonthlyCents: number;
  suggestedSuperWeeklyCents: number;
  suggestedSuperMonthlyCents: number;
  suggestedGstWeeklyCents: number;
  suggestedGstMonthlyCents: number;
  combinedWeeklyCents: number;
  combinedMonthlyCents: number;
  customTaxRate: number | null;
  superRate: number;
  financialYear: keyof typeof AUSTRALIAN_RESIDENT_TAX_BRACKETS;
};

function numeric(value: unknown, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  if (value && typeof value === "object" && "toString" in value) {
    const parsed = Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function financialYearForDate(date: Date): keyof typeof AUSTRALIAN_RESIDENT_TAX_BRACKETS {
  const year = date.getUTCFullYear();
  if (date.getUTCMonth() >= 6) {
    const key = `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
    return key in AUSTRALIAN_RESIDENT_TAX_BRACKETS ? (key as keyof typeof AUSTRALIAN_RESIDENT_TAX_BRACKETS) : "2026-27";
  }

  const key = `${year - 1}-${String(year % 100).padStart(2, "0")}`;
  return key in AUSTRALIAN_RESIDENT_TAX_BRACKETS ? (key as keyof typeof AUSTRALIAN_RESIDENT_TAX_BRACKETS) : "2025-26";
}

export function estimateAustralianIndividualTaxCents(annualIncomeCents: number, date = new Date()) {
  const financialYear = financialYearForDate(date);
  const brackets = AUSTRALIAN_RESIDENT_TAX_BRACKETS[financialYear];
  const bracket = [...brackets].reverse().find((item) => annualIncomeCents >= item.thresholdCents) ?? brackets[0];
  const bracketTax = bracket.baseTaxCents + Math.round((annualIncomeCents - bracket.thresholdCents) * bracket.marginalRate);
  const medicareLevy = Math.round(annualIncomeCents * MEDICARE_LEVY_RATE);

  return Math.max(0, bracketTax + medicareLevy);
}

export function calculateSetAsidePlanning(weeklyEarningsCents: number, profile: PlanningProfile | null | undefined, date = new Date()): SetAsidePlanning {
  const taxEnabled = profile?.taxSetAsideEnabled ?? true;
  const superEnabled = profile?.superPlanningEnabled ?? false;
  const includeSuperInSetAsidePlanning = profile?.includeSuperInSetAsidePlanning ?? false;
  const includeGstInTaxEstimate = profile?.includeGstInTaxEstimate ?? false;
  const customTaxRate = numeric(profile?.customTaxPercentageOverride, 0);
  const superRate = numeric(profile?.superContributionPercentage, 11.5);
  const gstRate = profile?.gstRegistered ? numeric(profile.gstRate, 10) : 0;
  const currentWeekEarningsCents = Math.max(0, Math.round(weeklyEarningsCents));
  const estimatedAnnualIncomeCents = currentWeekEarningsCents * WEEKS_PER_YEAR;
  const estimatedAnnualTaxCents =
    taxEnabled && customTaxRate > 0
      ? Math.round(estimatedAnnualIncomeCents * (customTaxRate / 100))
      : taxEnabled
        ? estimateAustralianIndividualTaxCents(estimatedAnnualIncomeCents, date)
        : 0;
  const estimatedEffectiveTaxRate = estimatedAnnualIncomeCents > 0 ? estimatedAnnualTaxCents / estimatedAnnualIncomeCents : 0;
  const suggestedTaxWeeklyCents = Math.round(currentWeekEarningsCents * estimatedEffectiveTaxRate);
  const suggestedTaxMonthlyCents = Math.round(estimatedAnnualTaxCents / MONTHS_PER_YEAR);
  const suggestedSuperWeeklyCents = superEnabled ? Math.round(currentWeekEarningsCents * (superRate / 100)) : 0;
  const suggestedSuperMonthlyCents = Math.round((suggestedSuperWeeklyCents * WEEKS_PER_YEAR) / MONTHS_PER_YEAR);
  const suggestedGstWeeklyCents = includeGstInTaxEstimate ? Math.round(currentWeekEarningsCents * (gstRate / 100)) : 0;
  const suggestedGstMonthlyCents = Math.round((suggestedGstWeeklyCents * WEEKS_PER_YEAR) / MONTHS_PER_YEAR);
  const combinedWeeklyCents = suggestedTaxWeeklyCents + suggestedGstWeeklyCents + (includeSuperInSetAsidePlanning ? suggestedSuperWeeklyCents : 0);
  const combinedMonthlyCents = suggestedTaxMonthlyCents + suggestedGstMonthlyCents + (includeSuperInSetAsidePlanning ? suggestedSuperMonthlyCents : 0);

  return {
    taxEnabled,
    superEnabled,
    includeSuperInSetAsidePlanning,
    includeGstInTaxEstimate,
    currentWeekEarningsCents,
    estimatedAnnualIncomeCents,
    estimatedAnnualTaxCents,
    estimatedEffectiveTaxRate,
    suggestedTaxWeeklyCents,
    suggestedTaxMonthlyCents,
    suggestedSuperWeeklyCents,
    suggestedSuperMonthlyCents,
    suggestedGstWeeklyCents,
    suggestedGstMonthlyCents,
    combinedWeeklyCents,
    combinedMonthlyCents,
    customTaxRate: customTaxRate > 0 ? customTaxRate : null,
    superRate,
    financialYear: financialYearForDate(date)
  };
}

export function formatPercent(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits).replace(/\.0$/, "")}%`;
}
