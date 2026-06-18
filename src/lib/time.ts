export function parseClockTime(value: FormDataEntryValue | string | null): number | null {
  const raw = String(value ?? "");
  if (!raw) return null;
  const [hourRaw, minuteRaw] = raw.split(":");
  const hour = Number.parseInt(hourRaw, 10);
  const minute = Number.parseInt(minuteRaw, 10);

  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return hour * 60 + minute;
}

export function minutesToHours(minutes: number): number {
  return minutes / 60;
}

export function formatHours(minutesOrHours: number, input: "minutes" | "hours" = "minutes"): string {
  const hours = input === "minutes" ? minutesOrHours / 60 : minutesOrHours;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(2).replace(/\.?0+$/, "");
}

export function isQuarterHour(minutes: number): boolean {
  return minutes > 0 && minutes % 15 === 0;
}

export function isQuarterHourClock(minutes: number): boolean {
  return minutes >= 0 && minutes % 15 === 0;
}

export function labourTotalCents(durationMinutes: number, hourlyRateCents: number): number {
  return Math.round((durationMinutes * hourlyRateCents) / 60);
}
