export function dollarsToCents(value: FormDataEntryValue | string | number | null): number {
  const raw = String(value ?? "")
    .replace(/[$,\s]/g, "")
    .trim();

  if (!raw) return 0;

  const sign = raw.startsWith("-") ? -1 : 1;
  const normalised = raw.replace(/^-/, "");
  const [dollarsPart, centsPart = ""] = normalised.split(".");
  const dollars = Number.parseInt(dollarsPart || "0", 10);
  const cents = Number.parseInt((centsPart + "00").slice(0, 2), 10);

  if (Number.isNaN(dollars) || Number.isNaN(cents)) return 0;
  return sign * (dollars * 100 + cents);
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2
  }).format(cents / 100);
}

export function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}
