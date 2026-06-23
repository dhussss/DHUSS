export const themePresets = {
  emerald: {
    label: "Emerald",
    accentRgb: "15 159 143",
    secondaryRgb: "84 116 91"
  },
  blue: {
    label: "Blue",
    accentRgb: "37 99 235",
    secondaryRgb: "71 85 105"
  },
  slate: {
    label: "Slate",
    accentRgb: "51 65 85",
    secondaryRgb: "100 116 139"
  },
  amber: {
    label: "Amber",
    accentRgb: "180 83 9",
    secondaryRgb: "120 113 108"
  },
  purple: {
    label: "Purple",
    accentRgb: "124 58 237",
    secondaryRgb: "91 73 119"
  }
} as const;

export type ThemePreset = keyof typeof themePresets;

export function normaliseThemePreset(value: string | null | undefined): ThemePreset {
  return value && value in themePresets ? (value as ThemePreset) : "emerald";
}
