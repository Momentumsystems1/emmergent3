// HUD de telemetría flotante: velocidad · batería · estado (estacionado/en movimiento/en ruta).
// Solo muestra segmentos con datos reales; si no hay ninguno, no se pinta (sin ruido).
// En movimiento el borde brilla en verde suave (el teléfono "siente" que te mueves).
// Con Modo Escolta activo (escort): marco rojo SOS + "TRAYECTO PROTEGIDO".
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useTheme } from "../theme";
import type { Telemetry } from "../hooks/useTelemetry.web";

export function SensorHUD({ top, data, escort = false }: { top: number; data: Telemetry; escort?: boolean }) {
  const { colors } = useTheme();
  const { battery, speedKmh, state } = data;
  if (battery == null && speedKmh == null && !escort) return null;

  const moving = state === "ruta" || state === "movimiento";
  const stateLabel = state === "ruta" ? "EN RUTA" : state === "movimiento" ? "EN MOVIMIENTO" : "ESTACIONADO";
  const stateColor = state === "ruta" ? colors.success : state === "movimiento" ? colors.warning : colors.muted;
  const batIcon = battery == null ? "battery-half" : battery > 50 ? "battery-full" : battery > 20 ? "battery-half" : "battery-dead";

  const frame = escort
    ? { borderColor: colors.error, borderWidth: 1.5, shadowColor: colors.error, shadowOpacity: 0.35 }
    : moving
      ? { borderColor: colors.success, borderWidth: 1.5, shadowColor: colors.success, shadowOpacity: 0.3 }
      : { borderColor: colors.hairline };

  return (
    <View pointerEvents="none" style={[s.wrap, { top, backgroundColor: colors.glassStrong }, frame]} testID="sensor-hud">
      {escort && (
        <View style={s.seg}>
          <Ionicons name="shield-checkmark" size={12} color={colors.error} />
          <Text style={[s.txt, { color: colors.error, fontWeight: "700", letterSpacing: 0.4 }]} testID="hud-escort">
            TRAYECTO PROTEGIDO
          </Text>
        </View>
      )}
      {speedKmh != null && (
        <View style={s.seg}>
          <Ionicons name="navigate" size={12} color={colors.brandPrimary} />
          <Text style={[s.txt, { color: colors.onSurface }]} testID="hud-speed">{Math.round(speedKmh)} km/h</Text>
        </View>
      )}
      {battery != null && (
        <View style={s.seg}>
          <Ionicons name={batIcon} size={13} color={battery > 20 ? colors.onSurface : colors.brandPrimary} />
          <Text style={[s.txt, { color: battery > 20 ? colors.onSurface : colors.brandPrimary }]} testID="hud-battery">{battery}%</Text>
        </View>
      )}
      {!escort && state != null && (
        <View style={s.seg}>
          <View style={[s.dot, { backgroundColor: stateColor }]} />
          <Text style={[s.txt, { color: stateColor, fontWeight: "700", letterSpacing: 0.4 }]} testID="hud-state">
            {stateLabel}
          </Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 90,
    right: 90,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  } as any,
  seg: { flexDirection: "row", alignItems: "center", gap: 5 },
  txt: { fontSize: 12, fontWeight: "600", fontVariant: ["tabular-nums"] },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
