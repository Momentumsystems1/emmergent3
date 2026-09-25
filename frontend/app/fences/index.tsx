// CERCAS — lista de zonas del grupo activo: estado, radio, activar/pausar, borrar.
// Datos reales: tabla zones vía PostgREST con RLS (miembros leen; owner/admin escriben).
import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ScrollView, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { Button, Card, Header, Pill, T, toast } from "@/src/components/ui";
import { fetchGroups, fetchGroupMembers } from "@/src/groups";
import { deleteZone, fetchZoneEvents, fetchZones, setZoneActive, ZONE_KIND } from "@/src/zones";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function FencesScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { user } = useAuth();

  const groups = useQuery({ queryKey: ["groups"], queryFn: fetchGroups });
  const group: any = groups.data?.[0];
  const canManage = group?.my_role === "owner" || group?.my_role === "admin";

  const zones = useQuery({ queryKey: ["zones", group?.id], enabled: !!group, queryFn: () => fetchZones(group.id) });
  const membersQ = useQuery({ queryKey: ["group-members", group?.id], enabled: !!group, queryFn: () => fetchGroupMembers(group.id) });
  const events = useQuery({ queryKey: ["zone-events", group?.id], enabled: !!group, queryFn: () => fetchZoneEvents(group.id) });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setZoneActive(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["zones", group?.id] }),
    onError: (e: any) => toast(e.message || "No tienes permiso para cambiar esta cerca", "error"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteZone(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["zones", group?.id] }); toast("Cerca eliminada", "success"); },
    onError: (e: any) => toast(e.message || "No tienes permiso para borrar esta cerca", "error"),
  });

  const nameOf = (uid: string) => {
    if (uid === user?.id) return "Tú";
    const m = (membersQ.data ?? []).find((x: any) => x.user_id === uid);
    return m?.display_name ?? "Un miembro";
  };

  return (
    <View style={s.root} testID="fences-screen">
      <Header title="Cercas" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.md }}>
        <Card style={s.intro}>
          <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
            <View style={s.introIcon}><Ionicons name="radio-button-on" size={22} color={colors.brandPrimary} /></View>
            <T style={{ flex: 1, fontSize: 12.5, color: colors.muted }}>
              Avisos cuando alguien entra o sale. El administrador decide para quién es cada cerca y quién recibe el aviso: nunca se notifica a todo el grupo.
            </T>
          </View>
        </Card>

        {!group && groups.isSuccess ? (
          <Card style={{ padding: spacing.lg, alignItems: "flex-start", gap: spacing.sm }}>
            <T weight="semibold" style={{ fontSize: 15 }}>Primero crea tu grupo</T>
            <T style={{ fontSize: 12.5, color: colors.muted }}>Las cercas pertenecen a un grupo: son los lugares que os importan.</T>
            <Button small testID="fences-create-group" title="Crear grupo" icon="people" onPress={() => router.push("/onboarding/group")} />
          </Card>
        ) : null}

        {group ? (
          <Button testID="fences-new" title="Nueva cerca" icon="add" onPress={() => {
            if (!canManage) return toast("Solo el administrador del grupo puede crear cercas", "error");
            router.push({ pathname: "/fences/new", params: { group: group.id } });
          }} />
        ) : null}

        {zones.isLoading ? <T style={{ color: colors.muted, textAlign: "center", marginTop: spacing.lg }}>Cargando cercas…</T> : null}
        {zones.isError ? <T style={{ color: colors.muted, textAlign: "center", marginTop: spacing.lg }}>No se pudieron cargar las cercas.</T> : null}

        {(zones.data ?? []).map((z) => {
          const k = ZONE_KIND[z.kind] ?? ZONE_KIND.other;
          return (
            <Card key={z.id} style={s.zone} testID={`zone-${z.id}`}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <View style={[s.zoneIcon, !z.is_active && { backgroundColor: colors.surfaceTertiary }]}>
                  <Ionicons name={k.icon as any} size={18} color={z.is_active ? colors.brandPrimary : colors.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <T weight="semibold" style={{ fontSize: 15, flexShrink: 1 }} numberOfLines={1}>{z.name}</T>
                    <Pill label={z.is_active ? "Activa" : "Pausada"} tone={z.is_active ? "green" : "muted"} />
                  </View>
                  <T style={{ fontSize: 12, color: colors.muted, marginTop: 2 }} numberOfLines={1}>
                    {k.label} · radio {z.radius_m >= 1000 ? `${(z.radius_m / 1000).toFixed(1)} km` : `${z.radius_m} m`}{z.address_hint ? ` · ${z.address_hint}` : ""}
                  </T>
                </View>
                <Switch
                  testID={`zone-switch-${z.id}`}
                  value={z.is_active}
                  disabled={!canManage}
                  onValueChange={(v) => toggle.mutate({ id: z.id, active: v })}
                  trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }}
                />
              </View>
              {canManage ? (
                <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, alignItems: "center" }}>
                  <Button small testID={`zone-edit-${z.id}`} title="Editar" variant="secondary" icon="create" onPress={() => router.push({ pathname: "/fences/new", params: { group: group.id, zone: z.id } })} />
                  <PressableRow testID={`zone-delete-${z.id}`} label="Eliminar cerca" onPress={() => remove.mutate(z.id)} />
                </View>
              ) : null}
            </Card>
          );
        })}

        {zones.isSuccess && group && zones.data!.length === 0 ? (
          <Card style={{ padding: spacing.lg, gap: 6 }}>
            <T weight="semibold" style={{ fontSize: 15 }}>Aún no hay cercas</T>
            <T style={{ fontSize: 12.5, color: colors.muted }}>Crea la primera (casa, trabajo, colegio…) con el deslizador de diámetro sobre el mapa y elige quién recibe el aviso. También puedes mantener pulsado un punto del mapa y tocar “Cerca”.</T>
          </Card>
        ) : null}

        {(events.data ?? []).length ? (
          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            <T weight="bold" style={{ fontSize: 14 }} testID="fences-activity">Actividad reciente</T>
            {events.data!.slice(0, 10).map((e) => {
              const z = (zones.data ?? []).find((x) => x.id === e.zone_id);
              const isMe = e.user_id === user?.id;
              return (
                <View key={e.id} style={s.eventRow} testID={`zone-event-${e.id}`}>
                  <Ionicons name={e.event === "enter" ? "log-in" : "log-out"} size={15} color={e.event === "enter" ? colors.success : colors.warning} />
                  <T style={{ fontSize: 12.5, flex: 1 }} numberOfLines={1}>
                    {isMe ? "Tú has" : `${nameOf(e.user_id)} ha`} {e.event === "enter" ? "entrado en" : "salido de"} {z?.name ?? "una cerca"}
                  </T>
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function PressableRow({ label, onPress, testID }: { label: string; onPress: () => void; testID: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: spacing.sm, alignItems: "flex-start" }}>
      <Button small testID={testID} title={label} variant="ghost" icon="trash" onPress={onPress} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  intro: { padding: spacing.md },
  introIcon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: c.brandSoft, alignItems: "center", justifyContent: "center" },
  zone: { padding: spacing.md },
  zoneIcon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: c.brandSoft, alignItems: "center", justifyContent: "center" },
  eventRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 8, paddingHorizontal: spacing.md, backgroundColor: c.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.hairline },
}));
