// Shared UI primitives: Button, Glass, Text styles, Toast + Unavailable hosts (global, mounted in root layout).
import Ionicons from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, TextProps, View, ViewProps } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { UnavailableDetail } from "@/src/api";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

// ---------------- tiny global emitters ----------------
type Listener<T> = (v: T) => void;
function emitter<T>() {
  const ls = new Set<Listener<T>>();
  return { on: (l: Listener<T>) => { ls.add(l); return () => { ls.delete(l); }; }, emit: (v: T) => ls.forEach((l) => l(v)) };
}
const toastBus = emitter<{ text: string; tone?: "info" | "success" | "error" }>();
const unavailableBus = emitter<UnavailableDetail | null>();
export const toast = (text: string, tone: "info" | "success" | "error" = "info") => toastBus.emit({ text, tone });
export const showUnavailable = (d: UnavailableDetail) => unavailableBus.emit(d);

// ---------------- text ----------------
export function T({ style, weight = "regular", ...p }: TextProps & { weight?: keyof typeof fonts }) {
  const { colors } = useTheme();
  return <Text {...p} style={[{ fontFamily: fonts[weight], color: colors.onSurface }, style]} />;
}

// ---------------- button ----------------
type BtnProps = { title: string; onPress?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger"; loading?: boolean;
  disabled?: boolean; testID: string; icon?: string; small?: boolean };
export function Button({ title, onPress, variant = "primary", loading, disabled, testID, icon, small }: BtnProps) {
  const s = useBtnStyles();
  const { colors } = useTheme();
  const fg = variant === "primary" ? colors.onBrandPrimary : variant === "danger" ? colors.onError : colors.onSurface;
  return (
    <Pressable testID={testID} onPress={onPress} disabled={disabled || loading} accessibilityRole="button"
      style={({ pressed }) => [s.base, s[variant], small && s.small, (disabled || loading) && s.disabled, pressed && { transform: [{ scale: 0.98 }] }]}>
      {loading ? <ActivityIndicator color={fg} /> : (
        <View style={s.row}>
          {icon ? <Ionicons name={icon as any} size={18} color={fg} /> : null}
          <Text style={[s.label, { color: fg }, small && { fontSize: 14 }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}
const useBtnStyles = makeStyles((c) => ({
  base: { minHeight: 52, borderRadius: radius.lg, paddingHorizontal: spacing.xl, alignItems: "center", justifyContent: "center" },
  small: { minHeight: 44, paddingHorizontal: spacing.lg, borderRadius: radius.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  primary: { backgroundColor: c.brandPrimary },
  secondary: { backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border },
  ghost: { backgroundColor: "transparent" },
  danger: { backgroundColor: c.error },
  disabled: { opacity: 0.5 },
  label: { fontFamily: fonts.semibold, fontSize: 16 },
}));

// ---------------- glass card ----------------
export function Glass({ style, children, ...p }: ViewProps) {
  const s = useGlassStyles();
  return <View {...p} style={[s.glass, style]}>{children}</View>;
}
const useGlassStyles = makeStyles((c) => ({
  glass: { backgroundColor: c.glass, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.lg,
    shadowColor: c.surfaceInverse, shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
}));

// ---------------- toast host ----------------
export function ToastHost() {
  const [t, setT] = useState<{ text: string; tone?: string } | null>(null);
  const insets = useSafeAreaInsets();
  const s = useToastStyles();
  useEffect(() => toastBus.on((v) => { setT(v); setTimeout(() => setT(null), 3200); }), []);
  if (!t) return null;
  return (
    <Animated.View entering={FadeInDown} exiting={FadeOutDown} pointerEvents="none"
      style={[s.wrap, { bottom: insets.bottom + 24 }]}>
      <View testID="toast" style={[s.box, t.tone === "error" && s.err, t.tone === "success" && s.ok]}>
        <Text style={s.txt}>{t.text}</Text>
      </View>
    </Animated.View>
  );
}
const useToastStyles = makeStyles((c) => ({
  wrap: { position: "absolute", left: spacing.lg, right: spacing.lg, alignItems: "center" },
  box: { backgroundColor: c.surfaceInverse, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, maxWidth: 420 },
  err: { backgroundColor: c.error }, ok: { backgroundColor: c.success },
  txt: { color: c.onSurfaceInverse, fontFamily: fonts.medium, fontSize: 14 },
}));

// ---------------- unavailable host (plan vs service) ----------------
export function UnavailableHost() {
  const [d, setD] = useState<UnavailableDetail | null>(null);
  const router = useRouter();
  const s = useUnStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  useEffect(() => unavailableBus.on(setD), []);
  const isPlan = d?.code === "PLAN_UNAVAILABLE";
  return (
    <Modal visible={!!d} transparent animationType="fade" onRequestClose={() => setD(null)}>
      <Pressable style={s.backdrop} onPress={() => setD(null)} />
      <View style={[s.sheet, { paddingBottom: insets.bottom + spacing.lg }]} testID="unavailable-sheet">
        <View style={[s.iconWrap, { backgroundColor: isPlan ? colors.brandTertiary : colors.brandPrimary }]}>
          <Ionicons name={isPlan ? "diamond" : "sparkles"} size={22} color={isPlan ? colors.onBrandTertiary : colors.onBrandPrimary} />
        </View>
        <Text style={s.title} testID="unavailable-title">{isPlan ? d?.title : "Próximamente"}</Text>
        {d?.reason ? <Text style={s.reason} testID="unavailable-reason">{isPlan ? d.reason : "Esta función está en camino. Estará disponible en una próxima versión."}</Text> : null}
        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          {isPlan ? <Button testID="unavailable-upgrade-button" title="Ver planes y mejorar" icon="arrow-up-circle"
            onPress={() => { setD(null); router.push("/plans"); }} /> : null}
          <Button testID="unavailable-ok-button" title="Entendido" variant="secondary" onPress={() => setD(null)} />
        </View>
      </View>
    </Modal>
  );
}
const useUnStyles = makeStyles((c) => ({
  backdrop: { flex: 1, backgroundColor: c.overlay },
  sheet: { backgroundColor: c.surfaceSecondary, borderTopLeftRadius: radius.lg + 8, borderTopRightRadius: radius.lg + 8, padding: spacing.xl },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  title: { fontFamily: fonts.bold, fontSize: 18, color: c.onSurface, letterSpacing: 0.4 },
  reason: { fontFamily: fonts.regular, fontSize: 14, color: c.muted, marginTop: spacing.sm, lineHeight: 20 },
}));

// ---------------- state pill ----------------
export function Pill({ label, tone = "muted", testID }: { label: string; tone?: "muted" | "cyan" | "green" | "amber" | "red" | "violet" | "blue"; testID?: string }) {
  const { colors } = useTheme();
  const map = { muted: [colors.surfaceTertiary, colors.onSurfaceTertiary], cyan: [colors.brandPrimary, colors.onBrandPrimary],
    green: [colors.success, colors.onSuccess], amber: [colors.warning, colors.onWarning], red: [colors.error, colors.onError],
    violet: [colors.brandTertiary, colors.onBrandTertiary], blue: [colors.brandSecondary, colors.onBrandSecondary] } as const;
  const [bg, fg] = map[tone];
  return (
    <View testID={testID} style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" }}>
      <Text style={{ color: fg, fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.3 }}>{label}</Text>
    </View>
  );
}

export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <Pressable testID="header-back-button" onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/map")))}
        style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary }}>
        <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
      </Pressable>
      <T weight="bold" style={{ fontSize: 20, flex: 1 }}>{title}</T>
      {right}
    </View>
  );
}
