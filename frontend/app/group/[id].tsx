// Group context: members (orbital view), invitation states, events, meetings & convoys. Reuses the orbital field.
import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Platform, Pressable, ScrollView, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, unavailableOf } from "@/src/api";
import { useAuth } from "@/src/auth";
import { InviteOptions } from "@/src/components/InviteOptions";
import { OrbitalField } from "@/src/components/OrbitalField";
import { AddMemberSheet, MemberInfo, MemberSheet } from "@/src/components/sheets";
import { Button, Pill, SectionLabel, showUnavailable, T, toast } from "@/src/components/ui";
import { dispatchInvitation } from "@/src/invites";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const confirmDelete = (title: string, msg: string, onOk: () => void) => {
  if (Platform.OS === "web") { if (window.confirm(`${title}\n${msg}`)) onOk(); return; }
  Alert.alert(title, msg, [{ text: "Cancelar", style: "cancel" }, { text: "Borrar", style: "destructive", onPress: onOk }]);
};

export default function GroupDetail() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const qc = useQueryClient();
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [view, setView] = useState<"members" | "events">(tab === "events" ? "events" : "members");

  const g = useQuery({ queryKey: ["group", id], queryFn: () => api<any>(`/groups/${id}`), refetchInterval: 12000 });
  const events = useQuery({ queryKey: ["events", id], queryFn: () => api<any[]>(`/groups/${id}/events`), enabled: view === "events" });
  const meetings = useQuery({ queryKey: ["meetings", id], queryFn: () => api<any[]>(`/groups/${id}/meetings`) });
  const convoys = useQuery({ queryKey: ["convoys", id], queryFn: () => api<any[]>(`/groups/${id}/convoys`) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["group", id] }); qc.invalidateQueries({ queryKey: ["groups"] }); };
  const canManage = g.data?.my_role === "owner" || g.data?.my_role === "admin";

  const invite = useMutation({
    mutationFn: (v: any) => api<any>(`/groups/${id}/invitations`, { method: "POST", json: v }),
    onSuccess: async (r) => {
      setAdding(false); refresh();
      const res = await dispatchInvitation({ ...r.invitation });
      toast(`${r.invitation.name}: ${res.label}`, res.ok ? "success" : "error"); refresh();
    },
    onError: (e) => { const u = unavailableOf(e); if (u) { setAdding(false); showUnavailable(u); } else toast((e as any).message, "error"); },
  });
  const rename = useMutation({
    mutationFn: (name: string) => api(`/groups/${id}`, { method: "PATCH", json: { name } }),
    onSuccess: () => { setRenaming(false); refresh(); }, onError: (e: any) => toast(e.message, "error"),
  });
  const removeGroup = useMutation({
    mutationFn: () => api(`/groups/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast("Grupo borrado", "success"); qc.invalidateQueries({ queryKey: ["groups"] }); router.replace("/map"); },
    onError: (e: any) => toast(e.message, "error"),
  });
  const act = useMutation({
    mutationFn: ({ path, method = "POST" }: { path: string; method?: string }) => api(path, { method }),
    onSuccess: () => { setSelectedId(null); refresh(); }, onError: (e: any) => toast(e.message, "error"),
  });
  const changeRole = useMutation({
    mutationFn: ({ mid, role }: { mid: string; role: string }) => api(`/groups/${id}/members/${mid}/role`, { method: "PATCH", json: { role } }),
    onSuccess: () => { toast("Permisos actualizados", "success"); refresh(); }, onError: (e: any) => toast(e.message, "error"),
  });
  const eventAction = useMutation({
    mutationFn: ({ eid, action }: { eid: string; action: string }) => api(`/events/${eid}/action`, { method: "POST", json: { action } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["events", id] }); refresh(); },
  });

  const group = g.data;
  const selected: MemberInfo | null = group?.members.find((m: any) => m.id === selectedId) ?? null;
  const size = Math.min(width - spacing.xl * 2, 320);
  const isOwner = group?.owner_id === user?.id;
  return (
    <View style={s.root} testID="group-detail">
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="header-back-button" onPress={() => (router.canGoBack() ? router.back() : router.replace("/map"))} style={s.iconBtn}><Ionicons name="chevron-back" size={22} color={colors.onSurface} /></Pressable>
        {renaming ? (
          <TextInput testID="group-rename-input" style={s.renameInput} value={nameDraft} onChangeText={setNameDraft} autoFocus returnKeyType="done" onSubmitEditing={() => nameDraft.trim() && rename.mutate(nameDraft.trim())} />
        ) : (
          <T weight="bold" style={{ fontSize: 20, flex: 1 }} numberOfLines={1}>{group?.name ?? "Grupo"}</T>
        )}
        {renaming ? (
          <>
            <Pressable testID="group-rename-save" onPress={() => nameDraft.trim() && rename.mutate(nameDraft.trim())} style={s.iconBtn}><Ionicons name="checkmark" size={20} color={colors.success} /></Pressable>
            <Pressable testID="group-rename-cancel" onPress={() => setRenaming(false)} style={s.iconBtn}><Ionicons name="close" size={20} color={colors.muted} /></Pressable>
          </>
        ) : canManage ? (
          <>
            <Pressable testID="group-rename-button" onPress={() => { setNameDraft(group?.name ?? ""); setRenaming(true); }} style={s.iconBtn} accessibilityLabel="Cambiar nombre del grupo"><Ionicons name="pencil" size={18} color={colors.onSurface} /></Pressable>
            {isOwner ? <Pressable testID="group-delete-button" onPress={() => confirmDelete("Borrar grupo", `Se eliminará "${group?.name}" y sus invitaciones.`, () => removeGroup.mutate())} style={s.iconBtn} accessibilityLabel="Borrar grupo"><Ionicons name="trash" size={18} color={colors.error} /></Pressable> : null}
            <Pressable testID="group-add-member" onPress={() => setAdding(true)} style={s.iconBtn}><Ionicons name="person-add" size={18} color={colors.onSurface} /></Pressable>
          </>
        ) : null}
      </View>
      <View style={s.tabsWrap}>
        <View style={s.tabs}>
          {(["members", "events"] as const).map((k) => (
            <Pressable key={k} testID={`group-tab-${k}`} onPress={() => setView(k)} style={[s.tab, view === k && s.tabOn]}>
              <T weight="semibold" style={{ fontSize: 13, color: view === k ? colors.onBrandSoft : colors.onSurfaceTertiary }}>{k === "members" ? "Miembros" : "Actividad"}</T>
            </Pressable>
          ))}
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        {view === "members" && group ? (
          <>
            <View style={{ alignItems: "center", paddingVertical: spacing.lg }}>
              <OrbitalField size={size} phase="editing" groupName={group.name}
                members={group.members.map((m: any) => ({ id: m.id, name: m.display_name, color: m.color, isMe: m.user_id === user?.id, status: m.status === "active" ? "active" : m.status === "declined" ? "declined" : m.status === "expired" ? "expired" : "pending" }))}
                onMemberPress={(m) => setSelectedId(m.id)} />
            </View>
            <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
              {group.members.map((m: any) => (
                <Pressable key={m.id} testID={`member-row-${m.id}`} onPress={() => setSelectedId(m.id)} style={s.row}>
                  <View style={s.rowMain}>
                    <View style={[s.dot, { backgroundColor: m.status === "active" ? m.color : colors.pending }]} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T weight="semibold" numberOfLines={1}>{m.display_name}{m.user_id === user?.id ? " (tú)" : ""}</T>
                      <T style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>{ROLE[m.role] ?? m.role} · {m.membership === "temporary" ? "temporal" : "fijo"}{m.expires_at ? ` · expira ${new Date(m.expires_at).toLocaleDateString("es-ES")}` : ""}</T>
                    </View>
                  </View>
                  <View style={s.rowPills}>
                    <Pill label={STATUS[m.status] ?? m.status} tone={m.status === "active" ? "cyan" : m.status === "pending" ? "muted" : "red"} />
                    {m.status === "active" && LOC[m.location_state] ? <Pill label={LOC[m.location_state]} tone={m.location_state === "shared" ? "green" : "muted"} /> : null}
                  </View>
                </Pressable>
              ))}
              {canManage ? (<><SectionLabel style={{ marginTop: spacing.xl, marginBottom: spacing.xs }}>Invitar</SectionLabel><InviteOptions groupId={id!} groupName={group.name} onChanged={() => qc.invalidateQueries({ queryKey: ["group", id] })} /></>) : null}
              <SectionLabel style={{ marginTop: spacing.xl, marginBottom: spacing.xs }}>Coordinación</SectionLabel>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Button small testID="group-new-meeting" title="Quedar" icon="calendar" variant="secondary" onPress={() => router.push({ pathname: "/meeting/new", params: { group: id } })} />
                <Button small testID="group-new-convoy" title="Convoy" icon="car-sport" variant="secondary" onPress={() => router.push({ pathname: "/convoy/new", params: { group: id } })} />
              </View>
              {(meetings.data ?? []).map((m) => <Pressable key={m.id} testID={`meeting-row-${m.id}`} onPress={() => router.push(`/meeting/${m.id}`)} style={s.row}><Ionicons name="calendar" size={18} color={colors.success} /><T weight="semibold" style={{ flex: 1 }}>{m.name}</T><Pill label={m.status === "active" ? "Activa" : "Cerrada"} tone={m.status === "active" ? "green" : "muted"} /></Pressable>)}
              {(convoys.data ?? []).map((c) => <Pressable key={c.id} testID={`convoy-row-${c.id}`} onPress={() => router.push(`/convoy/${c.id}`)} style={s.row}><Ionicons name="car-sport" size={18} color={colors.brandSecondary} /><T weight="semibold" style={{ flex: 1 }}>{c.name}</T><Pill label={c.status === "active" ? "En curso" : "Finalizado"} tone={c.status === "active" ? "blue" : "muted"} /></Pressable>)}
            </View>
          </>
        ) : null}
        {view === "events" ? (
          <View style={{ padding: spacing.lg, gap: spacing.sm }}>
            {(events.data ?? []).length === 0 ? <T style={{ color: colors.muted }}>Sin actividad todavía. Las preguntas “¿Todo bien?”, incidencias y emergencias aparecerán aquí con su trazabilidad.</T> : null}
            {(events.data ?? []).map((e) => (
              <View key={e.id} style={s.row} testID={`event-row-${e.id}`}>
                <Ionicons name={e.kind === "emergency" ? "alert-circle" : e.kind === "incident" ? "warning" : "help-circle"} size={20} color={e.severity === "critical" ? colors.error : e.severity === "warning" ? colors.orangeRisk : colors.brandPrimary} />
                <View style={{ flex: 1 }}>
                  <T weight="semibold">{e.message ?? e.kind}</T>
                  <T style={{ fontSize: 12, color: colors.muted }}>{new Date(e.created_at).toLocaleString("es-ES")} · escalado: {e.escalation} · {e.recipients?.length ?? 0} destinatarios</T>
                </View>
                <Pill label={e.state} tone={e.state === "resolved" ? "green" : e.state === "escalated" ? "red" : "amber"} />
                {e.state === "open" ? <Pressable testID={`event-ok-${e.id}`} onPress={() => eventAction.mutate({ eid: e.id, action: "respond_ok" })} style={s.iconBtn}><Ionicons name="checkmark" size={18} color={colors.success} /></Pressable> : null}
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
      <AddMemberSheet visible={adding} onClose={() => setAdding(false)} loading={invite.isPending} onSubmit={(v) => invite.mutate(v)} />
      <MemberSheet member={selected} onClose={() => setSelectedId(null)} canManage={!!canManage} changingRole={changeRole.isPending}
        onResend={() => selected?.invitation && act.mutate({ path: `/invitations/${selected.invitation.id}/resend` })}
        onCancel={() => selected?.invitation && act.mutate({ path: `/invitations/${selected.invitation.id}/cancel` })}
        onRemove={() => selected && act.mutate({ path: `/groups/${id}/members/${selected.id}`, method: "DELETE" })}
        onChangeRole={(role) => selected && changeRole.mutate({ mid: selected.id, role })} />
    </View>
  );
}

const ROLE: Record<string, string> = { owner: "Propietario", admin: "Administrador", member: "Miembro", adult_responsible: "Adulto responsable", adult_member: "Miembro adulto", protected_minor: "Menor protegido", temporary_guest: "Invitado temporal" };
const STATUS: Record<string, string> = { active: "Activo", pending: "Pendiente", declined: "Rechazada", expired: "Expirada", removed: "Eliminado" };
const LOC: Record<string, string> = { shared: "Ubicación", not_shared: "Sin ubicación", permission_pending: "Ubicación: permiso pendiente" };

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  renameInput: { flex: 1, fontFamily: fonts.bold, fontSize: 18, color: c.onSurface, borderBottomWidth: 1, borderColor: c.brandPrimary, paddingVertical: 4 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.hairline, alignItems: "center", justifyContent: "center" },
  tabsWrap: { paddingHorizontal: spacing.lg },
  tabs: { flexDirection: "row", gap: 4, backgroundColor: c.surfaceTertiary, borderRadius: radius.pill, padding: 4, alignSelf: "flex-start" },
  tab: { height: 34, paddingHorizontal: 16, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  tabOn: { backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.hairline },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, backgroundColor: c.card, borderRadius: radius.md + 2, padding: spacing.md, borderWidth: 1, borderColor: c.hairline },
  rowMain: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1, minWidth: 0 },
  rowPills: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "flex-end", maxWidth: 168 },
  dot: { width: 12, height: 12, borderRadius: 6 },
}));
