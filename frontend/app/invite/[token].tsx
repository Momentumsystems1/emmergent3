// Invitation acceptance via deep link /invite/<token>. Restores context; requires an account; never fabricates location.
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { setLocalOnboarding, useAuth } from "@/src/auth";
import { Button, Glass, Pill, T, toast } from "@/src/components/ui";
import { makeStyles, spacing, useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";

export default function Invite() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { user, loading, reload } = useAuth();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const inv = useQuery({ queryKey: ["invite", token], queryFn: () => api<any>(`/invitations/by-token/${token}`, { auth: false }) });
  const respond = useMutation({
    mutationFn: (accept: boolean) => api<any>(`/invitations/by-token/${token}/respond`, { method: "POST", json: { accept } }),
    onSuccess: async (r) => {
      await storage.removeItem("sentinel.pending_invite");
      if (r.status === "accepted") {
        await api("/profile/onboarding-step", { method: "PUT", json: { step: "done" } });
        await reload();
        toast("Te has unido al grupo. Configura qué compartes en Privacidad.", "success");
        router.replace("/map");
      } else router.replace("/");
    },
    onError: (e: any) => toast(e.message, "error"),
  });

  const goAuth = async () => {
    await storage.setItem("sentinel.pending_invite", token);
    await setLocalOnboarding({ step: "terms" });
    router.push("/onboarding/terms");
  };

  const d = inv.data;
  const open = d && (d.status === "prepared" || d.status === "dispatched" || d.status === "open");
  return (
    <View style={[s.root, { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xl }]} testID="invite-screen">
      <Glass>
        <T style={{ color: colors.brandPrimary, fontSize: 11, letterSpacing: 1.2 }}>INVITACIÓN A SENTINEL</T>
        {inv.isLoading ? <T style={{ marginTop: 8 }}>Cargando…</T> : null}
        {inv.isError ? <T style={{ marginTop: 8 }} testID="invite-error">Invitación no encontrada o enlace no válido.</T> : null}
        {d ? (
          <>
            <T weight="bold" style={{ fontSize: 22, marginTop: 6 }} testID="invite-group-name">Grupo {d.group_name}</T>
            <T style={{ color: colors.muted, marginTop: 4 }}>{d.multi ? `Enlace de grupo: al aceptar entrarás como miembro fijo de ${d.group_name}.` : `Hola ${d.name}, te han invitado como ${d.membership === "temporary" ? "invitado temporal" : "miembro fijo"}.`}{d.expires_at ? ` La invitación expira el ${new Date(d.expires_at).toLocaleString("es-ES")}.` : ""}</T>
            <View style={{ marginTop: spacing.md }}><Pill testID="invite-status" label={{ prepared: "Pendiente", dispatched: "Pendiente", open: "Enlace activo", accepted: "Ya aceptada", declined: "Rechazada", expired: "Expirada", cancelled: "Cancelada" }[d.status as string] ?? d.status} tone={open ? "amber" : "muted"} /></View>
            <T style={{ color: colors.muted, fontSize: 12, marginTop: spacing.md }}>Al aceptar decides tú qué compartes. Nadie verá tu ubicación hasta que la actives y concedas el permiso del dispositivo.</T>
            <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
              {open && !loading && user ? <Button testID="invite-accept" title="Aceptar y unirme" onPress={() => respond.mutate(true)} loading={respond.isPending} /> : null}
              {open && !loading && user ? <Button testID="invite-decline" title="No puedo unirme" variant="ghost" onPress={() => respond.mutate(false)} /> : null}
              {open && !loading && !user ? <Button testID="invite-create-account" title="Crear cuenta para aceptar" onPress={goAuth} /> : null}
              {!open ? <Button testID="invite-home" title="Ir a Sentinel" variant="secondary" onPress={() => router.replace("/")} /> : null}
            </View>
          </>
        ) : null}
      </Glass>
    </View>
  );
}
const useStyles = makeStyles((c) => ({ root: { flex: 1, backgroundColor: c.surface, padding: spacing.xl, justifyContent: "center" } }));
