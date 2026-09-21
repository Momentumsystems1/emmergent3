// Group birth flow: the admin names the circle and reserves the places, then "Configurar" runs the orbital
// choreography (sonic waves + a full 360º turn while queued slots anchor one by one) and ends on the sharing options.
import Ionicons from "@react-native-vector-icons/ionicons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, TextInput, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, unavailableOf } from "@/src/api";
import { useAuth } from "@/src/auth";
import { InviteOptions } from "@/src/components/InviteOptions";
import { anchorAt, assembleDuration, OrbitalField, OrbitalMember, OrbitalPhase } from "@/src/components/OrbitalField";
import { Button, Header, showUnavailable, T, toast } from "@/src/components/ui";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Group = { id: string; name: string; planned_size?: number };
const MIN_SIZE = 2;
const MAX_SIZE = 12;

export default function CreateGroup() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();

  const [name, setName] = useState("");
  const [size, setSize] = useState(4);
  const [stage, setStage] = useState<"setup" | "assembling" | "ready">("setup");
  const [group, setGroup] = useState<Group | null>(null);
  const [anchored, setAnchored] = useState(0);
  const [busy, setBusy] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const orbSize = Math.min(width - spacing.xl * 2, 320);
  const finalName = name.trim() || "Mi grupo";
  const me: OrbitalMember = {
    id: "me", name: (user?.profile?.name || user?.email || "Yo").split(" ")[0], color: colors.brandPrimary,
    status: "active", isMe: true,
  };
  const members = stage === "setup" ? [] : [me];
  const slots = stage === "setup" ? size : Math.max(0, size - 1);
  const phase: OrbitalPhase = stage === "assembling" ? "assembling" : "editing";

  const skipToEnd = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setAnchored(size);
    setStage("ready");
  }, [size]);

  const configure = async () => {
    setBusy(true);
    try {
      const g = await api<Group>("/groups", { method: "POST", json: { name: finalName, planned_size: size } });
      setGroup(g);
      qc.invalidateQueries({ queryKey: ["groups"] });
      setAnchored(0);
      setStage("assembling");
      if (reduced) { setAnchored(size); setStage("ready"); return; }
      for (let i = 0; i < size; i++) {
        timers.current.push(setTimeout(() => {
          setAnchored(i + 1);
          Haptics.impactAsync(i === size - 1 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => null);
        }, anchorAt(i)));
      }
      timers.current.push(setTimeout(() => setStage("ready"), assembleDuration(size) + 260));
    } catch (e: any) {
      const u = unavailableOf(e); if (u) showUnavailable(u); else toast(e.message, "error");
    } finally { setBusy(false); }
  };

  const done = () => {
    qc.invalidateQueries({ queryKey: ["groups"] });
    if (group) router.replace({ pathname: "/group/[id]", params: { id: group.id } });
    else router.back();
  };

  return (
    <View style={s.root} testID="group-create">
      <Header title="Nuevo círculo" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + 120, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Pressable disabled={stage !== "assembling"} onPress={skipToEnd} style={{ alignItems: "center" }} testID="group-create-orbit">
          <OrbitalField size={orbSize} phase={phase} groupName={finalName} members={members} slots={slots}
            center={<NucleusCenter stage={stage} anchored={anchored} size={size} name={finalName} />} />
          {stage === "assembling" ? <T style={{ color: colors.muted, fontSize: 12, marginTop: spacing.sm }}>Toca para saltar</T> : null}
          {stage === "ready" ? <T style={{ color: colors.muted, fontSize: 12, marginTop: spacing.sm }}>Círculo creado el {new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</T> : null}
        </Pressable>

        {stage === "setup" ? (
          <>
            <View style={s.card}>
              <T weight="bold">Nombre del círculo</T>
              <TextInput testID="group-create-name" style={s.input} value={name} onChangeText={setName} placeholder="Familia, Amigos, Equipo…"
                placeholderTextColor={colors.muted} returnKeyType="done" maxLength={30} />
            </View>
            <View style={s.card}>
              <T weight="bold">¿Cuántas personas seréis?</T>
              <T style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Reservamos una plaza por persona, contándote a ti. Las plazas libres se ven en la órbita hasta que alguien entra.</T>
              <View style={s.stepper}>
                <Pressable testID="group-size-minus" onPress={() => setSize((n) => Math.max(MIN_SIZE, n - 1))} style={s.stepBtn} hitSlop={8}>
                  <Ionicons name="remove" size={22} color={colors.onSurface} />
                </Pressable>
                <T weight="bold" testID="group-size-value" style={{ fontSize: 34, minWidth: 64, textAlign: "center" }}>{size}</T>
                <Pressable testID="group-size-plus" onPress={() => setSize((n) => Math.min(MAX_SIZE, n + 1))} style={s.stepBtn} hitSlop={8}>
                  <Ionicons name="add" size={22} color={colors.onSurface} />
                </Pressable>
              </View>
            </View>
            <Button testID="group-create-configure" title="Configurar" icon="sparkles" loading={busy} onPress={configure} />
          </>
        ) : null}

        {stage === "ready" && group ? (
          <Animated.View entering={FadeIn.duration(320)} style={{ gap: spacing.lg }} testID="group-create-share">
            <View style={s.card}>
              <T weight="bold">Reparte las plazas</T>
              <T style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Comparte el enlace o el código. Cada persona que entra ocupa una plaza libre de la órbita.</T>
              <View style={{ marginTop: spacing.md }}>
                <InviteOptions groupId={group.id} groupName={group.name} />
              </View>
            </View>
            <Button testID="group-create-done" title="Ir al círculo" icon="arrow-forward" onPress={done} />
          </Animated.View>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** Counter that ticks up with each anchor and then shrinks into the group label. */
function NucleusCenter({ stage, anchored, size, name }: { stage: "setup" | "assembling" | "ready"; anchored: number; size: number; name: string }) {
  const s = useStyles();
  const countScale = useSharedValue(1);
  const countOpacity = useSharedValue(1);
  const labelOpacity = useSharedValue(0);

  useEffect(() => {
    if (stage === "ready") {
      countScale.value = withSpring(0.3, { damping: 14, stiffness: 130 });
      countOpacity.value = withTiming(0, { duration: 260 });
      labelOpacity.value = withDelay(220, withTiming(1, { duration: 320 }));
    } else {
      countScale.value = withSpring(1);
      countOpacity.value = withTiming(1, { duration: 160 });
      labelOpacity.value = withTiming(0, { duration: 160 });
    }
  }, [stage, countScale, countOpacity, labelOpacity]);

  const counterStyle = useAnimatedStyle(() => ({ opacity: countOpacity.value, transform: [{ scale: countScale.value }] }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: labelOpacity.value }));

  if (stage === "setup") return <Animated.Text numberOfLines={2} style={s.nucleusName}>{name}</Animated.Text>;
  if (stage === "ready") {
    return (
      <Animated.View style={[{ alignItems: "center" }, labelStyle]} testID="group-create-label">
        <Animated.Text numberOfLines={2} style={s.nucleusLabel}>{name}</Animated.Text>
        <Animated.Text numberOfLines={1} style={s.nucleusMeta}>{size} plazas</Animated.Text>
      </Animated.View>
    );
  }
  return (
    <View style={{ alignItems: "center" }}>
      <Animated.Text testID="group-create-counter" style={[s.counter, counterStyle]}>{anchored}</Animated.Text>
      <Animated.Text style={s.nucleusMeta}>de {size}</Animated.Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.md },
  input: { height: 52, marginTop: spacing.sm, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    paddingHorizontal: spacing.md, fontFamily: fonts.regular, fontSize: 16, color: c.onSurface },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.lg, marginTop: spacing.sm },
  stepBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
  counter: { fontFamily: fonts.bold, fontSize: 40, color: c.onBrandPrimary, lineHeight: 44 },
  nucleusName: { fontFamily: fonts.bold, fontSize: 15, color: c.onBrandPrimary, textAlign: "center" },
  nucleusLabel: { fontFamily: fonts.bold, fontSize: 12, color: c.onBrandPrimary, textAlign: "center" },
  nucleusMeta: { fontFamily: fonts.medium, fontSize: 10, color: c.onBrandPrimary, opacity: 0.85, textAlign: "center" },
}));
