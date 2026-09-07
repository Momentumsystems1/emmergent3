// Profile photo picker + upload (expo-image-picker → backend → Emergent Object Storage). Contextual permission flow.
import Ionicons from "@react-native-vector-icons/ionicons";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, View } from "react-native";

import { BASE, loadTokens } from "@/src/api";
import { UserPhoto } from "@/src/components/UserPhoto";
import { T, toast } from "@/src/components/ui";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export function PhotoPicker({ userId, name, color, hasPhoto, onUploaded, size = 84 }: { userId?: string; name: string; color: string; hasPhoto?: boolean; onUploaded: () => void; size?: number }) {
  const s = useStyles(); const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [version, setVersion] = useState(0);

  const pick = async () => {
    if (Platform.OS !== "web") {
      const cur = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (!cur.granted) {
        if (!cur.canAskAgain) { setBlocked(true); return; }
        const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!req.granted) { if (!req.canAskAgain) setBlocked(true); else toast("Sin acceso a tus fotos no podemos elegir una imagen"); return; }
      }
    }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    setBusy(true);
    try {
      const form = new FormData();
      const type = a.mimeType ?? "image/jpeg";
      const fname = a.fileName ?? `photo.${type.includes("png") ? "png" : "jpg"}`;
      if (Platform.OS === "web") form.append("file", await (await fetch(a.uri)).blob(), fname);
      else form.append("file", { uri: a.uri, name: fname, type } as any);
      const t = await loadTokens();
      const res = await fetch(`${BASE}/profile/photo`, { method: "POST", headers: { Authorization: `Bearer ${t?.access_token ?? ""}` }, body: form });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail ?? `Error ${res.status}`); }
      setVersion((v) => v + 1); onUploaded(); toast("Foto actualizada", "success");
    } catch (e: any) { toast(e.message ?? "No se pudo subir la foto", "error"); } finally { setBusy(false); }
  };

  return (
    <View style={{ alignItems: "center", gap: spacing.sm }} testID="photo-picker">
      <Pressable testID="photo-pick" onPress={pick} disabled={busy} style={s.wrap}>
        <UserPhoto userId={userId} name={name} color={color} size={size} hasPhoto={hasPhoto || version > 0} version={version} />
        <View style={s.badge}>{busy ? <ActivityIndicator size="small" color={colors.onBrandPrimary} /> : <Ionicons name="camera" size={14} color={colors.onBrandPrimary} />}</View>
      </Pressable>
      <T style={{ fontSize: 12, color: colors.muted }}>{busy ? "Subiendo…" : "Toca para elegir una foto (opcional)"}</T>
      {blocked ? <Pressable testID="photo-open-settings" onPress={() => Linking.openSettings().catch(() => null)} style={s.settings}><T weight="semibold" style={{ fontSize: 12 }}>Acceso a fotos bloqueado · Abrir ajustes</T></Pressable> : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { position: "relative" },
  badge: { position: "absolute", right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.surface },
  settings: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border },
}));
