// Design tokens for MY CLUSTER — sistema "Google-like": blanco/gris/negro con acento rojo.
// Light ("Día") and dark ("Noche") themes. All components must consume tokens, never hardcode colors.
// Keys are backward-compatible with v1/v2; v3 cambia la paleta a blanco/gris/negro + rojo #EA4335.
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FFFFFF",
  onSurface: "#202124",
  surfaceSecondary: "#F1F3F4",
  onSurfaceSecondary: "#202124",
  surfaceTertiary: "#E8EAED",
  onSurfaceTertiary: "#3C4043",
  surfaceInverse: "#202124",
  onSurfaceInverse: "#F8F9FA",
  muted: "#5F6368",
  brand: "#EA4335",
  onBrand: "#FFFFFF",
  brandPrimary: "#D93025",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#202124",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#5F6368",
  onBrandTertiary: "#FFFFFF",
  success: "#34A853",
  onSuccess: "#FFFFFF",
  warning: "#F9AB00",
  onWarning: "#202124",
  error: "#D93025",
  onError: "#FFFFFF",
  info: "#5F6368",
  onInfo: "#FFFFFF",
  orangeRisk: "#F29900",
  privacy: "#3C4043",
  onPrivacy: "#FFFFFF",
  sosStart: "#F2635A",
  sosEnd: "#C5221F",
  onSos: "#FFFFFF",
  border: "#E0E2E6",
  borderStrong: "#BDC1C6",
  divider: "#F1F3F4",
  // extras
  glass: "rgba(255,255,255,0.82)",
  glassStrong: "rgba(255,255,255,0.95)",
  pending: "#DADCE0",
  onPending: "#5F6368",
  orbCore: "#EA4335",
  orbHalo: "rgba(234,67,53,0.18)",
  orbViolet: "rgba(95,99,104,0.28)",
  mapTint: "#E8EAED",
  overlay: "rgba(32,33,36,0.5)",
  // tonal surfaces (chips, pills, subtle highlights) + card + hairline
  card: "#FFFFFF",
  hairline: "rgba(32,33,36,0.08)",
  brandSoft: "rgba(234,67,53,0.10)",
  onBrandSoft: "#C5221F",
  successSoft: "rgba(52,168,83,0.12)",
  onSuccessSoft: "#1E7E34",
  warningSoft: "rgba(249,171,0,0.14)",
  onWarningSoft: "#B06000",
  errorSoft: "rgba(217,48,37,0.10)",
  onErrorSoft: "#C5221F",
  infoSoft: "rgba(95,99,104,0.12)",
  onInfoSoft: "#3C4043",
  violetSoft: "rgba(95,99,104,0.12)",
  onVioletSoft: "#3C4043",
};

const dark: typeof light = {
  surface: "#141518",
  onSurface: "#E8EAED",
  surfaceSecondary: "#1F2125",
  onSurfaceSecondary: "#E8EAED",
  surfaceTertiary: "#2A2D33",
  onSurfaceTertiary: "#BDC1C6",
  surfaceInverse: "#F8F9FA",
  onSurfaceInverse: "#141518",
  muted: "#9AA0A6",
  brand: "#FF6F61",
  onBrand: "#202124",
  brandPrimary: "#EA4335",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#E8EAED",
  onBrandSecondary: "#202124",
  brandTertiary: "#9AA0A6",
  onBrandTertiary: "#202124",
  success: "#81C995",
  onSuccess: "#0D1F13",
  warning: "#FDD663",
  onWarning: "#2E2103",
  error: "#F28B82",
  onError: "#3B0D0A",
  info: "#9AA0A6",
  onInfo: "#202124",
  orangeRisk: "#F9AB00",
  privacy: "#BDC1C6",
  onPrivacy: "#202124",
  sosStart: "#F2635A",
  sosEnd: "#C5221F",
  onSos: "#FFFFFF",
  border: "#2E3138",
  borderStrong: "#45484F",
  divider: "#232529",
  glass: "rgba(31,33,37,0.78)",
  glassStrong: "rgba(31,33,37,0.95)",
  pending: "#3C4043",
  onPending: "#BDC1C6",
  orbCore: "#FF6F61",
  orbHalo: "rgba(234,67,53,0.24)",
  orbViolet: "rgba(154,160,166,0.30)",
  mapTint: "#1A1C20",
  overlay: "rgba(0,0,0,0.62)",
  card: "#1F2125",
  hairline: "rgba(232,234,237,0.10)",
  brandSoft: "rgba(234,67,53,0.18)",
  onBrandSoft: "#FF8A80",
  successSoft: "rgba(129,201,149,0.16)",
  onSuccessSoft: "#A6DAB5",
  warningSoft: "rgba(253,214,99,0.16)",
  onWarningSoft: "#FDE293",
  errorSoft: "rgba(242,139,130,0.16)",
  onErrorSoft: "#F6AEA9",
  infoSoft: "rgba(154,160,166,0.16)",
  onInfoSoft: "#C7CCD1",
  violetSoft: "rgba(154,160,166,0.16)",
  onVioletSoft: "#C7CCD1",
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
