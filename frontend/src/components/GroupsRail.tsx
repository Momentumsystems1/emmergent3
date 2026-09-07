// Left rail of GROUPS. A group needing attention (pending invitations, trip invites…) pulses with a red border and a
// numeric badge. Tap → group screen.
import Ionicons from "@react-native-vector-icons/ionicons";
import React, { useEffect } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";

import { T } from "@/src/components/ui";
import { makeStyles, useTheme } from "@/src/theme";

export type RailGroup = { id: string; name: string; attention: number; color?: string };

export function GroupsRail({ groups, top, onPress, activeId }: { groups: RailGroup[]; top: number; onPress: (g: RailGroup) => void; activeId?: string }) {
  const s = useStyles();
  if (!groups.length) return null;
  return (
    <View style={[s.rail, { top }]} pointerEvents="box-none" testID="groups-rail">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10 }} style={{ maxHeight: 50 * 6 }}>
        {groups.map((g) => <GroupBubble key={g.id} g={g} active={g.id === activeId} onPress={() => onPress(g)} />)}
      </ScrollView>
    </View>
  );
}

function GroupBubble({ g, onPress, active }: { g: RailGroup; onPress: () => void; active: boolean }) {
  const s = useStyles(); const { colors } = useTheme();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (g.attention > 0) pulse.value = withRepeat(withSequence(withTiming(1, { duration: 650, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 650, easing: Easing.inOut(Easing.quad) })), -1, false);
    else pulse.value = withTiming(0, { duration: 200 });
  }, [g.attention, pulse]);
  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.06 }],
    borderColor: g.attention > 0 ? (pulse.value > 0.5 ? colors.error : colors.border) : active ? colors.brandPrimary : colors.border,
  }));
  return (
    <Pressable testID={`group-bubble-${g.id}`} onPress={onPress} accessibilityLabel={`Grupo ${g.name}${g.attention ? `, ${g.attention} pendientes` : ""}`}>
      <Animated.View style={[s.bubble, anim]}>
        <Ionicons name="people" size={16} color={g.attention > 0 ? colors.error : colors.onSurface} />
        <T weight="semibold" style={{ fontSize: 8, color: colors.onSurface, marginTop: 1 }} numberOfLines={1}>{g.name.slice(0, 7)}</T>
        {g.attention > 0 ? <View style={s.badge} testID={`group-attention-${g.id}`}><T weight="bold" style={{ fontSize: 9, color: colors.onError }}>{Math.min(9, g.attention)}</T></View> : null}
      </Animated.View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  rail: { position: "absolute", left: 10, alignItems: "center" },
  bubble: { width: 44, height: 44, borderRadius: 22, borderWidth: 2.5, backgroundColor: c.glassStrong, alignItems: "center", justifyContent: "center", shadowColor: c.surfaceInverse, shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  badge: { position: "absolute", top: -5, right: -5, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: c.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 1.5, borderColor: c.glassStrong },
}));
