// Orbital group field. Phases:
//  · editing    → slow orbit, pending (gray) vs active (vivid) avatars, reserved slots as dashed placeholders
//  · assembling → group birth: the field spins a full 360º while queued slots at 12:00 drop one by one into
//                 equidistant orbit positions, each anchor firing a translucent sonic wave with a neon rim
//  · forming    → formation links flash between nucleus and members
//  · collapsing → everything folds back into the nucleus (Mini-Orb)
// Timings are exported so the parent can keep its central counter in sync with the anchors.
import Ionicons from "@react-native-vector-icons/ionicons";
import React, { useEffect, useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { Easing, type SharedValue, useAnimatedStyle, useDerivedValue, useFrameCallback, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming } from "react-native-reanimated";

import { fonts, makeStyles, useTheme } from "@/src/theme";

export type OrbitalMember = { id: string; name: string; color: string; status: "active" | "pending" | "declined" | "expired" | "slot"; isMe?: boolean; isNew?: boolean };
export type OrbitalPhase = "editing" | "assembling" | "forming" | "collapsing";

// Assembly choreography (ms)
export const QUEUE_LEAD = 420;   // wave + spin start before the first slot leaves the queue
export const ANCHOR_STEP = 210;  // gap between two consecutive anchors
export const ANCHOR_TRAVEL = 620; // time a slot needs to settle in orbit
export const anchorAt = (i: number) => QUEUE_LEAD + i * ANCHOR_STEP + ANCHOR_TRAVEL * 0.55;
export const assembleDuration = (n: number) => QUEUE_LEAD + Math.max(0, n - 1) * ANCHOR_STEP + ANCHOR_TRAVEL;

type Props = {
  members: OrbitalMember[];
  slots?: number; // reserved, not yet invited places
  size: number;
  phase: OrbitalPhase;
  onMemberPress?: (m: OrbitalMember) => void;
  center?: React.ReactNode;
  groupName: string;
};

export function OrbitalField({ members, slots = 0, size, phase, onMemberPress, center, groupName }: Props) {
  const s = useStyles();
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const angle = useSharedValue(0);
  const fieldScale = useSharedValue(1);
  const linkOpacity = useSharedValue(0);
  const nucleusPulse = useSharedValue(1);

  const items = useMemo<OrbitalMember[]>(() => [
    ...members,
    ...Array.from({ length: Math.max(0, slots) }, (_, i) => ({ id: `slot-${i}`, name: "", color: colors.pending, status: "slot" as const })),
  ], [members, slots, colors.pending]);

  useFrameCallback((f) => {
    if (phase === "editing" && !reduced) angle.value += ((f.timeSincePreviousFrame ?? 16) / 1000) * 0.12; // slow, controlled orbit
  });

  useEffect(() => {
    if (phase === "assembling") {
      if (reduced) return;
      const total = assembleDuration(items.length);
      angle.value = 0;
      angle.value = withTiming(Math.PI * 2, { duration: total, easing: Easing.inOut(Easing.cubic) }); // one full 360º turn
      nucleusPulse.value = withSequence(withTiming(1.18, { duration: 260 }), withSpring(1, { damping: 9 }));
    }
    if (phase === "forming") {
      nucleusPulse.value = withSequence(withTiming(1.25, { duration: 260 }), withSpring(1, { damping: 8 }));
      linkOpacity.value = withSequence(withTiming(1, { duration: 500 }), withDelay(900, withTiming(0.55, { duration: 400 })));
    }
    if (phase === "collapsing") {
      linkOpacity.value = withTiming(0, { duration: 350 });
      fieldScale.value = withDelay(200, withTiming(0.16, { duration: 900, easing: Easing.inOut(Easing.cubic) }));
    }
  }, [phase, reduced, items.length, angle, nucleusPulse, linkOpacity, fieldScale]);

  const fieldStyle = useAnimatedStyle(() => ({ transform: [{ scale: fieldScale.value }] }));
  const nucleusStyle = useAnimatedStyle(() => ({ transform: [{ scale: nucleusPulse.value }] }));
  const ringR = size * 0.36;
  const nucleusSize = size * 0.34;
  const assembling = phase === "assembling" && !reduced;

  const targets = useMemo(() => items.map((_, i) => (Math.PI * 2 * i) / Math.max(1, items.length) - Math.PI / 2), [items]);

  return (
    <Animated.View style={[{ width: size, height: size }, fieldStyle]} testID="orbital-field">
      <View style={[s.field, { width: size, height: size, borderRadius: size / 2 }]} />
      <View style={[s.ring, { width: ringR * 2, height: ringR * 2, borderRadius: ringR, left: size / 2 - ringR, top: size / 2 - ringR }]} />
      {assembling ? items.map((m, i) => (
        <SonicWave key={`w-${m.id}`} size={size} delay={QUEUE_LEAD + i * ANCHOR_STEP} />
      )) : null}
      {members.map((m, i) => (
        <FormationLink key={`l-${m.id}`} angle={angle} target={targets[i]} r={ringR} center={size / 2} opacity={linkOpacity} color={m.status === "active" ? m.color : colors.pending} collapsing={phase === "collapsing"} />
      ))}
      <Animated.View style={[s.nucleus, { width: nucleusSize, height: nucleusSize, borderRadius: nucleusSize / 2, left: size / 2 - nucleusSize / 2, top: size / 2 - nucleusSize / 2 }, nucleusStyle]} testID="group-nucleus">
        <View style={s.nucleusInner}>
          {center ?? <Text style={s.nucleusText} numberOfLines={2}>{groupName}</Text>}
        </View>
      </Animated.View>
      {items.map((m, i) => (
        <OrbitAvatar key={m.id} m={m} index={i} angle={angle} target={targets[i]} r={ringR} center={size / 2}
          onPress={onMemberPress} collapsing={phase === "collapsing"} assembling={assembling} />
      ))}
      {assembling ? <QueueStack count={items.length} size={size} r={ringR} /> : null}
    </Animated.View>
  );
}

function OrbitAvatar({ m, index, angle, target, r, center, onPress, collapsing, assembling }: {
  m: OrbitalMember; index: number; angle: SharedValue<number>; target: number; r: number; center: number;
  onPress?: (m: OrbitalMember) => void; collapsing: boolean; assembling: boolean;
}) {
  const s = useStyles();
  const { colors } = useTheme();
  const queued = assembling; // starts parked at 12:00, invisible, waiting for its turn
  const radius = useSharedValue(queued ? r * 0.98 : m.isNew ? 0 : r);
  const scale = useSharedValue(queued || m.isNew ? 0.2 : 1);
  const opacity = useSharedValue(queued ? 0 : 1);
  const targetAngle = useSharedValue(queued ? -Math.PI / 2 : target);
  const active = useSharedValue(m.status === "active" ? 1 : 0);
  const glow = useSharedValue(0);
  const AV = 48;

  useEffect(() => {
    if (assembling) {
      const d = QUEUE_LEAD + index * ANCHOR_STEP;
      opacity.value = withDelay(d, withTiming(1, { duration: 180 }));
      scale.value = withDelay(d, withSequence(withTiming(1.2, { duration: 200 }), withSpring(1, { damping: 10 })));
      targetAngle.value = withDelay(d, withSpring(target, { damping: 14, stiffness: 78, mass: 1.05 }));
      radius.value = withDelay(d, withSpring(r, { damping: 13, stiffness: 70 }));
      glow.value = withDelay(d, withSequence(withTiming(1, { duration: 320 }), withTiming(0, { duration: 700 })));
    }
  }, [assembling, index, target, r, opacity, scale, targetAngle, radius, glow]);

  useEffect(() => { if (!assembling) targetAngle.value = withSpring(target, { damping: 16, stiffness: 90 }); }, [assembling, target, targetAngle]);
  useEffect(() => {
    if (m.isNew && !assembling) {
      scale.value = withSequence(withTiming(1.25, { duration: 260 }), withSpring(1, { damping: 10 }));
      radius.value = withDelay(180, withSpring(r, { damping: 13, stiffness: 70, mass: 1.1 }));
    }
  }, [m.isNew, assembling, r, radius, scale]);
  useEffect(() => {
    if (m.status === "active" && active.value === 0) {
      active.value = withTiming(1, { duration: 900 });
      glow.value = withSequence(withTiming(1, { duration: 500 }), withTiming(0, { duration: 900 }));
    }
  }, [m.status, active, glow]);
  useEffect(() => { if (collapsing) radius.value = withTiming(0, { duration: 700, easing: Easing.inOut(Easing.cubic) }); }, [collapsing, radius]);

  const a = useDerivedValue(() => targetAngle.value + angle.value);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: center + Math.cos(a.value) * radius.value - AV / 2 }, { translateY: center + Math.sin(a.value) * radius.value - AV / 2 }, { scale: scale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value * 0.7, transform: [{ scale: 1 + glow.value * 0.9 }] }));
  const isSlot = m.status === "slot";
  const pending = m.status !== "active";
  const bg = isSlot ? "transparent" : pending ? colors.pending : m.color;
  const initial = (m.name || "?").trim().charAt(0).toUpperCase();

  return (
    <Animated.View style={[s.avatar, style]}>
      <Animated.View style={[s.avatarGlow, { backgroundColor: isSlot ? colors.brandTertiary : m.color }, glowStyle]} />
      <Pressable testID={isSlot ? `orbital-slot-${index}` : `orbital-member-${m.id}`} onPress={() => onPress?.(m)} disabled={isSlot}
        accessibilityLabel={isSlot ? "Plaza reservada, aún sin invitar" : `${m.name}, ${pending ? "a la espera de confirmación" : "activo"}`}
        style={[s.avatarBtn, { backgroundColor: bg, borderColor: isSlot ? colors.brandPrimary : pending ? colors.borderStrong : colors.glassStrong, opacity: isSlot ? 1 : pending ? 0.75 : 1 },
          isSlot && s.slotBtn]}>
        {isSlot ? <Ionicons name="person-add-outline" size={18} color={colors.brandPrimary} />
          : m.isMe ? <Ionicons name="location" size={20} color={colors.onBrandPrimary} />
            : <Text style={[s.avatarText, pending && { color: colors.onPending }]}>{initial}</Text>}
        {pending && !isSlot ? <View style={s.pendingDot}><Ionicons name="time" size={9} color={colors.onPending} /></View> : null}
      </Pressable>
      <Text style={[s.avatarName, (pending || isSlot) && { color: colors.muted }]} numberOfLines={1}>{isSlot ? "libre" : m.name}</Text>
    </Animated.View>
  );
}

