// Right-side member rail: one thin black-blur rectangle per group member.
// Layout: [avatar circle with the member's color border] · name · street+number · ">".
// Tapping a rectangle opens that member's mobility-tools sheet.
import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { Pressable, ScrollView, View } from "react-native";

import { api } from "@/src/api";
import { BLUR_MUTED, BLUR_TEXT, BlurCard } from "@/src/components/BlurCard";
import type { MapPerson } from "@/src/components/mapTypes";
import { T } from "@/src/components/ui";
import { UserPhoto } from "@/src/components/UserPhoto";
import { radius, spacing } from "@/src/theme";

const BAR = 40;
const AVATAR = 46;

function addressOf(street?: string | null, number?: string | null, municipality?: string | null, name?: string | null) {
  if (street) return number ? `${street}, ${number}` : street;
  return municipality || name || "Ubicación obtenida";
}

function MemberRow({ m, onPress }: { m: MapPerson; onPress: () => void }) {
  const located = m.state === "shared" && m.lat != null && m.lng != null;
  const rev = useQuery({
    queryKey: ["reverse", m.lat?.toFixed(4), m.lng?.toFixed(4)],
    enabled: located, staleTime: 120000, retry: false,
    queryFn: () => api<{ name: string; street?: string; number?: string; municipality?: string }>(`/mobility/reverse?lat=${m.lat}&lng=${m.lng}`),
  });
  const sub = !located
    ? (m.label || "Ubicación no compartida")
    : rev.isLoading ? "Buscando dirección…"
      : addressOf(rev.data?.street, rev.data?.number, rev.data?.municipality, rev.data?.name);
  return (
    <Pressable testID={`member-rect-${m.member_id}`} onPress={onPress} accessibilityLabel={`Herramientas de ${m.name}`}>
      <BlurCard rounded={radius.pill} style={{ height: BAR, justifyContent: "center", paddingLeft: AVATAR - 6, paddingRight: 8, marginLeft: AVATAR / 2 - 2, opacity: located ? 1 : 0.7 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "baseline", gap: 5 }}>
            <T weight="bold" style={{ fontSize: 12.5, color: BLUR_TEXT, maxWidth: 96 }} numberOfLines={1}>{m.name}</T>
            <T style={{ fontSize: 11, color: BLUR_MUTED, flex: 1 }} numberOfLines={1}>{sub}</T>
          </View>
          <Ionicons name="chevron-forward" size={16} color={BLUR_TEXT} />
        </View>
      </BlurCard>
      <View style={{ position: "absolute", left: 0, top: (BAR - AVATAR) / 2, width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, borderWidth: 2.5, borderColor: m.color, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <UserPhoto userId={m.user_id} name={m.name} color={m.color} size={AVATAR - 5} hasPhoto={m.has_photo} />
      </View>
    </Pressable>
  );
}

export function MemberRail({ members, top, bottom, onPress }: { members: MapPerson[]; top: number; bottom: number; onPress: (m: MapPerson) => void }) {
  if (!members.length) return null;
  return (
    <View style={{ position: "absolute", right: spacing.md, top, bottom }} pointerEvents="box-none" testID="member-rail">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
        {members.map((m) => <MemberRow key={m.member_id} m={m} onPress={() => onPress(m)} />)}
      </ScrollView>
    </View>
  );
}
