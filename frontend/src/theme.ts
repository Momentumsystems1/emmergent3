// Design tokens for My Cluster — "My Cluster Pro" system v2.
// Light ("Día") and dark ("Noche") themes. All components must consume tokens, never hardcode colors.
// Keys are backward-compatible with v1; v2 adds tonal ("Soft") surfaces, hairline, card and a type scale.
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#F3F6FA",
  onSurface: "#0E1B2C",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#0E1B2C",
  surfaceTertiary: "#E8EEF5",
  onSurfaceTertiary: "#33465E",
  surfaceInverse: "#0A1322",
  onSurfaceInverse: "#F4F8FC",
  muted: "#5B6C84",
  brand: "#0899BC",
  onBrand: "#FFFFFF",
  brandPrimary: "#0899BC",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#3D6FE0",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#7C5CE0",
  onBrandTertiary: "#FFFFFF",
  success: "#0E9F6E",
  onSuccess: "#FFFFFF",
  warning: "#D9820B",
  onWarning: "#FFFFFF",
  error: "#DF3A44",
  onError: "#FFFFFF",
  info: "#3D6FE0",
  onInfo: "#FFFFFF",
  orangeRisk: "#EA6A1E",
  privacy: "#C026D3",
  onPrivacy: "#FFFFFF",
  sosStart: "#F43F4E",
  sosEnd: "#B4123A",
  onSos: "#FFFFFF",
  border: "#DCE4EE",
  borderStrong: "#B9C6D6",
  divider: "#E6ECF4",
  // My Cluster extras
  glass: "rgba(255,255,255,0.78)",
  glassStrong: "rgba(255,255,255,0.94)",
  pending: "#B4C0CF",
  onPending: "#44566E",
  orbCore: "#0899BC",
  orbHalo: "rgba(8,153,188,0.20)",
  orbViolet: "rgba(124,92,224,0.30)",
  mapTint: "#DDE5EE",
  overlay: "rgba(7,14,26,0.5)",
  // v2: tonal surfaces (chips, pills, subtle highlights) + card + hairline
  card: "#FFFFFF",
  hairline: "rgba(14,27,44,0.08)",
  brandSoft: "rgba(8,153,188,0.12)",
  onBrandSoft: "#077A97",
  successSoft: "rgba(14,159,110,0.12)",
  onSuccessSoft: "#0B7A55",
  warningSoft: "rgba(217,130,11,0.13)",
  onWarningSoft: "#A86407",
  errorSoft: "rgba(223,58,68,0.11)",
  onErrorSoft: "#B82430",
  infoSoft: "rgba(61,111,224,0.11)",
  onInfoSoft: "#2F58B8",
  violetSoft: "rgba(124,92,224,0.12)",
  onVioletSoft: "#6246C4",
};

const dark: typeof light = {
  surface: "#060B16",
  onSurface: "#F0F5FC",
  surfaceSecondary: "#0D1526",
  onSurfaceSecondary: "#F0F5FC",
  surfaceTertiary: "#17223A",
  onSurfaceTertiary: "#C6D2E4",
  surfaceInverse: "#F3F6FA",
  onSurfaceInverse: "#060B16",
  muted: "#8896AE",
  brand: "#2BD2F0",
  onBrand: "#04202E",
  brandPrimary: "#1FC8EC",
  onBrandPrimary: "#032331",
  brandSecondary: "#6E97F0",
  onBrandSecondary: "#071022",
  brandTertiary: "#A78BFA",
  onBrandTertiary: "#120B2E",
  success: "#3ED598",
  onSuccess: "#05271B",
  warning: "#F5B84A",
  onWarning: "#2E1E04",
  error: "#F5586A",
  onError: "#2E050B",
  info: "#6E97F0",
  onInfo: "#071022",
  orangeRisk: "#FB8C4A",
  privacy: "#E065F0",
  onPrivacy: "#2A0733",
  sosStart: "#FF4553",
  sosEnd: "#C21540",
  onSos: "#FFFFFF",
  border: "#1D2A44",
  borderStrong: "#30405F",
  divider: "#121D33",
  glass: "rgba(13,21,38,0.74)",
  glassStrong: "rgba(13,21,38,0.94)",
  pending: "#3E4C64",
  onPending: "#C6D2E4",
  orbCore: "#2BD2F0",
  orbHalo: "rgba(43,210,240,0.20)",
  orbViolet: "rgba(167,139,250,0.30)",
  mapTint: "#081020",
  overlay: "rgba(2,6,14,0.62)",
  card: "#0D1526",
  hairline: "rgba(148,170,205,0.14)",
  brandSoft: "rgba(43,210,240,0.14)",
  onBrandSoft: "#6FE3F7",
  successSoft: "rgba(62,213,152,0.14)",
  onSuccessSoft: "#6FE4B6",
  warningSoft: "rgba(245,184,74,0.15)",
  onWarningSoft: "#F9CB7E",
  errorSoft: "rgba(245,88,106,0.15)",
  onErrorSoft: "#FF8E9D",
  infoSoft: "rgba(110,151,240,0.15)",
  onInfoSoft: "#9AB6F5",
  violetSoft: "rgba(167,139,250,0.15)",
  onVioletSoft: "#C0AEFC",
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

// Type scale — pro pairing for Plus Jakarta Sans (tight tracking on display sizes).
export const type = {
  display: { fontSize: 34, lineHeight: 40, letterSpacing: -1.0, fontFamily: fonts.bold },
  title: { fontSize: 26, lineHeight: 33, letterSpacing: -0.6, fontFamily: fonts.bold },
  headline: { fontSize: 19, lineHeight: 25, letterSpacing: -0.3, fontFamily: fonts.bold },
  body: { fontSize: 15, lineHeight: 22, letterSpacing: 0, fontFamily: fonts.regular },
  bodyStrong: { fontSize: 15, lineHeight: 22, letterSpacing: 0, fontFamily: fonts.semibold },
  caption: { fontSize: 12.5, lineHeight: 17, letterSpacing: 0, fontFamily: fonts.regular },
  micro: { fontSize: 10.5, lineHeight: 14, letterSpacing: 1.1, fontFamily: fonts.bold },
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 8, md: 14, lg: 22, xl: 28, pill: 999 };

// Elevation presets (web renders real box-shadows; native uses shadow* / elevation).
export const shadow = {
  card: { shadowColor: "#0A1322", shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  pop: { shadowColor: "#0A1322", shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
} as const;

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
