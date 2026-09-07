// Permanent "what am I sharing and with whom" control. FAB + compact panel (never covers the map). Modify → /privacy.
import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Button, T } from "@/src/components/ui";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const LABELS: Record<string, string> = { exact_location: "Ubicación exacta", approx_location: "Zona aproximada", eta: "ETA", status: "Estado", recent_route: "Ruta reciente", mobility_mode: "Modo de movilidad", patterns: "Patrones", safety_alerts: "Alertas", v16: "V16", camera: "Cámara", microphone: "Micrófono", road_reality: "Road Reality", metrics: "Métricas", group_visibility: "Visibilidad" };

export function useSharingSummary() {
  const { user } = useAuth();
  const perms = useQuery({ queryKey: ["permissions"], queryFn: () => api<Record<string, any>>("/permissions"), refetchInterval: 30000 });
  const groups = useQuery({ queryKey: ["groups"], queryFn: () => api<any[]>("/groups") });
  const active = Object.values(perms.data ?? {}).filter((v: any) => v.effective) as any[];
  const keys = Array.from(new Set(active.map((v) => v.key as string)));
  const group = groups.data?.[0];
  const withWhom = (group?.members ?? []).filter((m: any) => m.status === "active" && m.user_id && m.user_id !== user?.id).map((m: any) => m.display_name as string);
  const sharesLocation = keys.includes("exact_location") || keys.includes("approx_location");
  return { keys, withWhom, group, sharesLocation, loaded: perms.isSuccess };
}

export function SharingFab({ open, onPress, testID = "fab-sharing" }: { open: boolean; onPress: () => void; testID?: string }) {
  const s = useStyles(); const { colors } = useTheme();
  const { sharesLocation, keys } = useSharingSummary();
  return (
    <Pressable testID={testID} onPress={onPress} style={[s.fab, open && s.fabOn]} accessibilityLabel="Qué comparto y con quién">
      <Ionicons name="shield-checkmark" size={20} color={open ? colors.onBrandPrimary : colors.onSurface} />
      <View style={[s.dot, { backgroundColor: sharesLocation ? colors.success : keys.length ? colors.warning : colors.pending }]} />
    </Pressable>
  );
}

export function SharingPanel({ onClose, bottom }: { onClose: () => void; bottom: number }) {
  const s = useStyles(); const { colors } = useTheme(); const router = useRouter();
  const { keys, withWhom, group, sharesLocation, loaded } = useSharingSummary();
  return (
    <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOut.duration(120)} style={[s.panel, { bottom }]} testID="sharing-panel">
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Ionicons name="shield-checkmark" size={18} color={sharesLocation ? colors.success : colors.warning} />
        <T weight="bold" style={{ fontSize: 14, flex: 1 }}>{!loaded ? "Comprobando…" : keys.length ? `Compartes ${keys.length} ${keys.length === 1 ? "dato" : "datos"}` : "No compartes nada"}</T>
        <Pressable testID="sharing-close" onPress={onClose} hitSlop={8} style={s.closeBtn}><Ionicons name="close" size={16} color={colors.onSurface} /></Pressable>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.sm }}>
        {keys.length ? keys.map((k) => <View key={k} style={s.tag} testID={`sharing-key-${k}`}><T style={{ fontSize: 11 }}>{LABELS[k] ?? k}</T></View>) : <T style={{ fontSize: 12, color: colors.muted }}>Nadie ve tu ubicación ni tu estado.</T>}
      </View>
      <T style={{ fontSize: 12, color: colors.muted, marginTop: spacing.sm }} testID="sharing-with">
        {group ? (withWhom.length ? `Con: ${withWhom.join(", ")} (${group.name})` : `Grupo ${group.name}: aún nadie más activo`) : "Sin grupo: no compartes con nadie"}
      </T>
      <View style={{ marginTop: spacing.sm }}><Button small testID="sharing-modify" title="Modificar permisos" icon="options" variant="secondary" onPress={() => { onClose(); router.push("/privacy"); }} /></View>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  fab: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.glassStrong, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center", shadowColor: c.surfaceInverse, shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  fabOn: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  dot: { position: "absolute", top: 6, right: 6, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: c.glassStrong },
  panel: { position: "absolute", left: spacing.md, right: spacing.md + 60, backgroundColor: c.glassStrong, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.md, shadowColor: c.surfaceInverse, shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border },
}));
