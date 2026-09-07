// Top-right user card: photo, where you are, battery, active-tasks badge. Tap → expanded card above it.
import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import * as Battery from "expo-battery";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeInUp, FadeOut } from "react-native-reanimated";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import type { LatLng } from "@/src/components/mapTypes";
import { Button, T } from "@/src/components/ui";
import { UserPhoto } from "@/src/components/UserPhoto";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export type Task = { id: string; label: string; kind: string; onPress?: () => void };

export function useBattery() {
  const [level, setLevel] = useState<number | null>(null);
  const [charging, setCharging] = useState(false);
  useEffect(() => {
    let l1: any, l2: any;
    Battery.getBatteryLevelAsync().then((v) => setLevel(v >= 0 ? v : null)).catch(() => null);
    Battery.getBatteryStateAsync().then((st) => setCharging(st === Battery.BatteryState.CHARGING || st === Battery.BatteryState.FULL)).catch(() => null);
    try { l1 = Battery.addBatteryLevelListener(({ batteryLevel }) => setLevel(batteryLevel >= 0 ? batteryLevel : null)); l2 = Battery.addBatteryStateListener(({ batteryState }) => setCharging(batteryState === Battery.BatteryState.CHARGING || batteryState === Battery.BatteryState.FULL)); } catch { /* web */ }
    return () => { l1?.remove?.(); l2?.remove?.(); };
  }, []);
  return { level, charging };
}

export function UserCard({ pos, tasks, top, sharing, onOpen, open, onClose }: { pos: LatLng | null; tasks: Task[]; top: number; sharing: boolean; open: boolean; onOpen: () => void; onClose: () => void }) {
  const s = useStyles(); const { colors } = useTheme(); const router = useRouter();
  const { user } = useAuth();
  const { level, charging } = useBattery();
  const place = useQuery({ queryKey: ["reverse", pos?.lat?.toFixed(3), pos?.lng?.toFixed(3)], enabled: !!pos, staleTime: 120000, retry: false, queryFn: () => api<{ name: string; municipality?: string; street?: string }>(`/mobility/reverse?lat=${pos!.lat}&lng=${pos!.lng}`) });
  const name = user?.profile?.name ?? "Tú";
  const color = user?.avatar?.color ?? colors.brandPrimary;
  const pct = level != null ? Math.round(level * 100) : null;
  const battIcon = charging ? "battery-charging" : pct == null ? "battery-dead" : pct > 60 ? "battery-full" : pct > 25 ? "battery-half" : "battery-dead";
  const battColor = pct != null && pct <= 20 && !charging ? colors.error : colors.onSurface;
  const where = place.data?.municipality ?? place.data?.street ?? (pos ? "Ubicación obtenida" : "Sin ubicación");

  return (
    <View style={[s.wrap, { top }]} pointerEvents="box-none">
      {open ? (
        <Animated.View entering={FadeInUp.duration(160)} exiting={FadeOut.duration(120)} style={s.expanded} testID="user-card-expanded">
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <UserPhoto userId={user?.id} name={name} color={color} size={48} hasPhoto={user?.has_photo} />
            <View style={{ flex: 1 }}><T weight="bold" style={{ fontSize: 15 }}>{name}{user?.profile?.surname ? ` ${user.profile.surname}` : ""}</T><T style={{ fontSize: 12, color: colors.muted }} numberOfLines={2}>{place.data?.name ?? where}</T></View>
            <Pressable testID="user-card-close" onPress={onClose} hitSlop={8} style={s.closeBtn}><Ionicons name="close" size={16} color={colors.onSurface} /></Pressable>
          </View>
          <View style={s.rowInfo}>
            <Info icon={battIcon} color={battColor} text={pct != null ? `${pct}%${charging ? " cargando" : ""}` : "Batería n/d"} />
            <Info icon={sharing ? "location" : "location-outline"} color={sharing ? colors.success : colors.muted} text={sharing ? "Compartiendo ubicación" : "Ubicación no compartida"} />
          </View>
          <T weight="bold" style={{ fontSize: 13, marginTop: spacing.sm }}>{tasks.length ? `${tasks.length} ${tasks.length === 1 ? "tarea activa" : "tareas activas"}` : "Sin tareas activas"}</T>
          {tasks.slice(0, 5).map((t) => <Pressable key={t.id} testID={`task-${t.id}`} onPress={t.onPress} style={s.task}><Ionicons name={t.kind === "trip" ? "car-sport" : t.kind === "invite" ? "person-add" : "calendar"} size={14} color={colors.brandPrimary} /><T style={{ fontSize: 12, flex: 1 }} numberOfLines={1}>{t.label}</T><Ionicons name="chevron-forward" size={14} color={colors.muted} /></Pressable>)}
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
            <Button small testID="user-card-profile" title="Perfil" icon="person" variant="secondary" onPress={() => { onClose(); router.push("/profile"); }} />
            <Button small testID="user-card-privacy" title="Privacidad" icon="lock-closed" variant="secondary" onPress={() => { onClose(); router.push("/privacy"); }} />
          </View>
        </Animated.View>
      ) : null}
      <Pressable testID="user-card" onPress={open ? onClose : onOpen} style={s.card} accessibilityLabel="Tu estado">
        <UserPhoto userId={user?.id} name={name} color={color} size={34} hasPhoto={user?.has_photo} />
        <View style={{ maxWidth: 96 }}>
          <T weight="semibold" style={{ fontSize: 11 }} numberOfLines={1} testID="user-card-place">{where}</T>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}><Ionicons name={battIcon as any} size={12} color={battColor} /><T style={{ fontSize: 10, color: colors.muted }} testID="user-card-battery">{pct != null ? `${pct}%` : "—"}</T></View>
        </View>
        <View style={[s.tasks, { backgroundColor: tasks.length ? colors.brandPrimary : colors.surfaceTertiary }]} testID="user-card-tasks"><T weight="bold" style={{ fontSize: 10, color: tasks.length ? colors.onBrandPrimary : colors.muted }}>{tasks.length}</T></View>
      </Pressable>
    </View>
  );
}

function Info({ icon, color, text }: { icon: string; color: string; text: string }) {
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flex: 1 }}><Ionicons name={icon as any} size={14} color={color} /><T style={{ fontSize: 12 }} numberOfLines={1}>{text}</T></View>;
}

const useStyles = makeStyles((c) => ({
  wrap: { position: "absolute", right: spacing.md, alignItems: "flex-end", gap: spacing.sm },
  card: { flexDirection: "row", alignItems: "center", gap: 8, padding: 5, paddingRight: 8, borderRadius: radius.lg, backgroundColor: c.glassStrong, borderWidth: 1, borderColor: c.border, shadowColor: c.surfaceInverse, shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  tasks: { minWidth: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  expanded: { width: 300, backgroundColor: c.glassStrong, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.md, shadowColor: c.surfaceInverse, shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  rowInfo: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  task: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, borderBottomWidth: 1, borderColor: c.divider },
}));
