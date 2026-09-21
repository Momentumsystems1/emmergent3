// Granular consent: independent switches, each with what / why / with whom / how long. Never a single "Compartir todo".
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Switch, View } from "react-native";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { OnboardingScreen } from "@/src/components/OnboardingScreen";
import { T, toast } from "@/src/components/ui";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Cat = { key: string; label: string; why: string };
const DEFAULT_ON = new Set(["exact_location", "eta", "status", "safety_alerts", "group_visibility"]);

export default function Consent() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useStyles();
  const qc = useQueryClient();
  const { reload } = useAuth();
  const catalog = useQuery({ queryKey: ["perm-catalog"], queryFn: () => api<Cat[]>("/permissions/catalog") });
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries([...DEFAULT_ON].map((k) => [k, true])));
  const [loading, setLoading] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      const cats = catalog.data ?? [];
      // En paralelo: 12 permisos secuenciales eran ~15 s de spinner (parecía colgado).
      await Promise.all(cats.map((c) => api("/permissions", { method: "POST", json: { key: c.key, granted: !!on[c.key], scope: "all", reason: "onboarding" } })));
      await api("/profile/onboarding-step", { method: "PUT", json: { step: "profile" } });
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["permissions"] }); await reload(); router.replace("/onboarding/profile"); },
    onError: (e: any) => toast(e?.message ?? "No se pudieron guardar los permisos", "error"),
  });

  return (
    <OnboardingScreen step="consent" testID="onboarding-consent" title="Decide qué compartes" body="Cada permiso es independiente y puedes cambiarlo en cualquier momento desde tu Tarjeta de Privacidad. Se aplica a tus grupos hasta que lo revoques."
      primary="Guardar y continuar" loading={loading || save.isPending} onPrimary={() => { setLoading(true); save.mutate(undefined, { onSettled: () => setLoading(false) }); }}>
      <View style={{ gap: spacing.sm }}>
        {(catalog.data ?? []).map((c) => (
          <View key={c.key} style={s.row} testID={`consent-row-${c.key}`}>
            <View style={{ flex: 1 }}>
              <T weight="semibold" style={{ fontSize: 15 }}>{c.label}</T>
              <T style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{c.why} · Con: tus grupos · Duración: hasta revocar</T>
            </View>
            <Switch testID={`consent-switch-${c.key}`} value={!!on[c.key]} onValueChange={(v) => setOn({ ...on, [c.key]: v })} trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} />
          </View>
        ))}
        {catalog.isLoading ? <T style={{ color: colors.muted }}>Cargando permisos…</T> : null}
      </View>
    </OnboardingScreen>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: c.border },
}));
