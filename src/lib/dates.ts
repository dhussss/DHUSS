export function parseInputDate(value: FormDataEntryValue | string | null): Date {
  const raw = String(value ?? "");
  const [year, month, day] = raw.split("-").map((part) => Number.parseInt(part, 10));

  if (!year || !month || !day) {
    throw new Error("Enter a valid date.");
  }

  return new Date(Date.UTC(year, month - 1, day));
}

export function dateInputValue(date: Date | string | number): string {
  const value = date instanceof Date ? date : new Date(date);
  return value.toISOString().slice(0, 10);
}

export function todayInputValue(): string {
  return dateInputValue(new Date());
}

export function formatDateAU(date: Date | string | number): string {
  const value = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC"
  }).format(value);
}

export function formatExportDate(date: Date | string | number): string {
  const value = date instanceof Date ? date : new Date(date);
  const weekday = new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    timeZone: "UTC"
  }).format(value);

  const day = new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC"
  }).format(value);

  return `${weekday} ${day}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function startOfWeekMonday(date: Date): Date {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - day + 1);
  return value;
}

export function endOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}
