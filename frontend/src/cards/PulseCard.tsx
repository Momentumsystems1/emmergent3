// ============================================================
// CARDS — PULSE CARD (double-sided). Faithful structure of remix-pulse-engine-card with MY CLUSTER content:
// header (brand · mono code) → visualizer strip → control row → divider → status label/text → footer (timer · signal · code)
// Back: title/close, info rows, live stream list, footer status dot. Flip: rotateY 0→180 with backface hidden.
// ============================================================
import Ionicons from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";
import React, { useEffect } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { CARD } from "@/src/cards/cardTheme";
import { fonts, makeStyles, useTheme } from "@/src/theme";

// ---------------- primitives ----------------
export function CardHeader({ brand, code }: { brand: string; code: string }) {
  const s = useStyles();
  return <View style={s.header}><Text style={s.brand}>{brand}</Text><Text style={s.mono}>{code}</Text></View>;
}

/** Visualizer strip: bar heights represent real values (0..1) — never random. */
export function CardBars({ values, tone }: { values: number[]; tone: string }) {
  const s = useStyles();
  const bars = Array.from({ length: CARD.barCount }, (_, i) => values.length ? values[Math.floor((i / CARD.barCount) * values.length)] : 0);
  return (
    <View style={s.bars} testID="card-bars">
      {bars.map((v, i) => <View key={i} style={[s.bar, { backgroundColor: tone, height: `${Math.max(CARD.barMinScale, Math.min(1, v)) * 100}%`, opacity: 0.35 + v * 0.65 }]} />)}
    </View>
  );
}

export function CardDivider() { const s = useStyles(); return <View style={s.divider} />; }
export function CardLabel({ children }: { children: React.ReactNode }) { const s = useStyles(); return <Text style={s.label}>{children}</Text>; }
export function CardStatus({ children }: { children: React.ReactNode }) { const s = useStyles(); return <Text style={s.status}>{children}</Text>; }
export function Hi({ children }: { children: React.ReactNode }) { const { colors } = useTheme(); return <Text style={{ color: colors.brandPrimary, fontFamily: fonts.semibold }}>{children}</Text>; }

export function CardFooter({ left, level, right }: { left: string; level: number; right: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <View style={s.footer}>
      <Text style={s.mono}>{left}</Text>
      <View style={s.signal}>{Array.from({ length: CARD.signalBars }, (_, i) => <View key={i} style={[s.sigBar, { height: 6 + i * 4, backgroundColor: i < level ? colors.brandPrimary : colors.border }]} />)}</View>
      <Text style={s.mono}>{right}</Text>
    </View>
  );
}

export function InfoRow({ label, value, tone, testID }: { label: string; value: string; tone?: string; testID?: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  return <View style={s.infoRow} testID={testID}><Text style={s.infoLabel}>{label}</Text><Text style={[s.infoValue, { color: tone ?? colors.onSurface }]} numberOfLines={1}>{value}</Text></View>;
}

export function StreamLine({ ts, key_, value, ok }: { ts: string; key_: string; value: string; ok?: boolean }) {
  const s = useStyles();
  const { colors } = useTheme();
  return <Text style={s.stream} numberOfLines={1}><Text style={{ color: colors.muted }}>{ts} </Text><Text style={{ color: colors.brandTertiary }}>{key_} </Text><Text style={{ color: ok === false ? colors.error : ok ? colors.success : colors.onSurface }}>{value}</Text></Text>;
}

export function StatusDot({ active }: { active: boolean }) {
  const { colors } = useTheme();
  const p = useSharedValue(1);
  useEffect(() => { p.value = withRepeat(withTiming(0.3, { duration: 900 }), -1, true); }, [p]);
  const st = useAnimatedStyle(() => ({ opacity: active ? p.value : 1 }));
  return <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: active ? colors.success : colors.pending }, st]} />;
}

