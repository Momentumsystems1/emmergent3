// Person Orb: contextual actions for a member, gated by consent and truthful data.
import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Linking, Pressable, ScrollView, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { PersonAvatar } from "@/src/components/orbs";
import { Header, Pill, T, toast } from "@/src/components/ui";
import { PERSON_ACTIONS } from "@/src/copy";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Person() {
  const { id, group } = useLocalSearchParams<{ id: string; group: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const positions = useQuery({ queryKey: ["positions", group], queryFn: () => api<any[]>(`/groups/${group}/positions`), refetchInterval: 10000 });
  const g = useQuery({ queryKey: ["group", group], queryFn: () => api<any>(`/groups/${group}`) });
  const p = positions.data?.find((x) => x.member_id === id);
  const m = g.data?.members?.find((x: any) => x.id === id);
  const name = p?.name ?? m?.display_name ?? "Persona";
  const color = p?.color ?? m?.color ?? colors.brandPrimary;

  const run = async (key: string) => {
    switch (key) {
      case "estado": return toast(p?.state === "shared" ? `Estado: ${p.status ?? "no compartido"} · ${p.mobility_mode ?? "modo desconocido"} · ${new Date(p.at).toLocaleTimeString("es-ES")}` : p?.label ?? "Ubicación no compartida");
      case "reunirse": return router.push({ pathname: "/meeting/new", params: { group } });
      case "ir_hasta": return p?.state === "shared" ? router.push({ pathname: "/navigate", params: { lat: String(p.lat), lng: String(p.lng), place: name } }) : toast("Esta persona no comparte ubicación");
      case "seguir": return p?.state === "shared" ? router.push({ pathname: "/convoy/new", params: { group, lat: String(p.lat), lng: String(p.lng), place: name } }) : toast("Esta persona no comparte ubicación");
      case "todo_bien": case "incidencia":
        try { await api("/events", { method: "POST", json: { group_id: group, kind: key === "todo_bien" ? "checkin" : "incident", severity: key === "todo_bien" ? "info" : "warning", target_user_id: p?.user_id ?? m?.user_id, message: key === "todo_bien" ? `¿Todo bien, ${name}?` : `Incidencia relacionada con ${name}` } }); return toast("Enviado al grupo con trazabilidad", "success"); } catch (e: any) { return toast(e.message, "error"); }
      case "mensaje": return Linking.openURL(`sms:?&body=${encodeURIComponent(`Hola ${name}, te escribo desde MY CLUSTER.`)}`).catch(() => toast("Mensajes no disponible"));
      case "comparticion": return router.push("/privacy");
      case "actividad": return router.push(`/group/${group}?tab=events`);
      default: return toast("Función en preparación");
    }
  };

  return (
    <View style={s.root} testID="person-screen">
      <Header title={name} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        <View style={{ alignItems: "center", gap: spacing.md }}>
          <Animated.View entering={ZoomIn.springify()}><PersonAvatar name={name} color={color} size={84} state={p?.state ?? "not_shared"} /></Animated.View>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <Pill testID="person-location-state" label={p?.state === "shared" ? `Ubicación ${p.precision === "exact" ? "exacta" : "aproximada"}` : p?.label ?? m?.location_state === "pending_invitation" ? "Invitación pendiente" : "Ubicación no compartida"} tone={p?.state === "shared" ? "green" : "muted"} />
            {p?.state === "shared" ? <Pill label={`Actualizado ${new Date(p.at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`} tone="blue" /> : null}
            {m ? <Pill label={m.role} tone="violet" /> : null}
          </View>
        </View>
        <View style={s.grid}>
          {PERSON_ACTIONS.map((a, i) => (
            <Animated.View key={a.key} entering={ZoomIn.delay(25 * i).springify().damping(16)} style={s.cell}>
              <Pressable testID={`person-action-${a.key}`} onPress={() => run(a.key)} style={s.action}>
                <View style={[s.iconWrap, { backgroundColor: color + "22" }]}><Ionicons name={a.icon as any} size={20} color={color} /></View>
                <T weight="medium" style={{ fontSize: 12, textAlign: "center" }} numberOfLines={2}>{a.label}</T>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xl },
  cell: { width: "31%", flexGrow: 1 },
  action: { backgroundColor: c.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.md, alignItems: "center", gap: 8, minHeight: 96 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
}));
