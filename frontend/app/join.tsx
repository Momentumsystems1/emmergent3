// Join a group with the 6-character code. Works where deep links don't (Expo Go, APK, code read over the phone).
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Button, Glass, T, toast } from "@/src/components/ui";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Join() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const c = code.trim().toUpperCase();
    if (c.length !== 6) return toast("El código tiene 6 caracteres", "error");
    setBusy(true);
    try {
      const r = await api<{ token: string }>(`/invitations/by-code/${c}`, { auth: false });
      router.replace(`/invite/${r.token}`);
    } catch (e: any) {
      toast(e.message ?? "Código no válido", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[s.root, { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xl }]} testID="join-screen">
      <Glass>
        <T style={{ color: colors.brandPrimary, fontSize: 11, letterSpacing: 1.2 }}>UNIRME A UN GRUPO</T>
        <T weight="bold" style={{ fontSize: 22, marginTop: 6 }}>Escribe tu código</T>
        <T style={{ color: colors.muted, marginTop: 4 }}>Quien te invita lo ve en su grupo, en “Invitar”. Son 6 caracteres, por ejemplo K7F2QD.</T>
        <TextInput
          testID="join-code-input"
          style={s.input}
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
          placeholder="------"
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          onSubmitEditing={submit}
          returnKeyType="go"
        />
        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          <Button testID="join-submit" title="Continuar" onPress={submit} loading={busy} disabled={code.length !== 6} />
          <Pressable testID="join-back" onPress={() => router.back()} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
            <T style={{ color: colors.muted }}>Volver</T>
          </Pressable>
        </View>
      </Glass>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface, padding: spacing.xl, justifyContent: "center" },
  input: {
    height: 64, marginTop: spacing.lg, borderRadius: radius.md, backgroundColor: c.surfaceSecondary,
    borderWidth: 1, borderColor: c.borderStrong, textAlign: "center", letterSpacing: 10,
    fontFamily: fonts.bold, fontSize: 26, color: c.onSurface,
  },
}));
