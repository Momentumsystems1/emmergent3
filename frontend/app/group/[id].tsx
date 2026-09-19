// Group screen: members + P1 invitations. Creates a link `/?invite=<token>` (static-hosting safe) and shares it
// via WhatsApp / system share / copy. Every status shown is the real invitations row state.
import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Linking, Platform, Pressable, ScrollView, Share, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { Button, Pill, SectionLabel, T, toast } from "@/src/components/ui";
import { createInvitation, getGroupInvitations, getGroupMembers, getMyGroups, InvitationRow, markDispatched } from "@/src/sb";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const DURATIONS = [
  { key: "24h", label: "24 h", hours: 24 },
  { key: "7d", label: "7 días", hours: 24 * 7 },
  { key: "30d", label: "30 días", hours: 24 * 30 },
];

function inviteLink(token: string): string {
  if (Platform.OS === "web" && typeof window !== "undefined") return `${window.location.origin}/?invite=${token}`;
  return `mycluster://?invite=${token}`;
}

const STATUS: Record<string, { label: string; tone: "muted" | "cyan" | "green" | "amber" | "red" }> = {
  prepared: { label: "Sin enviar", tone: "muted" },
  dispatched: { label: "Enviada", tone: "amber" },
  accepted: { label: "Aceptada", tone: "green" },
  declined: { label: "Rechazada", tone: "red" },
  expired: { label: "Expirada", tone: "red" },
};
const ROLE: Record<string, string> = { owner: "Propietario", admin: "Administrador", member: "Miembro" };

