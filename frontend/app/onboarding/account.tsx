// Account creation / sign in. After account exists, the locally captured terms acceptance is recorded as consent evidence.
import Ionicons from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { api, clientMeta } from "@/src/api";
import { getLocalOnboarding, setLocalOnboarding, useAuth } from "@/src/auth";
import { OnboardingScreen } from "@/src/components/OnboardingScreen";
import { T, toast } from "@/src/components/ui";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";

export default function Account() {
  const router = useRouter();
  const { register, signIn, signInWithGoogle } = useAuth();
  const [gLoading, setGLoading] = useState(false);
  const s = useStyles();
  const { colors } = useTheme();
  const [mode, setMode] = useState<"register" | "login">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const u = mode === "register" ? await register(email.trim(), password) : await signIn(email.trim(), password);
      const local = await getLocalOnboarding();
      if (mode === "register" || !u.onboarding?.completed) {
        await api("/consents", { method: "POST", json: { document: "terms", version: "2026-06-01", accepted: true, accepted_at_client: local.terms_accepted_at ?? new Date().toISOString(), ...clientMeta } }).catch(() => null);
      }
      await setLocalOnboarding({ step: "consent" });
      const pendingInvite = await storage.getItem<string | null>("sentinel.pending_invite", null);
      if (u.onboarding?.completed) router.replace(pendingInvite ? `/invite/${pendingInvite}` : "/map");
      else if (u.onboarding?.step === "profile") router.replace("/onboarding/consent");
      else if (u.onboarding?.step === "group") router.replace(pendingInvite ? `/invite/${pendingInvite}` : "/onboarding/group");
      else router.replace("/onboarding/consent");
    } catch (e: any) {
      toast(e?.message ?? "No se pudo continuar", "error");
    } finally { setLoading(false); }
  };

  const google = async () => {
    setGLoading(true);
    try {
      const u = await signInWithGoogle();
      if (!u) return; // web: full-page redirect in progress, or the user cancelled on mobile
      const pendingInvite = await storage.getItem<string | null>("sentinel.pending_invite", null);
      if (u.onboarding?.completed) router.replace(pendingInvite ? `/invite/${pendingInvite}` : "/map");
      else if (u.onboarding?.step === "profile") router.replace("/onboarding/consent");
      else if (u.onboarding?.step === "group") router.replace(pendingInvite ? `/invite/${pendingInvite}` : "/onboarding/group");
      else router.replace("/onboarding/consent");
    } catch (e: any) {
      toast(e?.message ?? "No se pudo iniciar sesión con Google", "error");
    } finally { setGLoading(false); }
  };

  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={16} style={{ flex: 1 }}>
      <OnboardingScreen step="account" testID="onboarding-account" title={mode === "register" ? "Crea tu cuenta Sentinel" : "Inicia sesión en Sentinel"}
        body="Tu cuenta identifica tus consentimientos, tus grupos y tus permisos. Solo pedimos lo imprescindible."
        primary={mode === "register" ? "Crear cuenta" : "Entrar"} onPrimary={submit} loading={loading} primaryDisabled={!email.includes("@") || password.length < 8}
        secondary={mode === "register" ? "Ya tengo cuenta" : "Crear una cuenta nueva"} onSecondary={() => setMode(mode === "register" ? "login" : "register")} showBack>
        <View style={{ gap: spacing.md }}>
          <TextInput testID="account-email-input" style={s.input} placeholder="Email" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} />
          <TextInput testID="account-password-input" style={s.input} placeholder="Contraseña (mínimo 8 caracteres)" placeholderTextColor={colors.muted} secureTextEntry value={password} onChangeText={setPassword} autoComplete={mode === "register" ? "new-password" : "password"} />
          <Pressable testID="google-signin-button" onPress={google} disabled={gLoading || loading} style={s.google} accessibilityRole="button">
            {gLoading ? <ActivityIndicator color={colors.onSurface} /> : <Ionicons name="logo-google" size={18} color={colors.onSurface} />}
            <T weight="semibold" style={{ fontSize: 15 }}>{mode === "register" ? "Continuar con Google" : "Entrar con Google"}</T>
          </Pressable>
          <T style={{ color: colors.muted, fontSize: 11, textAlign: "center" }}>Microsoft y Supabase: SERVICIO NO CONFIGURADO (pendiente de credenciales)</T>
          <Pressable testID="account-join-code" onPress={() => router.push("/join")} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
            <T weight="semibold" style={{ color: colors.brandPrimary, fontSize: 14 }}>Me han invitado · tengo un código</T>
          </Pressable>
        </View>
      </OnboardingScreen>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  input: { height: 54, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.lg, fontFamily: fonts.regular, fontSize: 16, color: c.onSurface },
  google: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 52, borderRadius: radius.lg, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border },
}));
