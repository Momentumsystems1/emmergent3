// Group creation (one or several groups) right after the legal steps. Each group card: editable name, members with state,
// invitation options (WhatsApp link / share / contacts / manual), delete. "Continuar al mapa" completes onboarding.
import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, unavailableOf } from "@/src/api";
import { useAuth } from "@/src/auth";
import { InviteOptions } from "@/src/components/InviteOptions";
import { OrbitalField } from "@/src/components/OrbitalField";
import { AddMemberSheet, MemberInfo, MemberSheet, NewInvite } from "@/src/components/sheets";
import { Button, Pill, showUnavailable, T, toast } from "@/src/components/ui";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Group = { id: string; name: string; owner_id: string; my_role: string; members: MemberInfo[]; stats: { members: number; pending: number } };

const confirm = (title: string, msg: string, onOk: () => void) => {
  if (Platform.OS === "web") { if (window.confirm(`${title}\n${msg}`)) onOk(); return; }
  Alert.alert(title, msg, [{ text: "Cancelar", style: "cancel" }, { text: "Borrar", style: "destructive", onPress: onOk }]);
};

export default function GroupOnboarding({ embedded }: { embedded?: boolean }) {
  const router = useRouter(); const qc = useQueryClient(); const { user, reload } = useAuth();
  const s = useStyles(); const { colors } = useTheme(); const insets = useSafeAreaInsets(); const { width } = useWindowDimensions();
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState<Group | null>(null);
  const [selected, setSelected] = useState<{ gid: string; mid: string } | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [formingId, setFormingId] = useState<string | null>(null);
  const [newMemberIds, setNewMemberIds] = useState<Record<string, string>>({});
  const seenRef = useRef<Record<string, Set<string>>>({});

  const groups = useQuery({ queryKey: ["groups"], queryFn: () => api<Group[]>("/groups") });
  // Detects newly-added members (per group) to trigger the orbital "birth" animation, without flagging the initial load.
  useEffect(() => {
    (groups.data ?? []).forEach((g) => {
      const ids = new Set(g.members.filter((m) => m.status !== "removed").map((m) => m.id));
      const seen = seenRef.current[g.id];
      if (!seen) { seenRef.current[g.id] = ids; return; }
      const added: string[] = []; ids.forEach((id) => { if (!seen.has(id)) added.push(id); });
      if (added.length) {
        setNewMemberIds((prev) => { const next = { ...prev }; added.forEach((id) => (next[id] = g.id)); return next; });
        setTimeout(() => setNewMemberIds((prev) => { const next = { ...prev }; added.forEach((id) => delete next[id]); return next; }), 1600);
      }
      seenRef.current[g.id] = ids;
    });
  }, [groups.data]);
  const onErr = (e: any) => { const u = unavailableOf(e); if (u) showUnavailable(u); else toast(e.message, "error"); };
  const create = useMutation({ mutationFn: (name: string) => api<Group>("/groups", { method: "POST", json: { name } }), onSuccess: (g) => { setNewName(""); qc.invalidateQueries({ queryKey: ["groups"] }); setFormingId(g.id); setTimeout(() => setFormingId(null), 1400); }, onError: onErr });
  const rename = useMutation({ mutationFn: ({ id, name }: { id: string; name: string }) => api(`/groups/${id}`, { method: "PATCH", json: { name } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }), onError: onErr });
  const remove = useMutation({ mutationFn: (id: string) => api(`/groups/${id}`, { method: "DELETE" }), onSuccess: () => { toast("Grupo borrado", "success"); qc.invalidateQueries({ queryKey: ["groups"] }); }, onError: onErr });
  const invite = useMutation({ mutationFn: ({ g, v }: { g: Group; v: NewInvite }) => api(`/groups/${g.id}/invitations`, { method: "POST", json: v }), onSuccess: () => { setAdding(null); qc.invalidateQueries({ queryKey: ["groups"] }); }, onError: (e) => { setAdding(null); onErr(e); } });
  const act = useMutation({ mutationFn: (path: string) => api(path, { method: "POST" }), onSuccess: () => { setSelected(null); qc.invalidateQueries({ queryKey: ["groups"] }); }, onError: onErr });
  const removeMember = useMutation({ mutationFn: ({ gid, mid }: { gid: string; mid: string }) => api(`/groups/${gid}/members/${mid}`, { method: "DELETE" }), onSuccess: () => { setSelected(null); qc.invalidateQueries({ queryKey: ["groups"] }); }, onError: onErr });
  const changeRole = useMutation({ mutationFn: ({ gid, mid, role }: { gid: string; mid: string; role: string }) => api(`/groups/${gid}/members/${mid}/role`, { method: "PATCH", json: { role } }), onSuccess: () => { toast("Permisos actualizados", "success"); qc.invalidateQueries({ queryKey: ["groups"] }); }, onError: onErr });

  const finish = async () => {
    const list = groups.data ?? [];
    if (!list.length) return toast("Crea al menos un grupo o continúa sin grupo");
    setFinishing(true);
    try { await api(`/groups/${list[0].id}/formed`, { method: "POST" }); await reload(); router.replace({ pathname: "/map", params: { welcome: "1" } }); }
    catch (e: any) { toast(e.message, "error"); } finally { setFinishing(false); }
  };
  const skip = async () => { await api("/profile/onboarding-step", { method: "PUT", json: { step: "done" } }); await reload(); router.replace("/map"); };
  const list = groups.data ?? [];
  const selectedGroup = list.find((g) => g.id === selected?.gid) ?? null;
  const selectedMember = selectedGroup?.members.find((m) => m.id === selected?.mid) ?? null;

  return (
    <View style={s.root} testID="onboarding-group">
      <ScrollView contentContainerStyle={{ paddingTop: embedded ? spacing.md : insets.top + spacing.lg, paddingHorizontal: spacing.xl, paddingBottom: 160, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        {!embedded ? (<View><T weight="bold" style={{ fontSize: 28 }}>Tus grupos</T><T style={{ color: colors.muted, marginTop: 4 }}>Crea uno o varios círculos (familia, amigos, equipo). Cada grupo tiene sus propios miembros y permisos.</T></View>) : null}

        {list.map((g) => <GroupCard key={g.id} g={g} me={user?.id} width={width} phase={formingId === g.id ? "forming" : "editing"} newMemberIds={newMemberIds} onRename={(name) => rename.mutate({ id: g.id, name })} onDelete={() => confirm("Borrar grupo", `Se eliminará "${g.name}" y sus invitaciones.`, () => remove.mutate(g.id))}
          onAdd={() => setAdding(g)} onMember={(m) => setSelected({ gid: g.id, mid: m.id })} onChanged={() => qc.invalidateQueries({ queryKey: ["groups"] })} />)}

        <View style={s.newCard} testID="new-group-card">
          <T weight="bold">{list.length ? "Crear otro grupo" : "Crea tu primer grupo"}</T>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
            <TextInput testID="new-group-name" style={s.input} placeholder={list.length ? "Nombre del grupo (p. ej. Amigos)" : "Nombre del grupo (p. ej. Familia)"} placeholderTextColor={colors.muted} value={newName} onChangeText={setNewName} returnKeyType="done" onSubmitEditing={() => newName.trim() && create.mutate(newName.trim())} />
            <Pressable testID="new-group-create" onPress={() => create.mutate(newName.trim() || `Grupo ${list.length + 1}`)} disabled={create.isPending} style={s.addBtn}><Ionicons name="add" size={22} color={colors.onBrandPrimary} /></Pressable>
          </View>
        </View>
      </ScrollView>

      {!embedded ? (
        <View style={[s.actions, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Button testID="group-continue-button" title={list.length ? "Continuar al mapa" : "Continuar sin grupo"} icon="map" loading={finishing} onPress={list.length ? finish : skip} />
        </View>
      ) : null}

      <AddMemberSheet visible={!!adding} onClose={() => setAdding(null)} loading={invite.isPending} onSubmit={(v) => adding && invite.mutate({ g: adding, v })} />
      <MemberSheet member={selectedMember} onClose={() => setSelected(null)} canManage={!!selectedGroup && (selectedGroup.my_role === "owner" || selectedGroup.my_role === "admin")} changingRole={changeRole.isPending}
        onResend={() => selectedMember?.invitation && act.mutate(`/invitations/${selectedMember.invitation.id}/resend`)}
        onCancel={() => selectedMember?.invitation && act.mutate(`/invitations/${selectedMember.invitation.id}/cancel`)}
        onRemove={() => selected && removeMember.mutate(selected)}
        onChangeRole={(role) => selected && changeRole.mutate({ ...selected, role })} />
    </View>
  );
}

function GroupCard({ g, me, width, phase, newMemberIds, onRename, onDelete, onAdd, onMember, onChanged }: { g: Group; me?: string; width: number; phase: "editing" | "forming"; newMemberIds: Record<string, string>; onRename: (n: string) => void; onDelete: () => void; onAdd: () => void; onMember: (m: MemberInfo) => void; onChanged: () => void }) {
  const s = useStyles(); const { colors } = useTheme();
  const [open, setOpen] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(g.name);
  const canManage = g.my_role === "owner" || g.my_role === "admin";
  const visible = g.members.filter((m) => m.status !== "removed");
  const orbSize = Math.min(width - spacing.xl * 2 - spacing.md * 2, 240);
  const orbMembers = visible.map((m) => ({
    id: m.id, name: m.display_name, color: m.color ?? colors.brandPrimary,
    status: (m.status === "active" ? "active" : m.status === "declined" ? "declined" : m.status === "expired" ? "expired" : "pending") as "active" | "pending" | "declined" | "expired",
    isMe: m.user_id === me, isNew: newMemberIds[m.id] === g.id,
  }));
  const saveRename = () => { const n = nameDraft.trim(); setRenaming(false); if (n && n !== g.name) onRename(n); };
  return (
    <View style={s.card} testID={`group-card-${g.id}`}>
      <View style={s.nameRow}>
        <View style={s.groupIcon}><Ionicons name="people" size={18} color={colors.onBrandPrimary} /></View>
        {renaming ? (
          <>
            <TextInput testID={`group-name-${g.id}`} style={s.nameInput} value={nameDraft} onChangeText={setNameDraft} autoFocus returnKeyType="done" onSubmitEditing={saveRename} />
            <Pressable testID={`group-rename-save-${g.id}`} onPress={saveRename} hitSlop={8} style={s.iconBtn}><Ionicons name="checkmark" size={18} color={colors.success} /></Pressable>
            <Pressable testID={`group-rename-cancel-${g.id}`} onPress={() => setRenaming(false)} hitSlop={8} style={s.iconBtn}><Ionicons name="close" size={18} color={colors.muted} /></Pressable>
          </>
        ) : (
          <>
            <T weight="bold" style={{ fontSize: 18, flex: 1 }} numberOfLines={1} testID={`group-name-${g.id}`}>{g.name}</T>
            <Pill label={`${g.stats.members}${g.stats.pending ? ` · ${g.stats.pending} pend.` : ""}`} tone="cyan" />
            {canManage ? <Pressable testID={`group-rename-${g.id}`} onPress={() => { setNameDraft(g.name); setRenaming(true); }} hitSlop={8} style={s.iconBtn} accessibilityLabel="Cambiar nombre del grupo"><Ionicons name="pencil" size={16} color={colors.onSurface} /></Pressable> : null}
            <Pressable testID={`group-toggle-${g.id}`} onPress={() => setOpen(!open)} hitSlop={8} style={s.iconBtn}><Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.onSurface} /></Pressable>
          </>
        )}
      </View>
      {open ? (
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <View style={{ alignItems: "center", paddingVertical: spacing.sm }} testID={`group-orbit-${g.id}`}>
            <OrbitalField size={orbSize} phase={phase} groupName={g.name} members={orbMembers}
              onMemberPress={(m) => { const full = visible.find((x) => x.id === m.id); if (full && full.user_id !== me) onMember(full); }} />
          </View>
          {canManage ? (
            <>
              <InviteOptions groupId={g.id} groupName={g.name} onChanged={onChanged} />
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Pressable testID={`group-add-${g.id}`} onPress={onAdd} style={[s.opt, { flex: 1 }]}><Ionicons name="person-add" size={16} color={colors.onSurface} /><T weight="semibold" style={{ fontSize: 13 }}>Añadir a mano</T></Pressable>
                {g.owner_id === me ? <Pressable testID={`group-delete-${g.id}`} onPress={onDelete} style={s.opt}><Ionicons name="trash" size={16} color={colors.error} /><T weight="semibold" style={{ fontSize: 13, color: colors.error }}>Borrar</T></Pressable> : null}
              </View>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.md },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  groupIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  nameInput: { flex: 1, fontFamily: fonts.bold, fontSize: 18, color: c.onSurface, paddingVertical: 4 },
  iconBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  memberChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingRight: 10, paddingLeft: 4, height: 40, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border, maxWidth: 170 },
  opt: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border },
  newCard: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: c.borderStrong, borderStyle: "dashed", padding: spacing.md },
  input: { flex: 1, height: 48, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.md, fontFamily: fonts.regular, fontSize: 15, color: c.onSurface },
  addBtn: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  actions: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.xl, paddingTop: spacing.md, backgroundColor: c.surface, borderTopWidth: 1, borderColor: c.divider },
}));
