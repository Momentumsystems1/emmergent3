// Profile / Sistema: identity, avatar (photo upload), plan, legal documents, consent history, sign out.
import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, BASE, loadTokens } from "@/src/api";
import { useAuth } from "@/src/auth";
import { PersonAvatar } from "@/src/components/orbs";
import { Button, Header, Pill, T, toast } from "@/src/components/ui";
import { UserPhoto } from "@/src/components/UserPhoto";
import { AVATAR_COLORS } from "@/src/copy";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, reload, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const [name, setName] = useState(user?.profile?.name ?? "");
  const [color, setColor] = useState(user?.avatar?.color ?? AVATAR_COLORS[0]);
  const [uploading, setUploading] = useState(false);
  const [photoV, setPhotoV] = useState(0);
  const consents = useQuery({ queryKey: ["consents"], queryFn: () => api<any[]>("/consents") });
  const ent = useQuery({ queryKey: ["entitlements"], queryFn: () => api<any>("/entitlements") });
  const save = useMutation({
    mutationFn: async () => { await api("/profile", { method: "PUT", json: { name, language: "es" } }); await api("/profile/avatar", { method: "PUT", json: { color, symbol: user?.avatar?.symbol ?? "pin", outline: "solid" } }); await api("/profile/onboarding-step", { method: "PUT", json: { step: user?.onboarding?.completed ? "done" : user?.onboarding?.step } }); },
    onSuccess: async () => { await reload(); toast("Perfil actualizado", "success"); }, onError: (e: any) => toast(e.message, "error"),
  });
  const uploadPhoto = async (uri: string) => {
    setUploading(true);
    try {
      const t = await loadTokens();
      const form = new FormData();
      const ext = uri.split(".").pop()?.toLowerCase();
      const type = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      if (Platform.OS === "web") {
        // En web uri es blob:/data: y FormData necesita un Blob real, no el objeto {uri} de RN
        const blob = await (await fetch(uri)).blob();
        form.append("file", blob, `avatar.${ext === "png" || ext === "webp" ? ext : "jpg"}`);
      } else {
        form.append("file", { uri, name: `avatar.${ext || "jpg"}`, type } as any);
      }
      const r = await fetch(`${BASE}/profile/photo`, { method: "POST", headers: { Authorization: `Bearer ${t?.access_token}` }, body: form });
      if (!r.ok) { const b = await r.json().catch(() => null); throw new Error(b?.detail ?? "No se pudo subir la foto"); }
      await reload(); setPhotoV((v) => v + 1); toast("Foto actualizada", "success");
    } catch (e: any) { toast(e.message, "error"); } finally { setUploading(false); }
  };
  const pickPhoto = async () => {
    const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    let status = perm;
    if (!perm.granted && perm.canAskAgain) status = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!status.granted) {
      if (!status.canAskAgain) { toast("Permite el acceso a fotos en Ajustes"); Linking.openSettings(); }
      else toast("Sin permiso para acceder a tus fotos");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!res.canceled && res.assets[0]?.uri) await uploadPhoto(res.assets[0].uri);
  };
  const removePhoto = async () => {
    try { await api("/profile/photo", { method: "DELETE" }); await reload(); setPhotoV((v) => v + 1); toast("Foto eliminada"); }
    catch (e: any) { toast(e.message, "error"); }
  };
  return (
    <View style={s.root} testID="profile-screen">
      <Header title="Perfil y sistema" />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }} bottomOffset={24}>
        <View style={{ alignItems: "center", gap: spacing.sm }}>
          <Pressable testID="profile-avatar-pick" onPress={pickPhoto} disabled={uploading} style={{ width: 96, height: 96 }}>
            {user?.has_photo
              ? <View style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: color, overflow: "hidden" }}><UserPhoto userId={user?.id} name={name || "?"} color={color} size={90} hasPhoto version={photoV} /></View>
              : <PersonAvatar name={name || "?"} color={color} size={72} symbol={user?.avatar?.symbol} />}
            <View style={[s.camBadge, { backgroundColor: colors.brandPrimary }]}>{uploading ? <ActivityIndicator size="small" color={colors.onBrandPrimary} /> : <Ionicons name="camera" size={16} color={colors.onBrandPrimary} />}</View>
          </Pressable>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Button small testID="profile-photo-change" title={user?.has_photo ? "Cambiar foto" : "Subir foto"} variant="secondary" icon="image" onPress={pickPhoto} />
            {user?.has_photo ? <Button small testID="profile-photo-remove" title="Quitar" variant="ghost" icon="trash" onPress={removePhoto} /> : null}
          </View>
        </View>
        <TextInput testID="profile-edit-name" style={s.input} value={name} onChangeText={setName} placeholder="Nombre" placeholderTextColor={colors.muted} />
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>{AVATAR_COLORS.map((c) => <Pressable key={c} testID={`profile-color-${c.replace("#", "")}`} onPress={() => setColor(c)} style={[s.swatch, { backgroundColor: c }, color === c && { borderColor: colors.onSurface }]} />)}</View>
        <Button testID="profile-save" title="Guardar" onPress={() => save.mutate()} loading={save.isPending} disabled={!name.trim()} />
        <View style={s.card}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><T weight="bold" style={{ flex: 1 }}>Plan</T><Pill label={ent.data?.plan_name ?? "—"} tone="cyan" /></View>
          <T style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>Cuenta: {user?.email} · rol {user?.account_role}</T>
          <View style={{ marginTop: spacing.sm }}><Button small testID="profile-plans" title="Ver planes" variant="secondary" onPress={() => router.push("/plans")} /></View>
        </View>
        <View style={s.card}>
          <T weight="bold">Documentos y consentimientos</T>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: spacing.sm }}>
            {[["terms", "Condiciones"], ["privacy", "Privacidad"], ["security", "Seguridad"], ["how", "Cómo funciona"]].map(([k, l]) => <Button key={k} small testID={`legal-${k}`} title={l} variant="secondary" onPress={() => router.push(`/legal/${k}`)} />)}
          </View>
          {(consents.data ?? []).map((c) => <T key={c.id} style={{ fontSize: 12, color: colors.muted, marginTop: 6 }} testID="consent-row">{c.document} v{c.version} · {c.status} · {new Date(c.recorded_at).toLocaleString("es-ES")} · {c.platform}</T>)}
        </View>
        <View style={s.card}>
          <T weight="bold">Accesibilidad</T>
          <T style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>MY CLUSTER respeta “Reducir movimiento” del sistema, usa color + icono + texto en todos los estados y objetivos táctiles de al menos 44 pt. El tema Día/Noche sigue la configuración del dispositivo.</T>
        </View>
        <Button testID="profile-signout" title="Cerrar sesión" variant="ghost" onPress={async () => { await signOut(); router.replace("/onboarding/account"); }} />
      </KeyboardAwareScrollView>
    </View>
  );
}
const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  input: { height: 52, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.lg, fontFamily: fonts.regular, fontSize: 15, color: c.onSurface },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 3, borderColor: "transparent" },
  camBadge: { position: "absolute", right: 2, bottom: 2, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.surface },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: c.border },
}));