/** Translucent ring with a neon rim, fired each time a slot anchors into orbit. */
function SonicWave({ size, delay }: { size: number; delay: number }) {
  const { colors } = useTheme();
  const p = useSharedValue(0);
  useEffect(() => { p.value = withDelay(delay, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) })); }, [delay, p]);
  const style = useAnimatedStyle(() => ({ opacity: p.value === 0 ? 0 : (1 - p.value) * 0.85, transform: [{ scale: 0.22 + p.value * 1.15 }] }));
  return (
    <Animated.View pointerEvents="none" style={[{
      position: "absolute", left: 0, top: 0, width: size, height: size, borderRadius: size / 2,
      backgroundColor: colors.orbHalo, borderWidth: 2, borderColor: colors.brandPrimary,
    }, style]} />
  );
}

/** The queue at 12:00: one dot per pending slot, each leaving as its avatar anchors. */
function QueueStack({ count, size, r }: { count: number; size: number; r: number }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: size / 2 - r - 30, width: size, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 4 }}>
      {Array.from({ length: count }, (_, i) => <QueueDot key={i} index={i} />)}
    </View>
  );
}

function QueueDot({ index }: { index: number }) {
  const s = useStyles();
  const o = useSharedValue(1);
  useEffect(() => { o.value = withDelay(QUEUE_LEAD + index * ANCHOR_STEP, withTiming(0, { duration: 200 })); }, [index, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: 0.6 + o.value * 0.4 }] }));
  return <Animated.View style={[s.queueDot, style]} />;
}

