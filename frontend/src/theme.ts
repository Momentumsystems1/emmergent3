// Design tokens for Sentinel Family. Light ("Día") and dark ("Noche") themes.
// Keys match the "color" block of /app/design_guidelines.json.
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

// Palette "Guardián": índigo profundo + ámbar cálido (protección familiar), distinta del cian-tecnológico anterior.
const light = {
  surface: "#F1F2F9",
  onSurface: "#1B1F35",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#1B1F35",
  surfaceTertiary: "#E7E8F3",
  onSurfaceTertiary: "#3A3F5C",
  surfaceInverse: "#0B1020",
  onSurfaceInverse: "#FFFFFF",
  muted: "#6B7096",
  brand: "#4F46E5",
  onBrand: "#FFFFFF",
  brandPrimary: "#4F46E5",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#F59E0B",
  onBrandSecondary: "#231400",
  brandTertiary: "#7C3AED",
  onBrandTertiary: "#FFFFFF",
  success: "#10B981",
  onSuccess: "#FFFFFF",
  warning: "#F59E0B",
  onWarning: "#231400",
  error: "#E11D48",
  onError: "#FFFFFF",
  info: "#4F46E5",
  onInfo: "#FFFFFF",
  orangeRisk: "#F97316",
  privacy: "#7C3AED",
  onPrivacy: "#FFFFFF",
  sosStart: "#F43F5E",
  sosEnd: "#9F1239",
  onSos: "#FFFFFF",
  border: "#D3D5E7",
  borderStrong: "#9CA0C2",
  divider: "#E7E8F3",
  // Sentinel extras
  glass: "rgba(255,255,255,0.74)",
  glassStrong: "rgba(255,255,255,0.9)",
  pending: "#BCBED4",
  onPending: "#43476A",
  orbCore: "#4F46E5",
  orbHalo: "rgba(79,70,229,0.22)",
  orbViolet: "rgba(124,58,237,0.35)",
  mapTint: "#E2E3F1",
  overlay: "rgba(11,16,32,0.45)",
};

const dark: typeof light = {
  surface: "#0B1020",
  onSurface: "#F5F6FF",
  surfaceSecondary: "#141A31",
  onSurfaceSecondary: "#F5F6FF",
  surfaceTertiary: "#1F2745",
  onSurfaceTertiary: "#C7CBE6",
  surfaceInverse: "#F1F2F9",
  onSurfaceInverse: "#0B1020",
  muted: "#8E93BD",
  brand: "#818CF8",
  onBrand: "#0B1020",
  brandPrimary: "#818CF8",
  onBrandPrimary: "#0B1020",
  brandSecondary: "#FBBF24",
  onBrandSecondary: "#231400",
  brandTertiary: "#A78BFA",
  onBrandTertiary: "#0B1020",
  success: "#34D399",
  onSuccess: "#0B1020",
  warning: "#FBBF24",
  onWarning: "#231400",
  error: "#FB7185",
  onError: "#0B1020",
  info: "#818CF8",
  onInfo: "#0B1020",
  orangeRisk: "#FB923C",
  privacy: "#A78BFA",
  onPrivacy: "#0B1020",
  sosStart: "#FB4C6A",
  sosEnd: "#9F1239",
  onSos: "#FFFFFF",
  border: "#2A3358",
  borderStrong: "#3D4877",
  divider: "#1F2745",
  glass: "rgba(20,26,49,0.74)",
  glassStrong: "rgba(20,26,49,0.92)",
  pending: "#4A4F73",
  onPending: "#C7CBE6",
  orbCore: "#818CF8",
  orbHalo: "rgba(129,140,248,0.24)",
  orbViolet: "rgba(167,139,250,0.35)",
  mapTint: "#0B1020",
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