// ---------------- flip card ----------------
export function PulseCard({ front, back, flipped, onFlip, testID = "pulse-card", flipLabel = "VER ACCESOS", backLabel = "← VOLVER" }: { front: React.ReactNode; back: React.ReactNode; flipped: boolean; onFlip: () => void; testID?: string; flipLabel?: string; backLabel?: string }) {
  const s = useStyles();
  const rot = useSharedValue(flipped ? 180 : 0);
  useEffect(() => {
    rot.value = withTiming(flipped ? 180 : 0, { duration: CARD.flipDurationMs, easing: Easing.bezier(0.4, 0, 0.2, 1) });
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => null);
  }, [flipped, rot]);
  const frontStyle = useAnimatedStyle(() => ({ transform: [{ perspective: CARD.perspective }, { rotateY: `${rot.value}deg` }], opacity: rot.value < 90 ? 1 : 0, zIndex: rot.value < 90 ? 2 : 1 }));
  const backStyle = useAnimatedStyle(() => ({ transform: [{ perspective: CARD.perspective }, { rotateY: `${rot.value - 180}deg` }], opacity: rot.value >= 90 ? 1 : 0, zIndex: rot.value >= 90 ? 2 : 1 }));
  const shine = useAnimatedStyle(() => ({ opacity: interpolate(rot.value, [0, 90, 180], [0.1, 0.4, 0.1]) }));
  return (
    <View style={s.wrap} testID={testID}>
      <Animated.View style={[s.face, frontStyle]}>
        <Animated.View pointerEvents="none" style={[s.shine, shine]} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 56 }}>{front}</ScrollView>
        <Pressable testID={`${testID}-flip`} onPress={onFlip} style={s.flipBtn}><Text style={s.flipTxt}>{flipLabel}</Text></Pressable>
      </Animated.View>
      <Animated.View style={[s.face, s.back, backStyle]}>
        <Animated.View pointerEvents="none" style={[s.shine, shine]} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 56 }}>{back}</ScrollView>
        <Pressable testID={`${testID}-flip-back`} onPress={onFlip} style={s.flipBtn}><Text style={s.flipTxt}>{backLabel}</Text></Pressable>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { flex: 1 },
  face: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: c.surfaceSecondary, borderRadius: CARD.radius, borderWidth: 1, borderColor: c.border, padding: CARD.padding, backfaceVisibility: "hidden",
    shadowColor: c.surfaceInverse, shadowOpacity: 0.22, shadowRadius: 40, shadowOffset: { width: 0, height: 20 }, elevation: 10 },
  back: { backgroundColor: c.surfaceTertiary },
  shine: { position: "absolute", left: 0, right: 0, top: 0, height: CARD.shineHeight, borderTopLeftRadius: CARD.radius, borderTopRightRadius: CARD.radius, backgroundColor: c.onSurfaceInverse },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 },
  brand: { fontFamily: fonts.bold, fontSize: 20, letterSpacing: -0.3, color: c.onSurface },
  mono: { fontFamily: CARD.monoFont, fontSize: 10.5, color: c.muted, letterSpacing: 0.5 },
  bars: { height: 64, flexDirection: "row", alignItems: "flex-end", gap: 3, marginVertical: 10 },
  bar: { flex: 1, borderRadius: 2 },
  divider: { height: 1, backgroundColor: c.divider, marginVertical: 14 },
  label: { fontFamily: CARD.monoFont, fontSize: 10, letterSpacing: 1.6, color: c.muted, textTransform: "uppercase", marginBottom: 6 },
  status: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, color: c.onSurfaceSecondary },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18 },
  signal: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  sigBar: { width: 4, borderRadius: 1 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 9, borderBottomWidth: 1, borderColor: c.divider, gap: 12 },
  infoLabel: { fontFamily: CARD.monoFont, fontSize: 11, color: c.muted, letterSpacing: 0.6 },
  infoValue: { fontFamily: fonts.semibold, fontSize: 13, flexShrink: 1, textAlign: "right" },
  stream: { fontFamily: CARD.monoFont, fontSize: 10.5, lineHeight: 16 },
  flipBtn: { position: "absolute", right: CARD.padding, bottom: CARD.padding - 4, paddingHorizontal: 12, height: 32, borderRadius: 8, backgroundColor: c.surfaceInverse, alignItems: "center", justifyContent: "center" },
  flipTxt: { fontFamily: CARD.monoFont, fontSize: 10.5, letterSpacing: 1.2, color: c.onSurfaceInverse },
}));
