// Profile: identity (name + avatar color), account, sign out.
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { Button, Header, T, toast } from "@/src/components/ui";
import { AVATAR_COLORS } from "@/src/copy";
import { upsertProfile } from "@/src/sb";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, reload, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const [name, setName] = useState(user?.profile?.name ?? "");
  const [color, setColor] = useState(user?.avatar?.color ?? AVATAR_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await upsertProfile({ display_name: name.trim(), avatar_color: color });
      await reload();
      toast("Perfil actualizado", "success");
    } catch (e: any) { toast(e?.message ?? "No se pudo guardar", "error"); } finally { setSaving(false); }
  };

  return (
    <View style={s.root} testID="profile-screen">
      <Header title="Perfil" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
        <View style={{ alignItems: "center" }}>
          <View style={[s.preview, { backgroundColor: color }]}>
            <T weight="bold" style={{ color: "#FFFFFF", fontSize: 34 }}>{(name.trim()[0] ?? "?").toUpperCase()}</T>
          </View>
        </View>
        <TextInput testID="profile-edit-name" style={s.input} value={name} onChangeText={setName} placeholder="Nombre" placeholderTextColor={colors.muted} />
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          {AVATAR_COLORS.map((c) => <Pressable key={c} testID={`profile-color-${c.replace("#", "")}`} onPress={() => setColor(c)} style={[s.swatch, { backgroundColor: c }, color === c && { borderColor: colors.onSurface }]} />)}
        </View>
        <Button testID="profile-save" title="Guardar" onPress={save} loading={saving} disabled={!name.trim()} />
        <View style={s.card}>
          <T weight="bold">Cuenta</T>
          <T style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>{user?.email}</T>
        </View>
        <Button testID="profile-signout" title="Cerrar sesión" variant="ghost" onPress={async () => { await signOut(); router.replace("/welcome"); }} />
      </ScrollView>
    </View>
  );
}
const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  preview: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: c.hairline },
  input: { height: 52, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.lg, fontFamily: fonts.regular, fontSize: 15, color: c.onSurface },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 3, borderColor: "transparent" },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: c.border },
}));
