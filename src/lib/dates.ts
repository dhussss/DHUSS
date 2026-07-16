export function parseInputDate(value: FormDataEntryValue | string | null): Date {
  const raw = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error("Enter a valid date.");
  }

  const [year, month, day] = raw.split("-").map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Enter a valid date.");
  }

  return date;
}

export function dateInputValue(date: Date | string | number): string {
  const value = date instanceof Date ? date : new Date(date);
  return value.toISOString().slice(0, 10);
}

export function todayInputValue(): string {
  return dateInputValue(todayInPerth());
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

export function todayInPerth(): Date {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Perth",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return new Date(Date.UTC(year, month - 1, day));
}

export function previousWeekMondayToSunday(date: Date = todayInPerth()) {
  const currentWeekStart = startOfWeekMonday(date);
  const start = addDays(currentWeekStart, -7);
  const end = addDays(currentWeekStart, -1);

  return {
    start,
    end,
    endInclusive: endOfDay(end)
  };
}

export function currentWeekMondayToSunday(date: Date = todayInPerth()) {
  const start = startOfWeekMonday(date);
  const end = addDays(start, 6);

  return {
    start,
    end,
    endInclusive: endOfDay(end),
    days: Array.from({ length: 7 }, (_, index) => addDays(start, index))
  };
}

export function endOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}
