// Design tokens for Sentinel Family. Light ("Día") and dark ("Noche") themes.
// Keys match the "color" block of /app/design_guidelines.json.
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#F0F3F6",
  onSurface: "#1D2939",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#1D2939",
  surfaceTertiary: "#E4E7EC",
  onSurfaceTertiary: "#344054",
  surfaceInverse: "#0F172A",
  onSurfaceInverse: "#FFFFFF",
  muted: "#667085",
  brand: "#06AED5",
  onBrand: "#FFFFFF",
  brandPrimary: "#06AED5",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#3B82F6",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#8B5CF6",
  onBrandTertiary: "#FFFFFF",
  success: "#10B981",
  onSuccess: "#FFFFFF",
  warning: "#F59E0B",
  onWarning: "#FFFFFF",
  error: "#EF4444",
  onError: "#FFFFFF",
  info: "#3B82F6",
  onInfo: "#FFFFFF",
  orangeRisk: "#F97316",
  privacy: "#D946EF",
  onPrivacy: "#FFFFFF",
  sosStart: "#FF3B3B",
  sosEnd: "#B91C1C",
  onSos: "#FFFFFF",
  border: "#D0D5DD",
  borderStrong: "#98A2B3",
  divider: "#E4E7EC",
  // Sentinel extras
  glass: "rgba(255,255,255,0.74)",
  glassStrong: "rgba(255,255,255,0.9)",
  pending: "#B8C0CC",
  onPending: "#475467",
  orbCore: "#06AED5",
  orbHalo: "rgba(6,174,213,0.22)",
  orbViolet: "rgba(139,92,246,0.35)",
  mapTint: "#DCE4EC",
  overlay: "rgba(15,23,42,0.45)",
};

const dark: typeof light = {
  surface: "#09101C",
  onSurface: "#F8FAFC",
  surfaceSecondary: "#121A2B",
  onSurfaceSecondary: "#F8FAFC",
  surfaceTertiary: "#1E293B",
  onSurfaceTertiary: "#CBD5E1",
  surfaceInverse: "#F0F3F6",
  onSurfaceInverse: "#09101C",
  muted: "#94A3B8",
  brand: "#22D3EE",
  onBrand: "#09101C",
  brandPrimary: "#22D3EE",
  onBrandPrimary: "#09101C",
  brandSecondary: "#60A5FA",
  onBrandSecondary: "#09101C",
  brandTertiary: "#A78BFA",
  onBrandTertiary: "#09101C",
  success: "#34D399",
  onSuccess: "#09101C",
  warning: "#FBBF24",
  onWarning: "#09101C",
  error: "#F87171",
  onError: "#09101C",
  info: "#60A5FA",
  onInfo: "#09101C",
  orangeRisk: "#FB923C",
  privacy: "#E879F9",
  onPrivacy: "#FFFFFF",
  sosStart: "#FF5252",
  sosEnd: "#B91C1C",
  onSos: "#FFFFFF",
  border: "#273448",
  borderStrong: "#3B4A61",
  divider: "#1E293B",
  glass: "rgba(18,26,43,0.74)",
  glassStrong: "rgba(18,26,43,0.92)",
  pending: "#4B5563",
  onPending: "#CBD5E1",
  orbCore: "#22D3EE",
  orbHalo: "rgba(34,211,238,0.22)",
  orbViolet: "rgba(167,139,250,0.35)",
  mapTint: "#0B1526",
  overlay: "rgba(0,0,0,0.6)",
};

export type ThemeColors = typeof light;
export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light, dark };

export const fonts = {
  regular: "Jakarta",
  medium: "JakartaMedium",
  semibold: "JakartaSemi",
  bold: "JakartaBold",
};
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme as any);
}
setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = (system === "dark" || system === "light") && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
