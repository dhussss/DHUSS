export const themePresets = {
  emerald: {
    label: "Emerald",
    accentRgb: "68 111 79",
    secondaryRgb: "99 113 95"
  },
  blue: {
    label: "Blue",
    accentRgb: "70 101 125",
    secondaryRgb: "96 108 116"
  },
  slate: {
    label: "Slate",
    accentRgb: "51 65 85",
    secondaryRgb: "100 116 139"
  },
  amber: {
    label: "Amber",
    accentRgb: "164 99 62",
    secondaryRgb: "116 108 99"
  },
  purple: {
    label: "Purple",
    accentRgb: "111 81 118",
    secondaryRgb: "104 94 108"
  }
} as const;

export type ThemePreset = keyof typeof themePresets;

export function normaliseThemePreset(value: string | null | undefined): ThemePreset {
  return value && value in themePresets ? (value as ThemePreset) : "emerald";
}
