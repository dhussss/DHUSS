export const themePresets = {
  emerald: {
    label: "Emerald",
    accentRgb: "13 118 96",
    secondaryRgb: "89 96 90"
  },
  blue: {
    label: "Blue",
    accentRgb: "37 99 148",
    secondaryRgb: "88 100 112"
  },
  slate: {
    label: "Slate",
    accentRgb: "51 65 85",
    secondaryRgb: "96 105 122"
  },
  amber: {
    label: "Amber",
    accentRgb: "169 106 15",
    secondaryRgb: "113 103 90"
  },
  purple: {
    label: "Purple",
    accentRgb: "108 66 148",
    secondaryRgb: "100 92 108"
  }
} as const;

export type ThemePreset = keyof typeof themePresets;

export function normaliseThemePreset(value: string | null | undefined): ThemePreset {
  return value && value in themePresets ? (value as ThemePreset) : "emerald";
}

export function normaliseRgbValue(value: string | null | undefined, fallback: string) {
  if (!value || !/^\d{1,3} \d{1,3} \d{1,3}$/.test(value)) return fallback;
  const channels = value.split(" ").map(Number);
  return channels.every((channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255) ? value : fallback;
}
