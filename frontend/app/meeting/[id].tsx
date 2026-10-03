// Quedada Orb: spatial meeting with participant orbs, truthful ETA states, deep link "ABRIR EN SENTINEL".
import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, Share, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { OrbitalField } from "@/src/components/OrbitalField";
import { Button, Header, Pill, T, toast } from "@/src/components/ui";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const STATE_LABEL: Record<string, string> = { invitado: "Invitado", pendiente: "Pendiente", aceptado: "Aceptado", propone_otra_hora: "Propone otra hora", propone_otro_lugar: "Propone otro lugar", no_puede_acudir: "No puede acudir", preparando_salida: "Preparando salida", en_camino: "En camino", retrasado: "Retrasado", cerca: "Cerca", llegado: "Llegado" };
const MY_STATES = ["aceptado", "propone_otra_hora", "propone_otro_lugar", "no_puede_acudir", "preparando_salida", "en_camino", "retrasado", "cerca", "llegado"];
const fmt = (s: number) => (s < 60 ? `${Math.round(s)} s` : s < 3600 ? `${Math.round(s / 60)} min` : `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`);
const DAYS_L = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function fmtWhen(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${DAYS_L[d.getDay()]} ${d.getDate()} de ${MONTHS_L[d.getMonth()]} · ${hm} h`;
}

export default function Meeting() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const s = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const m = useQuery({ queryKey: ["meeting", id], queryFn: () => api<any>(`/meetings/${id}`), refetchInterval: 12000 });
  const respond = useMutation({ mutationFn: (state: string) => api(`/meetings/${id}/respond`, { method: "POST", json: { state } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["meeting", id] }), onError: (e: any) => toast(e.message, "error") });
  const close = useMutation({ mutationFn: () => api(`/meetings/${id}/close`, { method: "POST" }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["meeting", id] }); qc.invalidateQueries({ queryKey: ["groups"] }); } });
  const d = m.data;
  const me = d?.participants?.find((p: any) => p.user_id === user?.id);
  const share = async () => {
    try { await Share.share({ message: `Quedada "${d.name}"${d.destination ? ` en ${d.destination.name}` : ""}. ABRIR EN SENTINEL: ${d.deep_link}` }); } catch { toast("No se pudo abrir el diálogo de compartir"); }
  };
  return (
    <View style={s.root} testID="meeting-screen">
      <Header title={d?.name ?? "Quedada"} right={d ? <Pressable testID="meeting-share" onPress={share} style={s.iconBtn}><Ionicons name="share-social" size={18} color={colors.onSurface} /></Pressable> : undefined} />
      {d ? (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
          <View style={{ alignItems: "center", paddingVertical: spacing.md }}>
            <OrbitalField size={Math.min(width - spacing.xl * 2, 320)} phase="editing" groupName={d.name}
              members={d.participants.map((p: any) => ({ id: p.user_id, name: p.name, color: p.color, isMe: p.user_id === user?.id, status: ["invitado", "pendiente", "no_puede_acudir"].includes(p.state) ? "pending" : "active" }))}
              center={<View style={{ alignItems: "center", padding: 6 }}><Ionicons name="calendar" size={20} color={colors.onBrandPrimary} /><T weight="bold" style={{ color: colors.onBrandPrimary, fontSize: 11, textAlign: "center" }} numberOfLines={2}>{d.destination?.name?.split(",")[0] ?? "Sin lugar"}</T></View>} />
          </View>
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            <View style={s.card} testID="meeting-destination">
              <T style={{ fontSize: 11, color: colors.brandPrimary, letterSpacing: 1 }}>LUGAR</T>
              <T weight="semibold">{d.destination?.name ?? (d.place_query ? `“${d.place_query}” no se pudo geocodificar` : "Sin destino definido")}</T>
              {d.destination?.provider ? <T style={{ fontSize: 11, color: colors.muted }}>Fuente: {d.destination.provider}</T> : null}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}><Pill label={d.status === "active" ? "Activa" : "Cerrada"} tone={d.status === "active" ? "green" : "muted"} /><Pill label={d.participants.some((p: any) => p.eta?.traffic) ? "Tráfico: con datos (Mapbox)" : "Tráfico: sin datos"} tone={d.participants.some((p: any) => p.eta?.traffic) ? "blue" : "muted"} /></View>
            </View>
            {d.scheduled_at ? (
              <View style={s.card} testID="meeting-when">
                <T style={{ fontSize: 11, color: colors.brandPrimary, letterSpacing: 1 }}>CUÁNDO</T>
                <T weight="semibold" testID="meeting-when-text">{fmtWhen(d.scheduled_at)}</T>
                <T style={{ fontSize: 11, color: colors.muted }}>Duración prevista: {d.duration_min ?? 60} min</T>
              </View>
            ) : null}
            <T weight="bold" style={{ marginTop: spacing.sm }}>Participantes</T>
            {d.participants.map((p: any) => (
              <View key={p.user_id} style={s.card} testID={`participant-${p.user_id}`}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={[s.dot, { backgroundColor: p.color }]} /><T weight="semibold" style={{ flex: 1 }}>{p.name}{p.user_id === user?.id ? " (tú)" : ""}</T>
                  <Pill label={STATE_LABEL[p.state] ?? p.state} tone={p.state === "aceptado" || p.state === "llegado" ? "green" : p.state === "no_puede_acudir" ? "red" : p.state === "retrasado" ? "amber" : "muted"} />
                </View>
                <T style={{ fontSize: 12, color: colors.muted, marginTop: 4 }} testID={`participant-eta-${p.user_id}`}>
                  {p.eta?.state === "ok" ? `ETA ${fmt(p.eta.eta_s)} · ${(p.eta.distance_m / 1000).toFixed(1)} km · ${p.eta.traffic ? "con tráfico" : "sin datos de tráfico"} · ${p.eta.provider}` : p.eta?.label ?? "ETA no disponible"}
                </T>
              </View>
            ))}
            {me && d.status === "active" ? (
              <>
                <T weight="bold" style={{ marginTop: spacing.sm }}>Tu estado</T>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ height: 56 }}>
                  {MY_STATES.map((st) => (
                    <Pressable key={st} testID={`my-state-${st}`} onPress={() => respond.mutate(st)} style={[s.chip, me.state === st && s.chipOn]}>
                      <T weight="semibold" style={{ fontSize: 13, color: me.state === st ? colors.onBrandPrimary : colors.onSurface }}>{STATE_LABEL[st]}</T>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : null}
            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              <Button testID="meeting-open-link" title="Compartir · ABRIR EN SENTINEL" icon="link" variant="secondary" onPress={share} />
              {d.is_organizer && d.status === "active" ? <Button testID="meeting-close" title="Cerrar quedada" variant="ghost" onPress={() => close.mutate()} /> : null}
            </View>
            <T style={{ fontSize: 11, color: colors.muted }}>Optimización de punto de encuentro (equidad, transporte, parking, emisiones): SERVICIO NO CONFIGURADO — requiere proveedores de tráfico, transporte y parkings.</T>
          </View>
        </ScrollView>
      ) : <T style={{ padding: spacing.xl, color: colors.muted }}>{m.isError ? "Quedada no disponible" : "Cargando…"}</T>}
    </View>
  );
}
const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: c.border },
  dot: { width: 10, height: 10, borderRadius: 5 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border, flexShrink: 0 },
  chipOn: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
}));
