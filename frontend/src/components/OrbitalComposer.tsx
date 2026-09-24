// OrbitalComposer — "El compositor orbital": creación de círculos como ritual de 5 fases.
// 1) Onda sónica (~400 ms): un anillo sale del núcleo hasta el borde y vuelve.
// 2) Órbita (~500 ms): aparece el anillo de órbita (giro suave, acotado) y la etiqueta con el nombre.
// 3) Reglas (~300 ms): doce marcas de reloj entran escalonadas; la de las 12:00 es la puerta de entrada de miembros.
// 4) La cola de las 12:00 (continua): los invitados entran por las 12:00 — pendiente tenue, aceptado sólido.
//    La cubre OrbitalField en la tarjeta del grupo ya formada; aquí queda la marca de las 12:00 como umbral.
// 5) Compresión del átomo (~400 ms): al confirmarse la creación, la órbita se comprime hacia el núcleo — snap —
//    y la escena cede el paso a la tarjeta final del grupo, ya viva (la pinta el padre con GroupCard/OrbitalField).
// Estados: vacío (núcleo que respira) / cargando (halo ∝ texto + chips de sugerencia) / formando / error (shake, mantiene el nombre).
// Límites duros: ninguna fase >600 ms, sin bucles eternos (todo se cancela al cambiar de fase o desmontar),
// solo hápticos (nada de sonido), respeta "reducir animaciones" del SO (crossfades cortos), 60 fps en gama media.
import Ionicons from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Platform, Pressable, Text, TextInput, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";

import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export type OrbitalComposerPhase = "vacío" | "cargando" | "formando" | "comprimiendo" | "error";

const SUGGESTIONS = ["Familia", "Amigos", "Pareja", "Trabajo"];
// Duraciones de las fases — ninguna supera 600 ms.
const D = { sonar: 400, orbita: 500, reglas: 300, compresion: 400 } as const;
const RITUAL_MS = D.sonar + D.orbita + D.reglas; // 1200 ms

type Props = {
  size: number;
  hint?: string;
  embedded?: boolean;
  testID?: string;
  onCreate: (name: string) => Promise<unknown>;
  onDone?: () => void;
};

const buzzImpact = (style: Haptics.ImpactFeedbackStyle) => { if (Platform.OS !== "web") Haptics.impactAsync(style).catch(() => {}); };
const buzzNotify = (type: Haptics.NotificationFeedbackType) => { if (Platform.OS !== "web") Haptics.notificationAsync(type).catch(() => {}); };

