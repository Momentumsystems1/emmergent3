// Shared UI primitives: Button, Glass/Card, Text styles, Pill/Chip, Header, Toast + Unavailable hosts (global, mounted in root layout).
import Ionicons from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, TextProps, View, ViewProps } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type UnavailableDetail = { code: "PLAN_UNAVAILABLE" | "SERVICE_NOT_CONFIGURED"; title: string; reason: string; capability?: string };
import { fonts, makeStyles, radius, shadow, spacing, useTheme } from "@/src/theme";

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

// Section label — small uppercase micro type for grouping content (X-GPS-style sectioning).
export function SectionLabel({ children, style }: { children: React.ReactNode; style?: any }) {
  const { colors } = useTheme();
  return <Text style={[{ fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 1.1, textTransform: "uppercase", color: colors.muted }, style]}>{children}</Text>;
}

// ---------------- button ----------------
type BtnProps = { title: string; onPress?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger" | "tonal"; loading?: boolean;
  disabled?: boolean; testID: string; icon?: string; small?: boolean };
export function Button({ title, onPress, variant = "primary", loading, disabled, testID, icon, small }: BtnProps) {
  const s = useBtnStyles();
  const { colors } = useTheme();
  const fg = variant === "primary" ? colors.onBrandPrimary : variant === "danger" ? colors.onError : variant === "tonal" ? colors.onBrandSoft : colors.onSurface;
  return (
    <Pressable testID={testID} onPress={onPress} disabled={disabled || loading} accessibilityRole="button"
      style={({ pressed }) => [s.base, s[variant], small && s.small, (disabled || loading) && s.disabled, pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] }]}>
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
  base: { minHeight: 54, borderRadius: radius.md + 2, paddingHorizontal: spacing.xl, alignItems: "center", justifyContent: "center" },
  small: { minHeight: 42, paddingHorizontal: spacing.lg, borderRadius: radius.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  primary: { backgroundColor: c.brandPrimary, borderWidth: 1, borderColor: c.brandPrimary, ...shadow.card },
  secondary: { backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.borderStrong },
  ghost: { backgroundColor: "transparent" },
  danger: { backgroundColor: c.error, borderWidth: 1, borderColor: c.error },
  tonal: { backgroundColor: c.brandSoft, borderWidth: 1, borderColor: "transparent" },
  disabled: { opacity: 0.45 },
  label: { fontFamily: fonts.semibold, fontSize: 16, letterSpacing: 0.2 },
}));

// ---------------- glass card / card ----------------
export function Glass({ style, children, ...p }: ViewProps) {
  const s = useGlassStyles();
  return <View {...p} style={[s.glass, style]}>{children}</View>;
}
const useGlassStyles = makeStyles((c) => ({
  glass: { backgroundColor: c.glass, borderRadius: radius.lg, borderWidth: 1, borderColor: c.hairline, padding: spacing.lg, ...shadow.pop },
}));

// Opaque elevated card — the workhorse surface for lists and panels.
export function Card({ style, children, ...p }: ViewProps) {
  const s = useCardStyles();
  return <View {...p} style={[s.card, style]}>{children}</View>;
}
const useCardStyles = makeStyles((c) => ({
  card: { backgroundColor: c.card, borderRadius: radius.md + 2, borderWidth: 1, borderColor: c.hairline, padding: spacing.lg, ...shadow.card },
}));

// ---------------- toast host ----------------
export function ToastHost() {
  const [t, setT] = useState<{ text: string; tone?: string } | null>(null);
  const insets = useSafeAreaInsets();
  const s = useToastStyles();
  useEffect(() => toastBus.on((v) => { setT(v); setTimeout(() => setT(null), 3200); }), []);
  if (!t) return null;
  const icon = t.tone === "error" ? "alert-circle" : t.tone === "success" ? "checkmark-circle" : "information-circle";
  return (
    <Animated.View entering={FadeInDown} exiting={FadeOutDown} pointerEvents="none"
      style={[s.wrap, { bottom: insets.bottom + 24 }]}>
      <View testID="toast" style={[s.box, t.tone === "error" && s.err, t.tone === "success" && s.ok]}>
        <Ionicons name={icon as any} size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
        <Text style={s.txt}>{t.text}</Text>
      </View>
    </Animated.View>
  );
}
const useToastStyles = makeStyles((c) => ({
  wrap: { position: "absolute", left: spacing.lg, right: spacing.lg, alignItems: "center" },
  box: { flexDirection: "row", alignItems: "center", backgroundColor: c.surfaceInverse, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.pill, maxWidth: 420, ...shadow.pop },
  err: { backgroundColor: c.error }, ok: { backgroundColor: c.success },
  txt: { color: c.onSurfaceInverse, fontFamily: fonts.medium, fontSize: 14 },
}));

