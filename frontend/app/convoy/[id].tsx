// CONVOY en curso — tarjeta operativa con datos reales: miembros (PostgREST) + posiciones
// en vivo del grupo (edge). Gaps por distancia al líder; estados: en formación / cerca / rezagado.
import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Button, Card, Header, Pill, T, toast } from "@/src/components/ui";
import { MapPerson } from "@/src/components/mapTypes";
import { closeConvoy, fetchConvoy, fetchConvoyMembers, gapState, joinConvoy, leaveConvoy } from "@/src/convoys";
import { distM } from "@/src/zones";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const fmtKm = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

export default function Convoy() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();

  const convoy = useQuery({ queryKey: ["convoy", id], queryFn: () => fetchConvoy(id), refetchInterval: 15000 });
  const members = useQuery({ queryKey: ["convoy-members", id], queryFn: () => fetchConvoyMembers(id), refetchInterval: 10000, enabled: !!convoy.data });
  const groupId = convoy.data?.group_id;
  const positions = useQuery({ queryKey: ["positions", groupId], enabled: !!groupId, refetchInterval: 10000, queryFn: () => api<MapPerson[]>(`/groups/${groupId}/positions`) });

  const join = useMutation({
    mutationFn: () => joinConvoy(id, groupId!, user!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["convoy-members", id] }); toast("Te has unido al convoy", "success"); },
    onError: (e: any) => toast(e.message || "No se pudo unir", "error"),
  });
  const leave = useMutation({
    mutationFn: () => leaveConvoy(id, user!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["convoy-members", id] }); toast("Has salido del convoy"); },
    onError: (e: any) => toast(e.message, "error"),
  });
  const close = useMutation({
    mutationFn: () => closeConvoy(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["convoy", id] }); qc.invalidateQueries({ queryKey: ["convoy-active"] }); toast("Convoy finalizado", "success"); },
    onError: (e: any) => toast(e.message, "error"),
  });

  const d = convoy.data;
  const mbs = members.data ?? [];
  const pos = positions.data ?? [];
  const posOf = (uid: string) => pos.find((p) => p.user_id === uid && p.state === "shared" && p.lat != null);
  const leaderMember = mbs.find((m) => m.role === "leader");
  const leaderPos = leaderMember ? posOf(leaderMember.user_id) : null;
  const isLeader = leaderMember?.user_id === user?.id;
  const inConvoy = mbs.some((m) => m.user_id === user?.id);
  const active = d?.status === "active";

  return (
    <View style={s.root} testID="convoy-screen">
      <Header title={d?.name ?? "Convoy"} onBack={() => router.back()} />
      {d ? (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
          <Card style={{ padding: spacing.lg }} testID="convoy-header">
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View style={[s.leaderDot, { backgroundColor: colors.brandPrimary }]}><Ionicons name="car-sport" size={19} color={colors.onBrandPrimary} /></View>
              <View style={{ flex: 1 }}>
                <T weight="bold" style={{ fontSize: 16 }} numberOfLines={1}>{d.dest_name ? `Hacia ${d.dest_name.split(",")[0]}` : "Convoy en marcha"}</T>
                <T style={{ fontSize: 12, color: colors.muted }}>{mbs.length} vehículo{mbs.length === 1 ? "" : "s"} · líder {leaderMember ? nameOf(leaderMember.user_id, pos, user?.id) : "—"}</T>
              </View>
              <Pill label={active ? "En curso" : "Finalizado"} tone={active ? "green" : "muted"} />
            </View>
            {leaderPos && d.dest_lat != null && d.dest_lng != null ? (
              <T style={{ fontSize: 12, color: colors.muted, marginTop: spacing.sm }} testID="convoy-dest-dist">
                El líder está a {fmtKm(distM({ lat: leaderPos.lat!, lng: leaderPos.lng! }, { lat: d.dest_lat, lng: d.dest_lng }))} del destino
              </T>
            ) : null}
          </Card>

          <T weight="bold" style={{ fontSize: 15 }}>Vehículos</T>
          {mbs.map((m) => {
            const p = posOf(m.user_id);
            const gap = m.role === "leader" ? null : p && leaderPos ? distM({ lat: p.lat!, lng: p.lng! }, { lat: leaderPos.lat!, lng: leaderPos.lng! }) : null;
            const g = m.role === "leader" ? { label: "Líder", tone: "blue" as const } : gapState(gap);
            return (
              <View key={m.user_id} style={s.row} testID={`convoy-member-${m.user_id}`}>
                <View style={[s.bar, { backgroundColor: p ? colors.success : colors.pending }]} />
                <View style={{ flex: 1 }}>
                  <T weight="semibold" style={{ fontSize: 14 }}>{nameOf(m.user_id, pos, user?.id)}{m.user_id === user?.id ? " (tú)" : ""}</T>
                  <T style={{ fontSize: 12, color: colors.muted }}>
                    {p ? (m.role === "leader" ? "posición en vivo" : `a ${fmtKm(gap!)} del líder`) : "ubicación no compartida"}
                  </T>
                </View>
                <Pill label={g.label} tone={g.tone} testID={`convoy-gap-${m.user_id}`} />
              </View>
            );
          })}
          {mbs.length <= 1 ? <T style={{ fontSize: 12.5, color: colors.muted }}>Cuando tu grupo se una verás aquí la distancia de cada vehículo al líder, actualizada cada 10 segundos.</T> : null}

          <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
            {active && !inConvoy ? <Button testID="convoy-join" title="Unirme con mi vehículo" icon="car" onPress={() => join.mutate()} loading={join.isPending} /> : null}
            <Button testID="convoy-map" title="Ver en el mapa" variant="secondary" icon="map" onPress={() => router.push("/map")} />
            {active && inConvoy && !isLeader ? <Button testID="convoy-leave" title="Salir del convoy" variant="ghost" onPress={() => leave.mutate()} loading={leave.isPending} /> : null}
            {active && isLeader ? <Button testID="convoy-close" title="Finalizar convoy" variant="ghost" icon="flag" onPress={() => close.mutate()} loading={close.isPending} /> : null}
          </View>
        </ScrollView>
      ) : (
        <T style={{ padding: spacing.xl, color: colors.muted }}>{convoy.isError ? "Convoy no disponible" : "Cargando…"}</T>
      )}
    </View>
  );
}

function nameOf(uid: string, pos: MapPerson[], myId?: string) {
  if (uid === myId) return "tú";
  return pos.find((p) => p.user_id === uid)?.name ?? "miembro";
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  leaderDot: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.card, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: c.hairline },
  bar: { width: 4, alignSelf: "stretch", borderRadius: 2 },
}));
