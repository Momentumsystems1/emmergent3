// Account creation / sign in (Supabase email + password). Honors a pending invitation after auth.
import { useRouter } from "expo-router";
import { useState } from "react";
import { TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { setLocalOnboarding, useAuth } from "@/src/auth";
import { OnboardingScreen } from "@/src/components/OnboardingScreen";
import { toast } from "@/src/components/ui";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";

export const PENDING_INVITE_KEY = "mycluster.pending_invite";

export default function Account() {
  const router = useRouter();
  const { register, signIn } = useAuth();
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
      await setLocalOnboarding({ step: "consent" });
      const pendingInvite = await storage.getItem<string | null>(PENDING_INVITE_KEY, null);
      if (u.onboarding?.completed) router.replace(pendingInvite ? `/invite/${pendingInvite}` : "/map");
      else if (u.onboarding?.step === "profile") router.replace("/onboarding/profile");
      else if (u.onboarding?.step === "group") router.replace(pendingInvite ? `/invite/${pendingInvite}` : "/onboarding/group");
      else router.replace("/onboarding/profile");
    } catch (e: any) {
      toast(e?.message ?? "No se pudo continuar", "error");
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={16} style={{ flex: 1 }}>
      <OnboardingScreen step="account" testID="onboarding-account" title={mode === "register" ? "Crea tu cuenta My Cluster" : "Inicia sesión en My Cluster"}
        body="Tu cuenta identifica tus grupos y tus permisos. Solo pedimos lo imprescindible."
        primary={mode === "register" ? "Crear cuenta" : "Entrar"} onPrimary={submit} loading={loading} primaryDisabled={!email.includes("@") || password.length < 8}
        secondary={mode === "register" ? "Ya tengo cuenta" : "Crear una cuenta nueva"} onSecondary={() => setMode(mode === "register" ? "login" : "register")} showBack>
        <View style={{ gap: spacing.md }}>
          <TextInput testID="account-email-input" style={s.input} placeholder="Email" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} />
          <TextInput testID="account-password-input" style={s.input} placeholder="Contraseña (mínimo 8 caracteres)" placeholderTextColor={colors.muted} secureTextEntry value={password} onChangeText={setPassword} autoComplete={mode === "register" ? "new-password" : "password"} />
        </View>
      </OnboardingScreen>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  input: { height: 54, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.lg, fontFamily: fonts.regular, fontSize: 16, color: c.onSurface },
}));
