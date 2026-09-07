// Left rail: small avatars of the group members. Tap → the map centers on that person (if they share their position).
import React from "react";
import { Pressable, ScrollView, View } from "react-native";

import type { MapPerson } from "@/src/components/MapCanvas";
import { T, toast } from "@/src/components/ui";
import { makeStyles, useTheme } from "@/src/theme";

export function MembersRail({ people, top, onFocus, testID = "members-rail" }: { people: MapPerson[]; top: number; onFocus: (p: MapPerson) => void; testID?: string }) {
  const s = useStyles(); const { colors } = useTheme();
  if (!people.length) return null;
  const ordered = [...people].sort((a, b) => Number(!!b.is_me) - Number(!!a.is_me));
  return (
    <View style={[s.rail, { top }]} pointerEvents="box-none" testID={testID}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ maxHeight: 44 * 6 }}>
        {ordered.map((p) => {
          const shared = p.state === "shared" && p.lat != null;
          return (
            <Pressable key={p.member_id} testID={`rail-${p.member_id}`} accessibilityLabel={p.name}
              onPress={() => (shared ? onFocus(p) : toast(`${p.name}: ${p.label ?? "ubicación no compartida"}`))}
              style={[s.avatar, { borderColor: shared ? p.color : colors.border, opacity: shared ? 1 : 0.55 }]}>
              <T weight="bold" style={{ fontSize: 13, color: colors.onSurface }}>{(p.name || "?").charAt(0).toUpperCase()}</T>
              {shared ? <View style={[s.live, { backgroundColor: p.color }]} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  rail: { position: "absolute", left: 12, alignItems: "center" },
  avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, backgroundColor: c.glassStrong, alignItems: "center", justifyContent: "center", shadowColor: c.surfaceInverse, shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  live: { position: "absolute", bottom: -1, right: -1, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: c.glassStrong },
}));