function FormationLink({ angle, target, r, center, opacity, color, collapsing }: { angle: SharedValue<number>; target: number; r: number; center: number; opacity: SharedValue<number>; color: string; collapsing: boolean }) {
  const len = useSharedValue(r);
  useEffect(() => { if (collapsing) len.value = withTiming(0, { duration: 700 }); }, [collapsing, len]);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value, width: len.value,
    transform: [{ translateX: center }, { translateY: center }, { rotate: `${target + angle.value}rad` }],
  }));
  return <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, top: 0, height: 2, borderRadius: 1, backgroundColor: color, transformOrigin: "left center" as any }, style]} />;
}

const useStyles = makeStyles((c) => ({
  field: { position: "absolute", left: 0, top: 0, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border,
    shadowColor: c.surfaceInverse, shadowOpacity: 0.1, shadowRadius: 30, shadowOffset: { width: 0, height: 12 }, elevation: 3 },
  ring: { position: "absolute", borderWidth: 1, borderColor: c.divider, borderStyle: "dashed" },
  nucleus: { position: "absolute", backgroundColor: c.orbCore, alignItems: "center", justifyContent: "center",
    shadowColor: c.orbCore, shadowOpacity: 0.5, shadowRadius: 22, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  nucleusInner: { flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center", padding: 8 },
  nucleusText: { fontFamily: fonts.bold, color: c.onBrandPrimary, fontSize: 15, textAlign: "center" },
  avatar: { position: "absolute", left: 0, top: 0, width: 48, alignItems: "center" },
  avatarGlow: { position: "absolute", width: 48, height: 48, borderRadius: 24 },
  avatarBtn: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 2,
    shadowColor: c.surfaceInverse, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  slotBtn: { borderStyle: "dashed", shadowOpacity: 0 },
  avatarText: { fontFamily: fonts.bold, color: c.onBrandPrimary, fontSize: 18 },
  avatarName: { fontFamily: fonts.medium, fontSize: 10, color: c.onSurface, marginTop: 3, width: 64, textAlign: "center" },
  pendingDot: { position: "absolute", right: -2, bottom: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border },
  queueDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.brandPrimary, borderWidth: 1, borderColor: c.brandTertiary },
}));
