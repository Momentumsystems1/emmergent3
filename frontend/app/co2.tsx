// CO2 y sostenibilidad — contador real del día: distancia del grupo calculada del trail
// de ubicaciones y CO2 evitado estimado (km sin coche × 0,12 kg/km). Sin datos, lo dice.
import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { Card, Header, T } from "@/src/components/ui";
import { CO2_PER_KM, fetchTodayTrail, summarizeTrail } from "@/src/co2";
import { fetchGroups } from "@/src/groups";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Co2Screen() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const groups = useQuery({ queryKey: ["groups"], queryFn: fetchGroups });
  const group: any = groups.data?.[0];
  const trail = useQuery({
    queryKey: ["co2-trail", group?.id],
    enabled: !!group,
    refetchInterval: 60000,
    queryFn: () => fetchTodayTrail(group.id),
  });

  const sum = trail.data ? summarizeTrail(trail.data) : null;
  const hasData = !!sum && sum.kmTotal >= 0.05;

  return (
    <View style={s.root} testID="co2-screen">
      <Header title="CO₂ y sostenibilidad" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
        <Card style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl }} testID="co2-card">
          <View style={[s.leaf, { backgroundColor: colors.successSoft }]}>
            <Ionicons name="leaf" size={26} color={colors.onSuccessSoft} />
          </View>
          {hasData ? (
            <>
              <T weight="bold" style={{ fontSize: 34, letterSpacing: -0.5, color: colors.onSuccessSoft }} testID="co2-kg">
                {sum!.kgCo2.toFixed(2)} kg
              </T>
              <T style={{ textAlign: "center", fontSize: 14 }}>
                Tu clúster ha evitado hoy ~{sum!.kgCo2.toFixed(2)} kg de emisiones de CO₂
              </T>
              <T style={{ textAlign: "center", fontSize: 12, color: colors.muted }} testID="co2-detail">
                {sum!.kmClean.toFixed(1)} km sin coche de {sum!.kmTotal.toFixed(1)} km recorridos
                {sum!.members > 1 ? ` entre ${sum!.members} miembros` : ""}
              </T>
            </>
          ) : (
            <>
              <T weight="bold" style={{ fontSize: 16, textAlign: "center" }} testID="co2-empty">
                Hoy aún no hay recorrido registrado
              </T>
              <T style={{ textAlign: "center", fontSize: 12, color: colors.muted }}>
                En cuanto el clúster se mueva con la ubicación compartida, aquí verás los km y el CO₂ evitado.
              </T>
            </>
          )}
        </Card>

        <Card style={{ gap: 6 }} testID="co2-method">
          <T weight="semibold" style={{ fontSize: 13 }}>Cómo lo calculamos</T>
          <T style={{ fontSize: 12, color: colors.muted, lineHeight: 18 }}>
            Sumamos la distancia real recorrida hoy por el grupo (puntos de ubicación compartidos) y contamos como
            «evitados» los kilómetros hechos a pie o en bici: {CO2_PER_KM} kg de CO₂ por km, la emisión media de un
            turismo. Es una estimación honesta, no un dato de marketing: solo usa movimientos reales de hoy.
          </T>
        </Card>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  leaf: { width: 56, height: 56, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
}));
