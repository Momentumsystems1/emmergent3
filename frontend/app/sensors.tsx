// SENSORES — estado en vivo del hardware + calibración guiada en 2 pasos.
// Web: DeviceMotion/DeviceOrientation (iOS pide permiso con gesto). Nativo: expo-sensors.
// La calibración guarda una baseline local (gravedad en reposo) y su fecha; nada sale del dispositivo.
import Ionicons from "@react-native-vector-icons/ionicons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Card, Header, Pill, T, toast } from "@/src/components/ui";
import { useMotion, Vec3 } from "@/src/hooks/useMotion";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";

type Calib = { g: number; at: string };
const CAL_KEY = "sentinel.sensor_cal";
const mag = (v: Vec3 | null) => (v ? Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) : null);

type Step = "idle" | "flat" | "eight" | "done";

export default function SensorsScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const motion = useMotion(true);
  const [step, setStep] = useState<Step>("idle");
  const [calib, setCalib] = useState<Calib | null>(null);
  const [gps, setGps] = useState<{ accuracy: number | null; at: number } | null>(null);
  const samples = useRef<number[]>([]);
  const gyroMoved = useRef(false);

  useEffect(() => { storage.getItem<string | null>(CAL_KEY, null).then((raw) => { try { if (raw) setCalib(JSON.parse(raw)); } catch { /* corrupto: se ignora */ } }); }, []);

  // GPS: precisión real del fix actual (web: geolocation del navegador).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (alive) setGps({ accuracy: p.coords.accuracy ?? null, at: Date.now() });
      } catch { /* sin GPS: la tarjeta muestra "sin señal" */ }
    })();
    return () => { alive = false; };
  }, []);

  // Captura de calibración según el paso activo.
  useEffect(() => {
    if (step === "flat" && motion.accel) {
      const m = mag(motion.accel);
      if (m != null) {
        samples.current.push(m);
        if (samples.current.length >= 10) {
          const xs = samples.current.slice(-10);
          const avg = xs.reduce((a, b) => a + b, 0) / xs.length;
          const variance = xs.reduce((a, b) => a + (b - avg) ** 2, 0) / xs.length;
          if (variance > 0.35) { toast("El móvil se está moviendo. Déjalo quieto sobre una superficie plana.", "error"); samples.current = []; return; }
          if (avg < 8.6 || avg > 11) { toast(`Lectura rara (${avg.toFixed(2)} m/s²). Prueba otra superficie.`, "error"); samples.current = []; return; }
          const c: Calib = { g: Number(avg.toFixed(3)), at: new Date().toISOString() };
          setCalib(c); storage.setItem(CAL_KEY, JSON.stringify(c));
          samples.current = []; setStep("eight");
        }
      }
    }
    if (step === "eight" && motion.gyro) {
      const g = mag(motion.gyro);
      if (g != null && g > 90) gyroMoved.current = true; // giro claro detectado
      if (gyroMoved.current && g != null && g < 15) { setStep("done"); toast("Calibración completada", "success"); }
    }
  }, [step, motion.accel, motion.gyro]);

  const gNow = mag(motion.accel);
  const gyroNow = mag(motion.gyro);
  const drift = calib && gNow != null ? Math.abs(gNow - calib.g) : null;
  const supported = motion.permission !== "unsupported";
  const needsPermission = motion.permission === "prompt";
  const health: { label: string; tone: "green" | "amber" | "red" | "muted"; icon: string } =
    !supported ? { label: "Sin sensores en este dispositivo", tone: "muted", icon: "phone-portrait-outline" }
    : motion.permission === "denied" ? { label: "Permiso de sensores denegado", tone: "red", icon: "alert-circle" }
    : needsPermission ? { label: "Toca “Activar sensores” para empezar", tone: "amber", icon: "hand-left" }
    : !motion.accel ? { label: "Esperando lecturas…", tone: "amber", icon: "sync" }
    : calib && drift != null && drift < 0.6 ? { label: "Sensores en orden", tone: "green", icon: "checkmark-circle" }
    : { label: "Funcionando — calibra para afinar", tone: "amber", icon: "warning" };

  return (
    <View style={s.root} testID="sensors-screen">
      <Header title="Sensores" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.md }}>
        {/* Estado general */}
        <Card style={s.hero} testID="sensors-health">
          <View style={s.heroRow}>
            <View style={[s.heroIcon, { backgroundColor: health.tone === "green" ? colors.successSoft : health.tone === "red" ? colors.errorSoft : colors.warningSoft }]}>
              <Ionicons name={health.icon as any} size={22} color={health.tone === "green" ? colors.onSuccessSoft : health.tone === "red" ? colors.onErrorSoft : colors.onWarningSoft} />
            </View>
            <View style={{ flex: 1 }}>
              <T weight="bold" style={{ fontSize: 16 }} testID="sensors-health-label">{health.label}</T>
              <T style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                {calib ? `Última calibración: ${new Date(calib.at).toLocaleString("es")} · gravedad en reposo ${calib.g.toFixed(2)} m/s²` : "Aún no has calibrado este dispositivo."}
              </T>
            </View>
          </View>
          {needsPermission && supported ? (
            <View style={{ marginTop: spacing.md }}>
              <Button small testID="sensors-enable" title="Activar sensores" icon="hand-left" onPress={async () => { const ok = await motion.request(); if (!ok) toast("Permiso denegado. Actívalo en los ajustes del navegador.", "error"); }} />
            </View>
          ) : null}
        </Card>

        {/* Lecturas en vivo */}
        <View style={s.grid}>
          <SensorCard testID="sensor-accel" icon="speedometer" title="Acelerómetro" ok={motion.accel != null}
            value={motion.accel ? `${gNow!.toFixed(2)} m/s²` : "—"}
            sub={motion.accel ? `x ${motion.accel.x.toFixed(1)} · y ${motion.accel.y.toFixed(1)} · z ${motion.accel.z.toFixed(1)}` : "Sin señal"}
            extra={calib && drift != null ? `deriva ${drift.toFixed(2)}` : undefined} />
          <SensorCard testID="sensor-gyro" icon="refresh" title="Giroscopio" ok={motion.gyro != null}
            value={motion.gyro ? `${gyroNow!.toFixed(0)} °/s` : "—"}
            sub={motion.gyro ? `x ${motion.gyro.x.toFixed(0)} · y ${motion.gyro.y.toFixed(0)} · z ${motion.gyro.z.toFixed(0)}` : "Sin señal"} />
          <SensorCard testID="sensor-compass" icon="compass" title="Brújula" ok={motion.heading != null}
            value={motion.heading != null ? `${motion.heading}°` : "—"}
            sub={motion.heading != null ? cardinal(motion.heading) : "Sin señal"} />
          <SensorCard testID="sensor-gps" icon="locate" title="GPS" ok={gps != null}
            value={gps?.accuracy != null ? `±${Math.round(gps.accuracy)} m` : "—"}
            sub={gps ? "precisión del último fix" : "Sin señal"} />
        </View>

        {/* Calibración guiada */}
        {supported ? (
          <Card style={{ padding: spacing.lg }} testID="sensors-calibration">
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <T weight="bold" style={{ fontSize: 15, flex: 1 }}>Calibración guiada</T>
              <Pill label={step === "idle" ? "2 pasos · 30 s" : step === "done" ? "Completada" : `Paso ${step === "flat" ? 1 : 2} de 2`} tone={step === "done" ? "green" : "amber"} />
            </View>
            {step === "idle" ? (
              <>
                <T style={{ fontSize: 12.5, color: colors.muted, marginTop: spacing.sm }}>Ajustamos el punto de reposo del acelerómetro y comprobamos que el giroscopio responde. Mejora la detección de conducción y las migas de pan.</T>
                <View style={{ marginTop: spacing.md }}><Button small testID="calib-start" title="Empezar calibración" icon="options" onPress={() => { if (needsPermission) { toast("Primero activa los sensores", "error"); return; } samples.current = []; gyroMoved.current = false; setStep("flat"); }} /></View>
              </>
            ) : null}
            {step === "flat" ? (
              <Animated.View entering={FadeInDown} style={{ marginTop: spacing.sm }}>
                <CalibStep n={1} title="Móvil quieto y plano" text="Déjalo sobre una mesa 3 segundos. Capturando la gravedad en reposo…" progress={Math.min(1, samples.current.length / 10)} live={gNow != null ? `${gNow.toFixed(2)} m/s²` : "esperando…"} />
              </Animated.View>
            ) : null}
            {step === "eight" ? (
              <Animated.View entering={FadeInDown} style={{ marginTop: spacing.sm }}>
                <CalibStep n={2} title="Dibuja un 8 en el aire" text="Coge el móvil y traza un ochо grande dos veces. Detectaremos el giro…" progress={gyroMoved.current ? 0.6 : 0.15} live={gyroNow != null ? `${gyroNow.toFixed(0)} °/s` : "esperando…"} />
              </Animated.View>
            ) : null}
            {step === "done" ? (
              <Animated.View entering={FadeInDown} style={{ marginTop: spacing.sm }}>
                <View style={s.doneRow}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <T weight="semibold" style={{ fontSize: 14, flex: 1 }} testID="calib-done">Calibración guardada en este dispositivo</T>
                </View>
                <T style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>Puedes repetirla cuando cambies de funda, soporte de coche o notes lecturas raras.</T>
                <View style={{ marginTop: spacing.md }}><Button small testID="calib-again" title="Repetir" variant="ghost" onPress={() => { samples.current = []; gyroMoved.current = false; setStep("flat"); }} /></View>
              </Animated.View>
            ) : null}
          </Card>
        ) : (
          <Card style={{ padding: spacing.lg }}>
            <T weight="semibold" style={{ fontSize: 14 }}>Este navegador no expone sensores de movimiento</T>
            <T style={{ fontSize: 12.5, color: colors.muted, marginTop: 4 }}>Ábrelo en tu móvil (o en la app instalada) para ver acelerómetro, giroscopio y brújula en vivo y calibrarlos.</T>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function cardinal(h: number) {
  const dirs = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  return dirs[Math.round(h / 45) % 8];
}

function SensorCard({ icon, title, value, sub, extra, ok, testID }: { icon: string; title: string; value: string; sub: string; extra?: string; ok: boolean; testID: string }) {
  const s = useStyles(); const { colors } = useTheme();
  return (
    <Card style={s.sensor} testID={testID}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name={icon as any} size={15} color={ok ? colors.brandPrimary : colors.muted} />
        <T weight="semibold" style={{ fontSize: 12, color: colors.muted }}>{title}</T>
        <View style={[s.dot, { backgroundColor: ok ? colors.success : colors.pending }]} />
      </View>
      <T weight="bold" style={{ fontSize: 19, marginTop: 6 }}>{value}</T>
      <T style={{ fontSize: 11, color: colors.muted, marginTop: 2 }} numberOfLines={1}>{sub}</T>
      {extra ? <T style={{ fontSize: 11, color: colors.success, marginTop: 2 }}>{extra}</T> : null}
    </Card>
  );
}

function CalibStep({ n, title, text, progress, live }: { n: number; title: string; text: string; progress: number; live: string }) {
  const s = useStyles(); const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <View style={s.stepBadge}><T weight="bold" style={{ color: colors.onBrandPrimary, fontSize: 12 }}>{n}</T></View>
        <T weight="semibold" style={{ fontSize: 14, flex: 1 }}>{title}</T>
        <T style={{ fontSize: 12, color: colors.brandPrimary, fontVariant: ["tabular-nums"] }}>{live}</T>
      </View>
      <T style={{ fontSize: 12, color: colors.muted }}>{text}</T>
      <View style={s.track}><View style={[s.fill, { width: `${Math.round(progress * 100)}%` }]} /></View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  hero: { padding: spacing.lg },
  heroRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  heroIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  sensor: { flexBasis: "46%", flexGrow: 1, padding: spacing.md },
  dot: { width: 7, height: 7, borderRadius: 4, marginLeft: "auto" },
  stepBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  track: { height: 6, borderRadius: 3, backgroundColor: c.surfaceTertiary, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3, backgroundColor: c.brandPrimary },
  doneRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
}));
