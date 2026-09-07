// Signature experience: spatial group creation (P2). Group nucleus, orbital members, physics birth animation,
// pending gray → active vivid, ENVIAR A TODOS inside the field, formation links and collapse into the Mini-Orb.
import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, TextInput, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, unavailableOf } from "@/src/api";
import { useAuth } from "@/src/auth";
import { InviteOptions } from "@/src/components/InviteOptions";
import { OrbitalField, OrbitalMember } from "@/src/components/OrbitalField";
import { AddMemberSheet, MemberInfo, MemberSheet, NewInvite } from "@/src/components/sheets";
import { Button, showUnavailable, T, toast } from "@/src/components/ui";
import { dispatchInvitation, Invitation } from "@/src/invites";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Group = { id: string; name: string; members: (MemberInfo & { user_id?: string; color: string })[]; stats: any };

export default function GroupCreation() {
  const router = useRouter();
  const { user, reload } = useAuth();
  const qc = useQueryClient();
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const size = Math.min(width - spacing.xl * 2, 380);
  const [phase, setPhase] = useState<"editing" | "forming" | "collapsing">("editing");
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<MemberInfo | null>(null);
  const [newIds, setNewIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const nameRef = useRef<TextInput>(null);

  const groups = useQuery({ queryKey: ["groups"], queryFn: () => api<Group[]>("/groups") });
  const group = groups.data?.[0];

  const create = useMutation({
    mutationFn: () => api<Group>("/groups", { method: "POST", json: { name: "Grupo 1" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
    onError: (e) => { const u = unavailableOf(e); if (u) showUnavailable(u); else toast((e as any).message, "error"); },
  });
  useEffect(() => { if (groups.isSuccess && groups.data.length === 0 && !create.isPending && !create.isError) create.mutate(); }, [groups.isSuccess, groups.data, create]);

  const [name, setName] = useState<string | null>(null);
  const rename = useMutation({
    mutationFn: (n: string) => api(`/groups/${group!.id}`, { method: "PATCH", json: { name: n } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });

  const invite = useMutation({
    mutationFn: (v: NewInvite) => api<{ invitation: Invitation; member: { id: string } }>(`/groups/${group!.id}/invitations`, { method: "POST", json: v }),
    onSuccess: async (r) => { setNewIds((p) => [...p, r.member.id]); setAdding(false); await qc.invalidateQueries({ queryKey: ["groups"] }); },
    onError: (e) => { const u = unavailableOf(e); if (u) { setAdding(false); showUnavailable(u); } else toast((e as any).message, "error"); },
  });

  const act = useMutation({
    mutationFn: ({ path }: { path: string }) => api(path, { method: "POST" }),
    onSuccess: () => { setSelected(null); qc.invalidateQueries({ queryKey: ["groups"] }); },
    onError: (e: any) => toast(e.message, "error"),
  });

  const members: OrbitalMember[] = (group?.members ?? []).map((m) => ({
    id: m.id, name: m.display_name, color: m.color, isMe: m.user_id === user?.id, isNew: newIds.includes(m.id),
    status: m.status === "active" ? "active" : m.status === "declined" ? "declined" : m.status === "expired" ? "expired" : "pending",
  }));
  const pendingInvites = (group?.members ?? []).filter((m) => m.status === "pending" && m.invitation?.status === "prepared");

  const finish = async () => {
    setPhase("forming");
    setTimeout(() => setPhase("collapsing"), 1700);
    setTimeout(async () => {
      try { await api(`/groups/${group!.id}/formed`, { method: "POST" }); await reload(); } catch (e: any) { toast(e.message, "error"); }
      router.replace({ pathname: "/map", params: { welcome: "1" } });
    }, 2900);
  };

  const sendAll = async () => {
    if (!group) return;
    setSending(true);
    let launched = 0;
    for (const m of pendingInvites) {
      const full = { ...(m.invitation as any), name: m.display_name, group_name: group.name, membership: m.membership } as Invitation;
      const r = await dispatchInvitation(full);
      toast(`${m.display_name}: ${r.label}`, r.ok ? "success" : "error");
      if (r.ok) launched++;
    }
    setSending(false);
    await qc.invalidateQueries({ queryKey: ["groups"] });
    if (launched === pendingInvites.length || pendingInvites.length === 0) finish();
  };

  if (!group) {
    return <View style={[s.root, { alignItems: "center", justifyContent: "center" }]} testID="group-creation-loading"><T style={{ color: colors.muted }}>{create.isError ? "No se pudo crear el grupo" : "Preparando tu grupo…"}</T>
      {create.isError ? <View style={{ marginTop: 16 }}><Button testID="group-retry" title="Reintentar" onPress={() => create.mutate()} /><Button testID="group-skip" title="Continuar sin grupo" variant="ghost" onPress={async () => { await api("/profile/onboarding-step", { method: "PUT", json: { step: "done" } }); await reload(); router.replace("/map"); }} /></View> : null}
    </View>;
  }

  return (
    <View style={s.root} testID="onboarding-group">
      <View style={[s.top, { paddingTop: insets.top + spacing.lg }]}>
        <T style={{ color: colors.muted, fontSize: 13 }}>Tu primer Grupo</T>
        <View style={s.nameRow}>
          <TextInput ref={nameRef} testID="group-name-input" style={s.nameInput} value={name ?? group.name} onChangeText={setName}
            onEndEditing={() => { if (name && name !== group.name) rename.mutate(name); }} editable={phase === "editing"} returnKeyType="done" />
          <Pressable testID="group-name-edit" onPress={() => nameRef.current?.focus()} style={s.editBtn}><Ionicons name="pencil" size={16} color={colors.muted} /></Pressable>
        </View>
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <OrbitalField members={members} size={size} phase={phase} groupName={name ?? group.name}
          onMemberPress={(m) => { if (phase !== "editing") return; const full = group.members.find((x) => x.id === m.id); if (full && !m.isMe) setSelected(full); }}
          center={phase === "editing" && members.length > 1 ? (
            <Pressable testID="send-all-button" onPress={sendAll} disabled={sending} style={s.sendAll}>
              <Ionicons name="paper-plane" size={16} color={colors.onBrandPrimary} />
              <T weight="bold" style={{ color: colors.onBrandPrimary, fontSize: 11, textAlign: "center" }}>{sending ? "ENVIANDO…" : pendingInvites.length ? "ENVIAR A TODOS" : "FORMAR GRUPO"}</T>
            </Pressable>
          ) : undefined} />
        {phase !== "editing" ? (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={{ position: "absolute", bottom: 24 }}>
            <T weight="semibold" style={{ color: colors.muted }} testID="group-forming-label">{phase === "forming" ? "Formando el grupo…" : "Creando tu Mini-Orb…"}</T>
          </Animated.View>
        ) : null}
      </View>

      {phase === "editing" ? (
        <View style={[s.actions, { paddingBottom: insets.bottom + spacing.lg }]}>
          <InviteOptions groupId={group.id} groupName={name ?? group.name} onChanged={() => qc.invalidateQueries({ queryKey: ["groups"] })} />
          <Button testID="add-member-button" title="Añadir persona a mano" icon="person-add" variant="secondary" onPress={() => setAdding(true)} />
          <Button testID="group-continue-button" title={members.length > 1 ? "Continuar sin enviar ahora" : "Continuar sin invitar"} variant="ghost" onPress={finish} />
        </View>
      ) : null}

      <AddMemberSheet visible={adding} onClose={() => setAdding(false)} loading={invite.isPending} onSubmit={(v) => invite.mutate(v)} />
      <MemberSheet member={selected} onClose={() => setSelected(null)} canManage
        onResend={() => selected?.invitation && act.mutate({ path: `/invitations/${selected.invitation.id}/resend` })}
        onCancel={() => selected?.invitation && act.mutate({ path: `/invitations/${selected.invitation.id}/cancel` })} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  top: { paddingHorizontal: spacing.xl },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  nameInput: { flex: 1, fontFamily: fonts.bold, fontSize: 28, color: c.onSurface, paddingVertical: 4 },
  editBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  sendAll: { alignItems: "center", justifyContent: "center", gap: 4, width: "100%", height: "100%", borderRadius: radius.pill },
  actions: { paddingHorizontal: spacing.xl, gap: spacing.xs },
}));
