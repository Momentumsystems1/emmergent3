// Invitation acceptance. Token arrives via /invite/<token> (deep link) or /?invite=<token> (web static hosting).
// Preview works without account (anon RPC); accepting requires an account (P1: the person creates it through this flow).
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { setLocalOnboarding, useAuth } from "@/src/auth";
import { Button, Glass, Pill, T, toast } from "@/src/components/ui";
import { acceptInvitation, getInvitationPreview } from "@/src/sb";
import { makeStyles, spacing, useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";
import { PENDING_INVITE_KEY } from "../onboarding/account";

export default function Invite() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { user, loading, reload } = useAuth();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const [accepting, setAccepting] = useState(false);

  const inv = useQuery({ queryKey: ["invite", token], queryFn: () => getInvitationPreview(token!), enabled: !!token, retry: false });
  const d = inv.data;
  const invalid = inv.isError || !!d?.error;
  const errLabel = d?.error === "expired" ? "Esta invitación ha expirado." : d?.error === "accepted" ? "Esta invitación ya fue aceptada." : d?.error ? "Invitación no válida o ya utilizada." : null;

  const accept = async () => {
    setAccepting(true);
    try {
      const r = await acceptInvitation(token!);
      if (r.error) { toast(r.error === "expired" ? "La invitación ha expirado" : "No se pudo aceptar la invitación", "error"); return; }
      await storage.removeItem(PENDING_INVITE_KEY);
      await reload();
      toast(`Te has unido a ${r.group_name ?? "el grupo"}`, "success");
      router.replace("/map");
    } catch (e: any) { toast(e?.message ?? "No se pudo aceptar la invitación", "error"); } finally { setAccepting(false); }
  };

  const goAuth = async () => {
    await storage.setItem(PENDING_INVITE_KEY, token ?? null);
    await setLocalOnboarding({ step: "terms" });
    router.push("/welcome");
  };

  return (
    <View style={[s.root, { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xl }]} testID="invite-screen">
      <Glass>
        <T style={{ color: colors.brandPrimary, fontSize: 11, letterSpacing: 1.2 }}>INVITACIÓN A MY CLUSTER</T>
        {inv.isLoading ? <T style={{ marginTop: 8 }}>Cargando…</T> : null}
        {invalid && !inv.isLoading ? <T style={{ marginTop: 8 }} testID="invite-error">{errLabel ?? "Invitación no encontrada o enlace no válido."}</T> : null}
        {d && !invalid ? (
          <>
            <T weight="bold" style={{ fontSize: 22, marginTop: 6 }} testID="invite-group-name">Grupo {d.group_name}</T>
            <T style={{ color: colors.muted, marginTop: 4 }}>
              {d.invitee_name ? `Hola ${d.invitee_name}, ` : ""}{d.inviter_name ? `${d.inviter_name} te ha invitado` : "Te han invitado"} como {d.membership === "temporary" ? "invitado temporal" : "miembro fijo"}.
              {d.expires_at ? ` ${d.membership === "temporary" ? "Tu acceso termina" : "La invitación expira"} el ${new Date(d.expires_at).toLocaleString("es-ES")}.` : ""}
            </T>
            <View style={{ marginTop: spacing.md }}><Pill testID="invite-status" label="Enlace activo" tone="amber" /></View>
            <T style={{ color: colors.muted, fontSize: 12, marginTop: spacing.md }}>Al aceptar decides tú qué compartes. Nadie verá tu ubicación hasta que la actives y concedas el permiso del dispositivo.</T>
            <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
              {!loading && user ? <Button testID="invite-accept" title="Aceptar y unirme" onPress={accept} loading={accepting} /> : null}
              {!loading && !user ? <Button testID="invite-create-account" title="Crear cuenta para aceptar" onPress={goAuth} /> : null}
              {!loading && !user ? <Button testID="invite-login" title="Ya tengo cuenta" variant="ghost" onPress={async () => { await storage.setItem(PENDING_INVITE_KEY, token ?? null); router.push("/onboarding/account"); }} /> : null}
            </View>
          </>
        ) : null}
        {invalid && !inv.isLoading ? <View style={{ marginTop: spacing.lg }}><Button testID="invite-home" title="Ir a My Cluster" variant="secondary" onPress={() => router.replace("/")} /></View> : null}
      </Glass>
    </View>
  );
}
const useStyles = makeStyles((c) => ({ root: { flex: 1, backgroundColor: c.surface, padding: spacing.xl, justifyContent: "center" } }));
