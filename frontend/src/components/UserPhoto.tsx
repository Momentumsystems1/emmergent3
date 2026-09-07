// Authenticated profile photo (Object Storage via backend). Native attaches the bearer header; web (<img>) uses ?token=.
// Falls back to the colored initial when there is no photo.
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import { Platform, View } from "react-native";

import { BASE, loadTokens } from "@/src/api";
import { T } from "@/src/components/ui";
import { useTheme } from "@/src/theme";

export function UserPhoto({ userId, name, color, size = 40, hasPhoto, version, ring }: { userId?: string; name: string; color: string; size?: number; hasPhoto?: boolean; version?: string | number; ring?: boolean }) {
  const { colors } = useTheme();
  const [token, setToken] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { if (hasPhoto && userId) loadTokens().then((t) => setToken(t?.access_token ?? null)); }, [hasPhoto, userId, version]);
  const show = !!(hasPhoto && userId && token && !failed);
  const url = show ? `${BASE}/media/user/${userId}/photo?v=${version ?? ""}${Platform.OS === "web" ? `&token=${token}` : ""}` : null;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: ring ? 2 : 0, borderColor: colors.glassStrong }} testID="user-photo">
      {url ? <Image source={Platform.OS === "web" ? { uri: url } : { uri: url, headers: { Authorization: `Bearer ${token}` } }} style={{ width: size, height: size }} contentFit="cover" cachePolicy="memory-disk" onError={() => setFailed(true)} transition={150} />
        : <T weight="bold" style={{ color: colors.onBrandPrimary, fontSize: Math.round(size * 0.42) }}>{(name || "?").charAt(0).toUpperCase()}</T>}
    </View>
  );
}
