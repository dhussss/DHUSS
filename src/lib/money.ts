export function dollarsToCents(value: FormDataEntryValue | string | number | null): number {
  const raw = String(value ?? "")
    .replace(/[$,\s]/g, "")
    .trim();

  if (!raw) return 0;
  if (!/^-?(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(raw)) return 0;

  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [dollarsPart = "0", centsPart = ""] = unsigned.split(".");
  const dollars = Number(dollarsPart || "0");
  const cents = Number(centsPart.padEnd(2, "0"));
  const total = dollars * 100 + cents;

  if (!Number.isSafeInteger(total)) return 0;
  return negative ? -total : total;
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
