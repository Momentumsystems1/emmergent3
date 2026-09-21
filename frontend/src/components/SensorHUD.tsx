// HUD de telemetría flotante: velocidad · batería · estado (parado/en movimiento/en ruta).
// Solo muestra segmentos con datos reales; si no hay ninguno, no se pinta (sin ruido).
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useTheme } from "../theme";
import { useTelemetry } from "../hooks/useTelemetry";

export function SensorHUD({ top }: { top: number }) {
  const { colors } = useTheme();
  const { battery, speedKmh, state } = useTelemetry(true);
  if (battery == null && speedKmh == null) return null;

  const stateLabel = state === "ruta" ? "EN RUTA" : state === "movimiento" ? "EN MOVIMIENTO" : "PARADO";
  const stateColor = state === "ruta" ? colors.success : state === "movimiento" ? colors.warning : colors.muted;
  const batIcon = battery == null ? "battery-half" : battery > 50 ? "battery-full" : battery > 20 ? "battery-half" : "battery-dead";

  return (
    <View pointerEvents="none" style={[s.wrap, { top, backgroundColor: colors.glassStrong, borderColor: colors.hairline }]} testID="sensor-hud">
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
      {state != null && (
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
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  } as any,
  seg: { flexDirection: "row", alignItems: "center", gap: 5 },
  txt: { fontSize: 12, fontWeight: "600", fontVariant: ["tabular-nums"] },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
