// Per-member mobility tools, opened from the right-side rectangle. Black-blur bottom card (never covers the whole map).
import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { Modal, Pressable, View, Linking } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { BLUR_MUTED, BLUR_TEXT, BlurCard } from "@/src/components/BlurCard";
import type { LatLng, MapPerson } from "@/src/components/mapTypes";
import { T, toast } from "@/src/components/ui";
import { UserPhoto } from "@/src/components/UserPhoto";
import { radius, spacing } from "@/src/theme";

const fmtEta = (s: number) => (s < 3600 ? `${Math.round(s / 60)} min` : `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`);
const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

// --- Agenda compartida (privacidad: el servidor decide qué detalle ve cada uno) ---
export type AgendaSlot = {
  start: string; end: string;
  detail: { meeting_id: string; name: string; place: string | null; state: string; sent_by_me: boolean } | null;
};
export type AgendaEntry = { user_id: string; name: string; count: number; slots: AgendaSlot[] };

const DAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const hm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
function fmtSlot(startIso: string, endIso: string) {
  const s = new Date(startIso); const e = new Date(endIso);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return "";
  const day = sameDay(s, new Date()) ? "Hoy" : `${DAYS[s.getDay()]} ${s.getDate()} ${MONTHS[s.getMonth()]}`;
  return `${day} · ${hm(s)} – ${hm(e)}`;
}
const STATE_LABEL: Record<string, string> = {
  invitado: "Pendiente", pendiente: "Pendiente", aceptado: "Aceptada", propone_otra_hora: "Propone otra hora",
  propone_otro_lugar: "Propone otro lugar", no_puede_acudir: "No puede acudir", preparando_salida: "Preparando salida",
  en_camino: "En camino", retrasado: "Retrasado", cerca: "Cerca", llegado: "Llegado",
};

