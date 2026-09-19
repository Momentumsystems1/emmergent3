// Profile + avatar identity (name, color, symbol). Only required data is requested.
import Ionicons from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { useAuth } from "@/src/auth";
import { OnboardingScreen } from "@/src/components/OnboardingScreen";
import { T, toast } from "@/src/components/ui";
import { AVATAR_COLORS, SYMBOLS } from "@/src/copy";
import { upsertProfile } from "@/src/sb";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";
import { PENDING_INVITE_KEY } from "./account";

export default function Profile() {
  const router = useRouter();
  const { user, reload } = useAuth();
  const s = useStyles();
  const { colors } = useTheme();
  const [name, setName] = useState(user?.profile?.name ?? "");
  const [color, setColor] = useState(user?.avatar?.color ?? AVATAR_COLORS[0]);
  const [symbol, setSymbol] = useState(user?.avatar?.symbol ?? "pin");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    try {
      await upsertProfile({ display_name: name.trim(), avatar_color: color, avatar_symbol: symbol });
      await reload();
      // A person invited to an existing group joins it directly; they must never be routed through "create your own circle".
      const pendingInvite = await storage.getItem<string | null>(PENDING_INVITE_KEY, null);
      router.replace(pendingInvite ? `/invite/${pendingInvite}` : "/onboarding/group");
    } catch (e: any) { toast(e?.message ?? "No se pudo guardar el perfil", "error"); } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={16} style={{ flex: 1 }}>
      <OnboardingScreen step="profile" testID="onboarding-profile" title="Tu identidad en el mapa" body="Solo pedimos lo necesario. Tu avatar combina un color con tu inicial; así te verán los miembros de tu grupo."
        primary="Continuar" onPrimary={save} loading={loading} primaryDisabled={name.trim().length < 1}>
        <View style={{ alignItems: "center", marginBottom: spacing.xl }} testID="avatar-preview">
          <View style={[s.preview, { backgroundColor: color }]}>
            <T weight="bold" style={{ color: "#FFFFFF", fontSize: 34 }}>{(name.trim()[0] ?? "?").toUpperCase()}</T>
          </View>
        </View>
        <View style={{ gap: spacing.md }}>
          <TextInput testID="profile-name-input" style={s.input} placeholder="Nombre" placeholderTextColor={colors.muted} value={name} onChangeText={setName} />
          <T weight="semibold" style={{ marginTop: spacing.sm }}>Color principal</T>
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            {AVATAR_COLORS.map((c, i) => (
              <Pressable key={c} testID={`avatar-color-${i}`} onPress={() => setColor(c)} style={[s.swatch, { backgroundColor: c }, color === c && { borderColor: colors.onSurface }]}>
                {color === c ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
              </Pressable>
            ))}
          </View>
          <T weight="semibold" style={{ marginTop: spacing.sm }}>Símbolo</T>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {SYMBOLS.map((k) => (
              <Pressable key={k} testID={`avatar-symbol-${k}`} onPress={() => setSymbol(k)} style={[s.sym, symbol === k && { borderColor: colors.brandPrimary, backgroundColor: colors.surfaceSecondary }]}>
                <Ionicons name={({ pin: "location", shield: "shield", car: "car", star: "star", heart: "heart" } as any)[k]} size={20} color={symbol === k ? colors.brandPrimary : colors.muted} />
              </Pressable>
            ))}
          </View>
        </View>
      </OnboardingScreen>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  preview: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: c.hairline },
  input: { height: 54, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.lg, fontFamily: fonts.regular, fontSize: 16, color: c.onSurface },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  sym: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: c.border, alignItems: "center", justifyContent: "center", backgroundColor: c.surfaceTertiary },
}));
