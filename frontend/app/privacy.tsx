// ============================================================
// CARDS — PRIVACY CARD SCREEN (double-sided). Front: ¿QUÉ ESTOY COMPARTIENDO? Back: ¿QUIÉN PUEDE ACCEDER AHORA?
// Data: permission_events (effective), sessions, history. All values real; bars = share of active permissions.
// ============================================================
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { fetchPermissionsRecord } from "@/src/permissions";
import { CardBars, CardDivider, CardFooter, CardHeader, CardLabel, CardStatus, Hi, InfoRow, PulseCard, StatusDot, StreamLine } from "@/src/cards/PulseCard";
import { Header, T, toast } from "@/src/components/ui";
import { makeStyles, spacing, useTheme } from "@/src/theme";
import { fetchGroups } from "@/src/groups";

type Cat = { key: string; label: string; why: string };
const hhmm = (d: string) => new Date(d).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function Privacy() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const [flipped, setFlipped] = useState(false);
  const catalog = useQuery({ queryKey: ["perm-catalog"], queryFn: () => api<Cat[]>("/permissions/catalog") });
  const perms = useQuery({ queryKey: ["permissions"], queryFn: fetchPermissionsRecord });
  const history = useQuery({ queryKey: ["perm-history"], queryFn: () => api<any[]>("/permissions/history") });
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: () => api<any[]>("/auth/sessions") });
  const groups = useQuery({ queryKey: ["groups"], queryFn: fetchGroups });
  const toggle = useMutation({
    mutationFn: ({ key, granted }: { key: string; granted: boolean }) => api("/permissions", { method: "POST", json: { key, granted, scope: "all", reason: "privacy_card" } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["permissions"] }); qc.invalidateQueries({ queryKey: ["perm-history"] }); qc.invalidateQueries({ queryKey: ["positions"] }); },
    onError: (e: any) => toast(e.message, "error"),
  });
  const cats = catalog.data ?? [];
  const eff = (k: string) => perms.data?.[`${k}::all`];
  const activeCount = cats.filter((c) => eff(c.key)?.effective).length;
  const recipients = (groups.data ?? []).map((g) => g.name).join(", ") || "nadie (sin grupos)";
  const activeSessions = sessions.data ?? [];
  const hist = history.data ?? [];

  const front = (
    <>
      <CardHeader brand="MY CLUSTER" code={`PRIV_CARD.01 · ${activeCount}/${cats.length || 14}`} />
      <CardBars values={cats.map((c) => (eff(c.key)?.effective ? 1 : 0.15))} tone={colors.brandPrimary} />
      <CardLabel>¿Qué estoy compartiendo?</CardLabel>
      <CardStatus>Compartes <Hi>{String(activeCount)}</Hi> de {cats.length} categorías con <Hi>{recipients}</Hi>. Cada permiso es independiente y revocable.</CardStatus>
      <CardDivider />
      {cats.map((c) => {
        const e = eff(c.key); const on = !!e?.effective;
        return (
          <View key={c.key} style={s.row} testID={`privacy-row-${c.key}`}>
            <View style={{ flex: 1 }}>
              <T weight="semibold" style={{ fontSize: 13.5 }}>{c.label}</T>
              <T style={{ fontSize: 11, color: colors.muted }}>{on ? `→ ${recipients} · ${e?.expires_at ? `hasta ${hhmm(e.expires_at)}` : "hasta revocar"}` : "Inactivo"}</T>
            </View>
            <Switch testID={`privacy-switch-${c.key}`} value={on} onValueChange={(v) => toggle.mutate({ key: c.key, granted: v })} trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} />
          </View>
        );
      })}
      <CardFooter left={hist[0] ? hhmm(hist[0].created_at) : "--:--:--"} level={Math.round((activeCount / Math.max(1, cats.length)) * 4)} right={`${hist.length} eventos`} />
    </>
  );

  const back = (
    <>
      <CardHeader brand="Accesos activos" code="WHO_CAN_ACCESS.NOW" />
      <InfoRow label="Sesiones" value={`${activeSessions.length} activa(s)`} testID="session-row" />
      <InfoRow label="Permisos temporales" value={String(Object.values(perms.data ?? {}).filter((p: any) => p.expires_at && p.effective).length)} />
      <InfoRow label="Cámara" value="Sin conexiones · no configurado" tone={colors.muted} />
      <InfoRow label="Dispositivos" value={`${activeSessions.length}`} />
      <InfoRow label="Expira sesión" value={activeSessions[0] ? new Date(activeSessions[0].expires_at).toLocaleDateString("es-ES") : "—"} />
      <CardDivider />
      <CardLabel>Historial de permisos</CardLabel>
      {hist.length === 0 ? <T style={{ color: colors.muted, fontSize: 12 }}>Sin cambios registrados</T> : null}
      {hist.slice(0, 30).map((h) => <View key={h.id} testID="history-row"><StreamLine ts={hhmm(h.created_at)} key_={h.granted ? "GRANT" : "REVOKE"} value={`${h.key} · ${h.scope}${h.reason ? ` · ${h.reason}` : ""}`} ok={h.granted} /></View>)}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 18 }}><StatusDot active={activeCount > 0} /><T style={{ fontSize: 11, color: colors.muted }}>{activeCount > 0 ? "COMPARTIENDO" : "SIN COMPARTIR"} · v1.0.0</T></View>
    </>
  );

  return (
    <View style={s.root} testID="privacy-screen">
      <Header title="Privacidad" />
      <View style={{ flex: 1, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
        <PulseCard testID="privacy-card" front={front} back={back} flipped={flipped} onFlip={() => setFlipped(!flipped)} />
      </View>
    </View>
  );
}
const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 8, borderBottomWidth: 1, borderColor: c.divider },
}));