export function MemberToolsSheet({ member, mePos, groupId, agenda, onClose, onFocus }: {
  member: MapPerson | null; mePos: LatLng | null; groupId?: string; agenda?: AgendaEntry | null; onClose: () => void; onFocus: (m: MapPerson) => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const located = !!member && member.state === "shared" && member.lat != null && member.lng != null;
  const eta = useQuery({
    queryKey: ["member-eta", member?.member_id, mePos?.lat?.toFixed(3), mePos?.lng?.toFixed(3)],
    enabled: !!member && located && !!mePos, retry: false, staleTime: 60000,
    queryFn: () => api<{ distance_m: number; duration_traffic_s?: number; duration_s: number }>("/mobility/route", { method: "POST", json: { points: [[mePos!.lat, mePos!.lng], [member!.lat, member!.lng]] } }),
  });
  if (!member) return null;
  const goDrive = () => {
    if (!located) return toast("Este miembro no comparte su ubicación");
    onClose();
    router.push({ pathname: "/drive", params: { ...(mePos ? { fromLat: String(mePos.lat), fromLng: String(mePos.lng) } : {}), lat: String(member.lat), lng: String(member.lng), place: member.name } });
  };
  const ping = async () => {
    if (!groupId) return toast("Crea un grupo primero");
    try { await api("/events", { method: "POST", json: { group_id: groupId, kind: "checkin", severity: "info", message: `¿Todo bien, ${member.name}?`, target_user_id: member.user_id } }); toast(`Aviso enviado a ${member.name}`, "success"); onClose(); }
    catch (e: any) { toast(e.message, "error"); }
  };
  const dur = eta.data ? (eta.data.duration_traffic_s ?? eta.data.duration_s) : null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }} onPress={onClose} testID="member-tools-backdrop" />
      <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOut.duration(120)} style={{ position: "absolute", left: spacing.md, right: spacing.md, bottom: insets.bottom + spacing.md }}>
        <BlurCard style={{ padding: spacing.md }} testID="member-tools-sheet">
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <View style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 2.5, borderColor: member.color, overflow: "hidden" }}>
              <UserPhoto userId={member.user_id} name={member.name} color={member.color} size={41} hasPhoto={!!member.photo_url} />
            </View>
            <View style={{ flex: 1 }}>
              <T weight="bold" style={{ fontSize: 16, color: BLUR_TEXT }} numberOfLines={1}>{member.name}</T>
              <T style={{ fontSize: 12, color: BLUR_MUTED }} numberOfLines={1}>
                {located ? (dur != null ? `${fmtEta(dur)}${eta.data?.distance_m ? ` · ${fmtDist(eta.data.distance_m)}` : ""} de ti` : "Ubicación compartida") : (member.label || "Ubicación no compartida")}
              </T>
            </View>
            <Pressable testID="member-tools-close" onPress={onClose} hitSlop={8} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close" size={16} color={BLUR_TEXT} />
            </Pressable>
          </View>
          {agenda && agenda.count > 0 && (
            <View testID="member-agenda" style={{ marginTop: spacing.md, gap: 6 }}>
              <T weight="semibold" style={{ fontSize: 11, color: BLUR_MUTED, letterSpacing: 1.2 }}>AGENDA</T>
              {agenda.slots.map((sl, i) => {
                const d = sl.detail;
                const row = (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7, paddingHorizontal: 10, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
                    <Ionicons name={d ? "calendar" : "lock-closed"} size={14} color={d ? "#22d3ee" : BLUR_MUTED} />
                    <View style={{ flex: 1 }}>
                      <T weight="semibold" style={{ fontSize: 12.5, color: BLUR_TEXT }} numberOfLines={1}>{fmtSlot(sl.start, sl.end)}</T>
                      {d ? (
                        <T style={{ fontSize: 11.5, color: BLUR_MUTED }} numberOfLines={1}>
                          {d.name}{d.place ? ` · ${d.place}` : ""}{d.sent_by_me ? ` · ${STATE_LABEL[d.state] ?? d.state}` : ""}
                        </T>
                      ) : (
                        <T style={{ fontSize: 11.5, color: BLUR_MUTED, fontStyle: "italic" }} numberOfLines={1}>Ocupado · detalle privado</T>
                      )}
                    </View>
                    {d && <Ionicons name="chevron-forward" size={14} color={BLUR_MUTED} />}
                  </View>
                );
                return d
                  ? <Pressable key={i} testID={`member-agenda-slot-${i}`} onPress={() => { onClose(); router.push(`/meeting/${d.meeting_id}`); }}>{row}</Pressable>
                  : <View key={i} testID={`member-agenda-slot-${i}`}>{row}</View>;
              })}
            </View>
          )}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md }}>
            <Tool testID="member-tool-focus" icon="locate" label="Centrar" disabled={!located} onPress={() => { if (!located) return toast("Sin ubicación"); onFocus(member); onClose(); }} />
            <Tool testID="member-tool-go" icon="navigate" label="Ir hacia" primary disabled={!located} onPress={goDrive} />
            <Tool testID="member-tool-google" icon="logo-google" label="Google" disabled={!located} onPress={() => { if (!located) return; Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${member.lat},${member.lng}${mePos ? `&origin=${mePos.lat},${mePos.lng}` : ""}&travelmode=driving`); }} />
            <Tool testID="member-tool-ping" icon="help-circle" label="¿Todo bien?" onPress={ping} />
            <Tool testID="member-tool-meet" icon="calendar" label="Quedar" onPress={() => { if (!groupId) return toast("Crea un grupo primero"); onClose(); router.push({ pathname: "/meeting/new", params: { group: groupId } }); }} />
            <Tool testID="member-tool-convoy" icon="car-sport" label="Convoy" onPress={() => { if (!groupId) return toast("Crea un grupo primero"); onClose(); router.push({ pathname: "/convoy/new", params: { group: groupId } }); }} />
            <Tool testID="member-tool-card" icon="person" label="Ficha" onPress={() => { onClose(); router.push(`/person/${member.member_id}?group=${groupId ?? ""}`); }} />
          </View>
        </BlurCard>
      </Animated.View>
    </Modal>
  );
}

function Tool({ icon, label, onPress, testID, primary, disabled }: { icon: string; label: string; onPress: () => void; testID: string; primary?: boolean; disabled?: boolean }) {
  return (
    <Pressable testID={testID} onPress={onPress} disabled={disabled}
      style={{ minWidth: "30%", flexGrow: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44, borderRadius: radius.md, backgroundColor: primary ? "rgba(34,211,238,0.9)" : "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", paddingHorizontal: 10, opacity: disabled ? 0.4 : 1 }}>
      <Ionicons name={icon as any} size={16} color={primary ? "#06121A" : BLUR_TEXT} />
      <T weight="semibold" style={{ fontSize: 12.5, color: primary ? "#06121A" : BLUR_TEXT }} numberOfLines={1}>{label}</T>
    </Pressable>
  );
}