// ---------------- unavailable host (plan vs service) ----------------
export function UnavailableHost() {
  const [d, setD] = useState<UnavailableDetail | null>(null);
  const s = useUnStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  useEffect(() => unavailableBus.on(setD), []);
  const isPlan = d?.code === "PLAN_UNAVAILABLE";
  return (
    <Modal visible={!!d} transparent animationType="fade" onRequestClose={() => setD(null)}>
      <Pressable style={s.backdrop} onPress={() => setD(null)} />
      <View style={[s.sheet, { paddingBottom: insets.bottom + spacing.lg }]} testID="unavailable-sheet">
        <View style={s.grabber} />
        <View style={[s.iconWrap, { backgroundColor: isPlan ? colors.violetSoft : colors.warningSoft }]}>
          <Ionicons name={isPlan ? "diamond" : "construct"} size={22} color={isPlan ? colors.onVioletSoft : colors.onWarningSoft} />
        </View>
        <Text style={s.title} testID="unavailable-title">{d?.title}</Text>
        {d?.reason ? <Text style={s.reason} testID="unavailable-reason">{d.reason}</Text> : null}
        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          <Button testID="unavailable-ok-button" title="Entendido" variant="secondary" onPress={() => setD(null)} />
        </View>
      </View>
    </Modal>
  );
}
const useUnStyles = makeStyles((c) => ({
  backdrop: { flex: 1, backgroundColor: c.overlay },
  sheet: { backgroundColor: c.surfaceSecondary, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: c.hairline },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, marginBottom: spacing.lg, marginTop: -spacing.sm },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  title: { fontFamily: fonts.bold, fontSize: 18, color: c.onSurface, letterSpacing: -0.2 },
  reason: { fontFamily: fonts.regular, fontSize: 14, color: c.muted, marginTop: spacing.sm, lineHeight: 20 },
}));

// ---------------- state pill (tonal, with status dot) ----------------
export function Pill({ label, tone = "muted", testID }: { label: string; tone?: "muted" | "cyan" | "green" | "amber" | "red" | "violet" | "blue"; testID?: string }) {
  const { colors } = useTheme();
  const map = {
    muted: [colors.surfaceTertiary, colors.onSurfaceTertiary],
    cyan: [colors.brandSoft, colors.onBrandSoft],
    green: [colors.successSoft, colors.onSuccessSoft],
    amber: [colors.warningSoft, colors.onWarningSoft],
    red: [colors.errorSoft, colors.onErrorSoft],
    violet: [colors.violetSoft, colors.onVioletSoft],
    blue: [colors.infoSoft, colors.onInfoSoft],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View testID={testID} style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: fg }} />
      <Text style={{ color: fg, fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.3 }}>{label}</Text>
    </View>
  );
}

// ---------------- filter chip (X-GPS-style segmented filters) ----------------
export function Chip({ label, icon, active, onPress, testID }: { label: string; icon?: string; active?: boolean; onPress?: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 5, height: 34, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1,
        backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary, borderColor: active ? colors.brandPrimary : colors.border }, pressed && { opacity: 0.8 }]}>
      {icon ? <Ionicons name={icon as any} size={14} color={active ? colors.onBrandSoft : colors.muted} /> : null}
      <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: active ? colors.onBrandSoft : colors.onSurfaceTertiary }}>{label}</Text>
    </Pressable>
  );
}

// ---------------- header ----------------
export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <Pressable testID="header-back-button" onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/map")))}
        style={({ pressed }) => [{ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.hairline }, pressed && { opacity: 0.7 }]}>
        <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
      </Pressable>
      <T weight="bold" style={{ fontSize: 21, letterSpacing: -0.4, flex: 1 }}>{title}</T>
      {right}
    </View>
  );
}