export function OrbitalComposer({ size, hint, testID, onCreate, onDone }: Props) {
  const s = useStyles();
  const { colors } = useTheme();
  const [name, setName] = useState("");
  const [phase, setPhase] = useState<OrbitalComposerPhase>("vacío");
  const [reduceMotion, setReduceMotion] = useState(false);
  const mounted = useRef(true);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // --- valores compartidos ---
  const breathe = useSharedValue(1);        // núcleo respirando (vacío)
  const halo = useSharedValue(0);           // halo ∝ longitud del texto (cargando)
  const sonarScale = useSharedValue(0.25);  // fase 1
  const sonarOpacity = useSharedValue(0);
  const nucleusScale = useSharedValue(1);
  const fieldOpacity = useSharedValue(0);   // campo de fondo
  const ringOpacity = useSharedValue(0);    // fase 2
  const ringSpin = useSharedValue(0);       // giro acotado (no infinito)
  const labelOpacity = useSharedValue(0);   // nombre en el núcleo
  const stageScale = useSharedValue(1);     // fase 5 compresión
  const stageOpacity = useSharedValue(1);
  const shakeX = useSharedValue(0);         // error

  const later = (fn: () => void, ms: number) => { const t = setTimeout(() => { if (mounted.current) fn(); }, ms); timers.current.push(t); };
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; timers.current.forEach(clearTimeout); };
  }, []);

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { if (live) setReduceMotion(!!v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged" as never, (v: boolean) => setReduceMotion(!!v) as never);
    return () => { live = false; (sub as { remove?: () => void } | undefined)?.remove?.(); };
  }, []);

  const busy = phase === "formando" || phase === "comprimiendo";

  // --- máquina de fases ---
  useEffect(() => {
    if (phase === "vacío") {
      // reset completo de la escena al volver a vacío
      ringOpacity.value = withTiming(0, { duration: 120 });
      fieldOpacity.value = withTiming(0, { duration: 120 });
      labelOpacity.value = withTiming(0, { duration: 120 });
      stageScale.value = withTiming(1, { duration: 120 });
      stageOpacity.value = withTiming(1, { duration: 120 });
      sonarOpacity.value = withTiming(0, { duration: 120 });
      if (reduceMotion) { breathe.value = 1; return; }
      breathe.value = 1;
      breathe.value = withRepeat(withSequence(
        withTiming(1.07, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      ), -1, false);
      return () => cancelAnimation(breathe);
    }
    if (phase === "formando") {
      // fase 1: onda sónica
      sonarScale.value = 0.25;
      sonarOpacity.value = 0.85;
      sonarScale.value = withTiming(1.18, { duration: reduceMotion ? 150 : D.sonar, easing: Easing.out(Easing.quad) });
      sonarOpacity.value = withTiming(0, { duration: reduceMotion ? 150 : D.sonar });
      nucleusScale.value = withSequence(withTiming(1.16, { duration: 180 }), withTiming(1, { duration: 200 }));
      // fase 2: órbita + etiqueta (tras la onda)
      fieldOpacity.value = withDelay(reduceMotion ? 0 : D.sonar - 120, withTiming(1, { duration: reduceMotion ? 150 : D.orbita }));
      ringOpacity.value = withDelay(reduceMotion ? 0 : D.sonar, withTiming(1, { duration: reduceMotion ? 150 : D.orbita, easing: Easing.out(Easing.quad) }));
      ringSpin.value = withDelay(reduceMotion ? 0 : D.sonar, withTiming(0.9, { duration: reduceMotion ? 150 : D.orbita + D.reglas + D.compresion, easing: Easing.inOut(Easing.quad) }));
      labelOpacity.value = withDelay(reduceMotion ? 0 : D.sonar + 140, withTiming(1, { duration: reduceMotion ? 150 : 320 }));
      return undefined;
    }
    if (phase === "comprimiendo") {
      // fase 5: compresión del átomo
      stageScale.value = withTiming(0.1, { duration: reduceMotion ? 150 : D.compresion, easing: Easing.in(Easing.cubic) });
      stageOpacity.value = withTiming(0, { duration: reduceMotion ? 150 : D.compresion });
      return undefined;
    }
    if (phase === "error") {
      // se conserva el nombre, pero la escena del ritual vuelve a cero
      shakeX.value = withSequence(withTiming(-9, { duration: 60 }), withTiming(9, { duration: 90 }), withTiming(-6, { duration: 80 }), withTiming(6, { duration: 70 }), withTiming(0, { duration: 60 }));
      ringOpacity.value = withTiming(0, { duration: 140 });
      fieldOpacity.value = withTiming(0, { duration: 140 });
      labelOpacity.value = withTiming(0, { duration: 140 });
      stageScale.value = withTiming(1, { duration: 140 });
      stageOpacity.value = withTiming(1, { duration: 140 });
      sonarOpacity.value = withTiming(0, { duration: 140 });
      return undefined;
    }
    return undefined;
  }, [phase, reduceMotion, breathe, sonarScale, sonarOpacity, nucleusScale, fieldOpacity, ringOpacity, ringSpin, labelOpacity, stageScale, stageOpacity, shakeX]);

  // halo proporcional al texto en cuanto se escribe (vacío → cargando)
  useEffect(() => {
    const target = Math.min(1, name.trim().length / 14);
    halo.value = withTiming(target, { duration: 180 });
    setPhase((p) => (p === "vacío" && name.trim().length > 0 ? "cargando" : p === "cargando" && name.trim().length === 0 ? "vacío" : p));
  }, [name, halo]);

  const submit = () => {
    const n = name.trim();
    if (!n || busy) return;
    setPhase("formando");
    buzzImpact(Haptics.ImpactFeedbackStyle.Light);
    const ritual = new Promise<void>((res) => later(res, reduceMotion ? 160 : RITUAL_MS));
    Promise.all([onCreate(n), ritual])
      .then(() => {
        setPhase("comprimiendo");
        buzzNotify(Haptics.NotificationFeedbackType.Success);
        later(() => { setName(""); setPhase("vacío"); onDone?.(); }, reduceMotion ? 170 : D.compresion + 40);
      })
      .catch(() => {
        setPhase("error"); // mantiene el nombre
        buzzNotify(Haptics.NotificationFeedbackType.Error);
        later(() => setPhase(name.trim() ? "cargando" : "vacío"), 650);
      });
  };

  // --- estilos animados ---
  const stageStyle = useAnimatedStyle(() => ({ transform: [{ scale: stageScale.value * nucleusScale.value }, { translateX: shakeX.value }], opacity: stageOpacity.value }));
  const fieldStyle = useAnimatedStyle(() => ({ opacity: fieldOpacity.value }));
  const ringRotate = useAnimatedStyle(() => ({ transform: [{ rotate: `${ringSpin.value}rad` }] }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: ringOpacity.value }));
  const sonarStyle = useAnimatedStyle(() => ({ transform: [{ scale: sonarScale.value }], opacity: sonarOpacity.value }));
  const breatheStyle = useAnimatedStyle(() => ({ transform: [{ scale: breathe.value }] }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: 0.25 + halo.value * 0.75, transform: [{ scale: 1 + halo.value * 0.5 }] }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: labelOpacity.value }));

  const r = size * 0.36;
  const nucleusSize = size * 0.34;
  const composing = phase === "vacío" || phase === "cargando" || phase === "error";

  return (
    <View style={s.card} testID={testID ?? "orbital-composer"}>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
      <Animated.View style={[{ width: size, height: size, alignSelf: "center" }, stageStyle]}>
        {/* campo + anillo de órbita */}
        <Animated.View style={[s.field, { width: size, height: size, borderRadius: size / 2 }, fieldStyle]} pointerEvents="none" />
        <Animated.View style={[{ position: "absolute", left: size / 2 - r, top: size / 2 - r }, ringRotate]} pointerEvents="none">
          <Animated.View style={[s.ring, { width: r * 2, height: r * 2, borderRadius: r }, ringStyle]} />
        </Animated.View>
        {/* fase 3: reglas (12 marcas, la de las 12:00 es la puerta) */}
        <Ticks show={phase === "formando"} resetKey={phase} r={r} center={size / 2} reduceMotion={reduceMotion} />
        {/* fase 1: onda sónica */}
        <Animated.View style={[s.sonar, { width: size, height: size, borderRadius: size / 2 }, sonarStyle]} pointerEvents="none" />
        {/* núcleo: halo (cargando) + respiración (vacío) + etiqueta con nombre (formando) */}
        <View style={{ position: "absolute", left: size / 2 - nucleusSize / 2, top: size / 2 - nucleusSize / 2, width: nucleusSize, height: nucleusSize }}>
          <Animated.View style={[s.halo, { width: nucleusSize, height: nucleusSize, borderRadius: nucleusSize / 2 }, haloStyle]} pointerEvents="none" />
          <Animated.View style={[s.nucleus, { width: nucleusSize, height: nucleusSize, borderRadius: nucleusSize / 2 }, breatheStyle]} testID="composer-nucleus">
            <Animated.View style={[{ alignItems: "center", justifyContent: "center", flex: 1, padding: 8 }, labelStyle]}>
              <Text style={s.nucleusText} numberOfLines={2}>{name.trim() || "—"}</Text>
            </Animated.View>
            {composing ? <View style={s.nucleusIdle}><Ionicons name="planet" size={26} color={colors.onBrandPrimary} /></View> : null}
          </Animated.View>
        </View>
      </Animated.View>

      <Text style={s.caption} testID="composer-caption">
        {phase === "formando" ? "Formando el círculo…" : phase === "comprimiendo" ? "" : phase === "error" ? "No se pudo crear. Inténtalo de nuevo." : "El nombre queda dentro del núcleo. Los miembros entrarán por las 12:00."}
      </Text>

      {composing ? (
        <View style={s.chips} testID="composer-suggestions">
          {SUGGESTIONS.map((x) => (
            <Pressable key={x} testID={`composer-suggestion-${x.toLowerCase()}`} onPress={() => setName(x)} style={s.chip} hitSlop={4}>
              <Text style={s.chipText}>{x}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {composing || phase === "formando" ? (
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
          <TextInput
            testID="new-group-name"
            style={s.input}
            placeholder="Nombre del círculo (p. ej. Familia)"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
            editable={!busy}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          <Pressable
            testID="new-group-create"
            onPress={submit}
            disabled={busy || !name.trim()}
            accessibilityState={{ busy }}
            style={[s.addBtn, (busy || !name.trim()) && { opacity: 0.55 }]}
          >
            {busy ? <Ionicons name="ellipsis-horizontal" size={22} color={colors.onBrandPrimary} /> : <Ionicons name="add" size={22} color={colors.onBrandPrimary} />}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** Doce marcas de reloj sobre el anillo; la de las 12:00 (índice 0) es la puerta de entrada de miembros. */
function Ticks({ show, resetKey, r, center, reduceMotion }: { show: boolean; resetKey: string; r: number; center: number; reduceMotion: boolean }) {
  const s = useStyles();
  const { colors } = useTheme();
  const tick = useSharedValue(0);
  useEffect(() => {
    if (show) tick.value = withTiming(1, { duration: reduceMotion ? 150 : D.reglas });
    else tick.value = withTiming(0, { duration: 100 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, resetKey, reduceMotion, tick]);
  const style = useAnimatedStyle(() => ({ opacity: tick.value, transform: [{ scale: 0.4 + tick.value * 0.6 }] }));
  return (
    <>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 12 - Math.PI / 2;
        const x = center + Math.cos(a) * r;
        const y = center + Math.sin(a) * r;
        const door = i === 0; // las 12:00
        return (
          <Animated.View
            key={i}
            testID={door ? "composer-door-1200" : undefined}
            style={[
              s.tick,
              { left: x - 1.5, top: y - (door ? 8 : 5), height: door ? 16 : 10, backgroundColor: door ? colors.brandPrimary : colors.borderStrong },
              style,
            ]}
          />
        );
      })}
    </>
  );
}

const useStyles = makeStyles((c) => ({
  card: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: c.borderStrong, borderStyle: "dashed", padding: spacing.md, gap: spacing.sm },
  hint: { fontFamily: fonts.bold, fontSize: 16, color: c.onSurface },
  field: { position: "absolute", left: 0, top: 0, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    shadowColor: c.surfaceInverse, shadowOpacity: 0.08, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 2 },
  ring: { borderWidth: 1.5, borderColor: c.brandPrimary, borderStyle: "dashed" },
  sonar: { position: "absolute", left: 0, top: 0, borderWidth: 2, borderColor: c.orbCore },
  halo: { position: "absolute", left: 0, top: 0, backgroundColor: c.orbHalo },
  nucleus: { backgroundColor: c.orbCore, alignItems: "center", justifyContent: "center",
    shadowColor: c.orbCore, shadowOpacity: 0.5, shadowRadius: 22, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  nucleusIdle: { position: "absolute", alignItems: "center", justifyContent: "center" },
  nucleusText: { fontFamily: fonts.bold, color: c.onBrandPrimary, fontSize: 14, textAlign: "center" },
  tick: { position: "absolute", width: 3, borderRadius: 2 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: c.muted, textAlign: "center", minHeight: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, height: 34, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: c.onSurface },
  input: { flex: 1, height: 48, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.md, fontFamily: fonts.regular, fontSize: 15, color: c.onSurface },
  addBtn: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
}));
