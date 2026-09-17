// Top horizontal group chips (Google-Maps-style elongated buttons): name + members · connected · alerts.
import Ionicons from "@react-native-vector-icons/ionicons";
import React, { useEffect } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";

import { T } from "@/src/components/ui";
import { makeStyles, useTheme } from "@/src/theme";

export type GroupChip = { id: string; name: string; members: number; connected: number; alerts: number };

function Chip({ g, active, onPress }: { g: GroupChip; active: boolean; onPress: () => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (g.alerts > 0) pulse.value = withRepeat(withSequence(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 700 })), -1, true);
    else pulse.value = 0;
  }, [g.alerts, pulse]);
  const dot = useAnimatedStyle(() => ({ opacity: 0.5 + pulse.value * 0.5, transform: [{ scale: 1 + pulse.value * 0.25 }] }));
  return (
    <Pressable testID={`group-chip-${g.id}`} onPress={onPress} style={[s.chip, active && { borderColor: colors.brandPrimary, backgroundColor: colors.surfaceSecondary }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name="people" size={15} color={active ? colors.brandPrimary : colors.onSurface} />
        <T weight="bold" style={{ fontSize: 13.5, color: colors.onSurface, maxWidth: 130 }} numberOfLines={1}>{g.name}</T>
        {g.alerts > 0 ? <Animated.View style={[s.alertDot, { backgroundColor: colors.error }, dot]} /> : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
        <T style={{ fontSize: 11, color: colors.muted }}>{g.members} miembro{g.members === 1 ? "" : "s"}</T>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: g.connected > 0 ? colors.success : colors.pending }} />
          <T style={{ fontSize: 11, color: colors.muted }}>{g.connected} en línea</T>
        </View>
        {g.alerts > 0 ? <T weight="semibold" style={{ fontSize: 11, color: colors.error }}>{g.alerts} aviso{g.alerts === 1 ? "" : "s"}</T> : null}
      </View>
    </Pressable>
  );
}

export function GroupsBar({ groups, activeId, onPress, style }: { groups: GroupChip[]; activeId?: string; onPress: (id: string) => void; style?: any }) {
  if (!groups.length) return null;
  return (
    <View style={style} pointerEvents="box-none" testID="groups-bar">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
        {groups.map((g) => <Chip key={g.id} g={g} active={g.id === activeId} onPress={() => onPress(g.id)} />)}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  chip: { minWidth: 150, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: c.glassStrong, borderWidth: 1.5, borderColor: c.border,
    shadowColor: c.surfaceInverse, shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  alertDot: { width: 9, height: 9, borderRadius: 5, marginLeft: 2 },
}));