export default function GroupDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const qc = useQueryClient();
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [invName, setInvName] = useState("");
  const [membership, setMembership] = useState<"fixed" | "temporary">("fixed");
  const [duration, setDuration] = useState(DURATIONS[1]);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<InvitationRow | null>(null);

  const groups = useQuery({ queryKey: ["groups"], queryFn: getMyGroups });
  const group = (groups.data ?? []).find((g) => g.id === id);
  const members = useQuery({ queryKey: ["members", id], enabled: !!id, queryFn: () => getGroupMembers(id!) });
  const invitations = useQuery({ queryKey: ["invitations", id], enabled: !!id, queryFn: () => getGroupInvitations(id!) });
  const canManage = group?.my_role === "owner" || group?.my_role === "admin";

  const refresh = () => { qc.invalidateQueries({ queryKey: ["invitations", id] }); qc.invalidateQueries({ queryKey: ["members", id] }); };

  const create = async () => {
    if (!invName.trim()) return toast("Pon un nombre a la invitación (p. ej. Laura)", "error");
    setBusy(true);
    try {
      const expiresAt = membership === "temporary" ? new Date(Date.now() + duration.hours * 3600_000).toISOString() : null;
      const inv = await createInvitation(id!, { name: invName.trim(), membership, expiresAt });
      setFresh(inv);
      setInvName("");
      refresh();
    } catch (e: any) { toast(e?.message ?? "No se pudo crear la invitación", "error"); } finally { setBusy(false); }
  };

  const dispatch = async (inv: InvitationRow, via: "whatsapp" | "share" | "copy") => {
    const link = inviteLink(inv.token);
    const text = `${inv.invitee_name ? `${inv.invitee_name}, te` : "Te"} invito a mi grupo “${group?.name ?? "My Cluster"}” en My Cluster. Entra desde este enlace: ${link}`;
    try {
      if (via === "whatsapp") await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
      else if (via === "share") await Share.share({ message: text });
      else if (Platform.OS === "web" && navigator.clipboard) { await navigator.clipboard.writeText(link); toast("Enlace copiado", "success"); }
      else await Share.share({ message: text });
      await markDispatched(inv.token);
      setFresh(null);
      refresh();
    } catch { /* user cancelled the share sheet */ }
  };

  return (
    <View style={s.root} testID="group-detail">
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="header-back-button" onPress={() => (router.canGoBack() ? router.back() : router.replace("/map"))} style={s.iconBtn}><Ionicons name="chevron-back" size={22} color={colors.onSurface} /></Pressable>
        <T weight="bold" style={{ fontSize: 20, flex: 1 }} numberOfLines={1}>{group?.name ?? "Grupo"}</T>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.sm }}>
        <SectionLabel style={{ marginBottom: spacing.xs }}>Miembros</SectionLabel>
        {(members.data ?? []).map((m) => (
          <View key={m.user_id} style={s.row} testID={`member-row-${m.user_id}`}>
            <View style={[s.dot, { backgroundColor: m.status === "active" ? m.color : colors.pending }]} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T weight="semibold" numberOfLines={1}>{m.name}{m.user_id === user?.id ? " (tú)" : ""}</T>
              <T style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>{ROLE[m.role] ?? m.role} · {m.membership === "temporary" ? "temporal" : "fijo"}{m.expires_at ? ` · hasta ${new Date(m.expires_at).toLocaleDateString("es-ES")}` : ""}</T>
            </View>
            <Pill label={m.status === "active" ? "Activo" : m.status} tone={m.status === "active" ? "cyan" : "muted"} />
          </View>
        ))}
        {members.isSuccess && (members.data ?? []).length === 0 ? <T style={{ color: colors.muted }}>Aún no hay miembros.</T> : null}

        {canManage ? (
          <>
            <SectionLabel style={{ marginTop: spacing.xl, marginBottom: spacing.xs }}>Invitar</SectionLabel>
            <View style={s.card}>
              <T weight="semibold">Nueva invitación</T>
              <TextInput testID="invite-name" style={s.input} placeholder="Nombre de la persona (p. ej. Laura)" placeholderTextColor={colors.muted} value={invName} onChangeText={setInvName} />
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                {(["fixed", "temporary"] as const).map((k) => (
                  <Pressable key={k} testID={`invite-membership-${k}`} onPress={() => setMembership(k)} style={[s.chip, membership === k && s.chipOn]}>
                    <T weight="semibold" style={{ fontSize: 13, color: membership === k ? colors.onBrandSoft : colors.onSurfaceTertiary }}>{k === "fixed" ? "Miembro fijo" : "Temporal"}</T>
                  </Pressable>
                ))}
              </View>
              {membership === "temporary" ? (
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  {DURATIONS.map((d) => (
                    <Pressable key={d.key} testID={`invite-duration-${d.key}`} onPress={() => setDuration(d)} style={[s.chip, duration.key === d.key && s.chipOn]}>
                      <T weight="semibold" style={{ fontSize: 13, color: duration.key === d.key ? colors.onBrandSoft : colors.onSurfaceTertiary }}>{d.label}</T>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <Button testID="invite-create" title="Crear enlace de invitación" icon="link" onPress={create} loading={busy} />
              {fresh ? (
                <View style={s.linkBox} testID="invite-fresh">
                  <T style={{ fontSize: 12, color: colors.muted }} numberOfLines={2}>{inviteLink(fresh.token)}</T>
                  <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                    <Button small testID="invite-whatsapp" title="WhatsApp" icon="logo-whatsapp" onPress={() => dispatch(fresh, "whatsapp")} />
                    <Button small testID="invite-share" title="Compartir" icon="share-social" variant="secondary" onPress={() => dispatch(fresh, "share")} />
                    <Button small testID="invite-copy" title="Copiar" icon="copy" variant="secondary" onPress={() => dispatch(fresh, "copy")} />
                  </View>
                </View>
              ) : null}
            </View>

            <SectionLabel style={{ marginTop: spacing.lg, marginBottom: spacing.xs }}>Invitaciones</SectionLabel>
            {(invitations.data ?? []).map((inv) => {
              const st = STATUS[inv.status] ?? { label: inv.status, tone: "muted" as const };
              const open = inv.status === "prepared" || inv.status === "dispatched";
              return (
                <View key={inv.token} style={s.row} testID={`invitation-row-${inv.token}`}>
                  <Ionicons name={inv.status === "accepted" ? "checkmark-circle" : "link"} size={18} color={inv.status === "accepted" ? colors.success : colors.brandPrimary} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T weight="semibold" numberOfLines={1}>{inv.invitee_name ?? "Sin nombre"}</T>
                    <T style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>{inv.membership === "temporary" ? "Temporal" : "Fijo"}{inv.expires_at ? ` · hasta ${new Date(inv.expires_at).toLocaleDateString("es-ES")}` : ""}</T>
                  </View>
                  <Pill label={st.label} tone={st.tone} />
                  {open ? <Pressable testID={`invitation-share-${inv.token}`} onPress={() => dispatch(inv, "share")} style={s.iconBtn} accessibilityLabel="Compartir enlace"><Ionicons name="share-social" size={16} color={colors.onSurface} /></Pressable> : null}
                </View>
              );
            })}
            {invitations.isSuccess && (invitations.data ?? []).length === 0 ? <T style={{ color: colors.muted }}>Todavía no has invitado a nadie.</T> : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.hairline, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.card, borderRadius: radius.md + 2, padding: spacing.md, borderWidth: 1, borderColor: c.hairline },
  dot: { width: 12, height: 12, borderRadius: 6 },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.md, gap: spacing.sm },
  input: { height: 48, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.md, fontFamily: fonts.regular, fontSize: 15, color: c.onSurface },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
  chipOn: { backgroundColor: c.brandSoft, borderColor: c.brandPrimary },
  linkBox: { backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.borderStrong, padding: spacing.md },
}));
