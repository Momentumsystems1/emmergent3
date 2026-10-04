// Account creation / sign in. After account exists, the locally captured terms acceptance is recorded as consent evidence.
// Registro a nivel producto serio: validación en vivo por campo, medidor de fortaleza, confirmación de contraseña,
// mostrar/ocultar, Enter encadena campos, errores del servidor traducidos con salida útil (p. ej. "ya existe → entra").
import Ionicons from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { api, clientMeta } from "@/src/api";
import { getLocalOnboarding, setLocalOnboarding, useAuth } from "@/src/auth";
import { OnboardingScreen } from "@/src/components/OnboardingScreen";
import { T, toast } from "@/src/components/ui";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Strength = { score: 0 | 1 | 2 | 3; label: string };
function passwordStrength(pw: string): Strength {
  if (!pw) return { score: 0, label: "" };
  let pts = 0;
  if (pw.length >= 8) pts++;
  if (pw.length >= 12) pts++;
  if (/[a-záéíóúñ]/.test(pw) && /[A-ZÁÉÍÓÚÑ]/.test(pw)) pts++;
  if (/\d/.test(pw)) pts++;
  if (/[^A-Za-zÁÉÍÓÚáéíóúÑñ0-9]/.test(pw)) pts++;
  if (pts <= 2) return { score: 1, label: "Débil" };
  if (pts <= 3) return { score: 2, label: "Aceptable" };
  return { score: 3, label: "Fuerte" };
}

type ServerError = { text: string; kind: "exists" | "credentials" | "generic" } | null;
function mapServerError(e: any): ServerError {
  const m = String(e?.message ?? "");
  if (/already|existe|registered/i.test(m)) return { text: "Ya existe una cuenta con este email.", kind: "exists" };
  if (/credencial|credential|invalid/i.test(m)) return { text: "Email o contraseña incorrectos.", kind: "credentials" };
  if (/confirma el email/i.test(m)) return { text: "Cuenta creada. Revisa tu correo y confirma el email para entrar.", kind: "generic" };
  return { text: m || "No se pudo continuar. Inténtalo de nuevo.", kind: "generic" };
}

export default function Account() {
  const router = useRouter();
  const { register, signIn, signInWithGoogle } = useAuth();
  const [gLoading, setGLoading] = useState(false);
  const s = useStyles();
  const { colors } = useTheme();
  const [mode, setMode] = useState<"register" | "login">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean; password2?: boolean }>({});
  const [loading, setLoading] = useState(false);
  const [serverErr, setServerErr] = useState<ServerError>(null);
  const pwRef = useRef<TextInput>(null);
  const pw2Ref = useRef<TextInput>(null);

  const emailNorm = email.trim().toLowerCase();
  const emailOk = EMAIL_RE.test(emailNorm);
  const pw = passwordStrength(password);
  const pwOk = password.length >= 8;
  const pw2Ok = mode === "login" || (password2.length > 0 && password2 === password);
  const formOk = emailOk && pwOk && pw2Ok;
  const busy = loading || gLoading;

  const emailErr = touched.email && !emailOk ? "Escribe un email válido (por ejemplo: nombre@dominio.com)" : null;
  const pwErr = touched.password && !pwOk ? "Mínimo 8 caracteres" : null;
  const pw2Err = mode === "register" && touched.password2 && password2.length > 0 && password2 !== password ? "Las contraseñas no coinciden" : null;

  const goNext = (u: any) => {
    const after = async () => {
      const pendingInvite = await storage.getItem<string | null>("sentinel.pending_invite", null);
      if (u.onboarding?.completed) router.replace(pendingInvite ? `/invite/${pendingInvite}` : "/map");
      else if (u.onboarding?.step === "profile") router.replace("/onboarding/consent");
      else if (u.onboarding?.step === "group") router.replace(pendingInvite ? `/invite/${pendingInvite}` : "/onboarding/group");
      else router.replace("/onboarding/consent");
    };
    void after();
  };

  const submit = async () => {
    setTouched({ email: true, password: true, password2: true });
    setServerErr(null);
    if (!formOk) return;
    setLoading(true);
    try {
      const u = mode === "register" ? await register(emailNorm, password) : await signIn(emailNorm, password);
      const local = await getLocalOnboarding();
      if (mode === "register" || !u.onboarding?.completed) {
        await api("/consents", { method: "POST", json: { document: "terms", version: "2026-06-01", accepted: true, accepted_at_client: local.terms_accepted_at ?? new Date().toISOString(), ...clientMeta } }).catch(() => null);
      }
      await setLocalOnboarding({ step: "consent" });
      goNext(u);
    } catch (e: any) {
      const se = mapServerError(e);
      setServerErr(se);
      if (se?.kind === "credentials") setPassword("");
    } finally { setLoading(false); }
  };

  const google = async () => {
    setServerErr(null);
    setGLoading(true);
    try {
      const u = await signInWithGoogle();
      if (!u) return; // web: full-page redirect in progress, or the user cancelled on mobile
      goNext(u);
    } catch (e: any) {
      toast(e?.message ?? "No se pudo iniciar sesión con Google", "error");
    } finally { setGLoading(false); }
  };

  const switchMode = () => {
    setMode(mode === "register" ? "login" : "register");
    setServerErr(null);
    setPassword2("");
    setTouched({});
  };

  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={16} style={{ flex: 1 }}>
      <OnboardingScreen step="account" testID="onboarding-account" title={mode === "register" ? "Crea tu cuenta MY CLUSTER" : "Inicia sesión en MY CLUSTER"}
        body={mode === "register" ? "Tu cuenta identifica tus consentimientos, tus grupos y tus permisos. Solo pedimos lo imprescindible." : "Accede con el email y la contraseña de tu cuenta."}
        primary={mode === "register" ? "Crear cuenta" : "Entrar"} onPrimary={submit} loading={loading} primaryDisabled={!formOk}
        secondary={mode === "register" ? "Ya tengo cuenta" : "Crear una cuenta nueva"} onSecondary={switchMode} showBack>
        <View style={{ gap: spacing.md }}>
          {serverErr ? (
            <View style={s.errBanner} testID="account-error-banner">
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <T style={{ flex: 1, fontSize: 13, color: colors.error }}>{serverErr.text}</T>
              {serverErr.kind === "exists" ? (
                <Pressable testID="account-goto-login" onPress={() => { setMode("login"); setServerErr(null); setTouched({}); }} hitSlop={8}>
                  <T weight="bold" style={{ fontSize: 13, color: colors.brandPrimary }}>Entrar</T>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View>
            <T weight="semibold" style={s.label}>Email</T>
            <TextInput testID="account-email-input" style={[s.input, emailErr && s.inputErr]} placeholder="nombre@dominio.com" placeholderTextColor={colors.muted}
              autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress"
              returnKeyType="next" onSubmitEditing={() => pwRef.current?.focus()} blurOnSubmit={false}
              editable={!busy} value={email} onChangeText={(v) => { setEmail(v); setServerErr(null); }}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))} />
            {emailErr ? <T style={s.fieldErr} testID="account-email-error">{emailErr}</T> : null}
          </View>

          <View>
            <T weight="semibold" style={s.label}>Contraseña</T>
            <View style={[s.pwWrap, pwErr && s.inputErr]}>
              <TextInput ref={pwRef} testID="account-password-input" style={s.pwInput} placeholder={mode === "register" ? "Mínimo 8 caracteres" : "Tu contraseña"} placeholderTextColor={colors.muted}
                secureTextEntry={!showPw} autoComplete={mode === "register" ? "new-password" : "password"} textContentType={mode === "register" ? "newPassword" : "password"}
                returnKeyType={mode === "register" ? "next" : "go"} onSubmitEditing={() => (mode === "register" ? pw2Ref.current?.focus() : submit())} blurOnSubmit={false}
                editable={!busy} value={password} onChangeText={(v) => { setPassword(v); setServerErr(null); }}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))} />
              <Pressable testID="account-toggle-password" onPress={() => setShowPw(!showPw)} hitSlop={10} style={s.eye}
                accessibilityLabel={showPw ? "Ocultar contraseña" : "Mostrar contraseña"}>
                <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={20} color={colors.muted} />
              </Pressable>
            </View>
            {pwErr ? <T style={s.fieldErr} testID="account-password-error">{pwErr}</T> : null}
            {mode === "register" && password.length > 0 ? (
              <View style={{ marginTop: 6 }} testID="password-strength-meter">
                <View style={{ flexDirection: "row", gap: 4 }}>
                  {[1, 2, 3].map((i) => (
                    <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= pw.score ? (pw.score === 1 ? colors.error : pw.score === 2 ? colors.warning : colors.success) : colors.surfaceTertiary }} />
                  ))}
                </View>
                <T style={{ fontSize: 11.5, color: colors.muted, marginTop: 3 }}>
                  Fortaleza: {pw.label}{pw.score < 3 ? " · combina mayúsculas, números y símbolos" : ""}
                </T>
              </View>
            ) : null}
          </View>

          {mode === "register" ? (
            <View>
              <T weight="semibold" style={s.label}>Repite la contraseña</T>
              <View style={[s.pwWrap, pw2Err && s.inputErr, password2.length > 0 && password2 === password && s.inputOk]}>
                <TextInput ref={pw2Ref} testID="account-password2-input" style={s.pwInput} placeholder="Escríbela otra vez" placeholderTextColor={colors.muted}
                  secureTextEntry={!showPw2} autoComplete="new-password" textContentType="newPassword"
                  returnKeyType="go" onSubmitEditing={submit}
                  editable={!busy} value={password2} onChangeText={(v) => { setPassword2(v); }}
                  onBlur={() => setTouched((t) => ({ ...t, password2: true }))} />
                {password2.length > 0 && password2 === password ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} style={s.eye} testID="account-password2-match" />
                ) : (
                  <Pressable testID="account-toggle-password2" onPress={() => setShowPw2(!showPw2)} hitSlop={10} style={s.eye}
                    accessibilityLabel={showPw2 ? "Ocultar contraseña" : "Mostrar contraseña"}>
                    <Ionicons name={showPw2 ? "eye-off-outline" : "eye-outline"} size={20} color={colors.muted} />
                  </Pressable>
                )}
              </View>
              {pw2Err ? <T style={s.fieldErr} testID="account-password2-error">{pw2Err}</T> : null}
            </View>
          ) : null}

          {mode === "register" ? (
            <T style={{ fontSize: 12, lineHeight: 17, color: colors.muted }} testID="account-legal-note">
              Al crear la cuenta aceptas los <T style={s.link} onPress={() => router.push("/legal/terms")}>Términos del servicio</T> y la <T style={s.link} onPress={() => router.push("/legal/privacy")}>Política de privacidad</T>.
            </T>
          ) : null}

          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginVertical: 2 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <T style={{ fontSize: 12, color: colors.muted }}>o</T>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>

          <Pressable testID="google-signin-button" onPress={google} disabled={busy} style={[s.google, busy && { opacity: 0.6 }]} accessibilityRole="button">
            {gLoading ? <ActivityIndicator color={colors.onSurface} /> : <Ionicons name="logo-google" size={18} color={colors.onSurface} />}
            <T weight="semibold" style={{ fontSize: 15 }}>{mode === "register" ? "Continuar con Google" : "Entrar con Google"}</T>
          </Pressable>
        </View>
      </OnboardingScreen>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  label: { fontSize: 13, color: c.onSurfaceSecondary, marginBottom: 6 },
  input: { height: 54, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.lg, fontFamily: fonts.regular, fontSize: 16, color: c.onSurface },
  inputErr: { borderColor: c.error },
  inputOk: { borderColor: c.success },
  fieldErr: { fontSize: 12, color: c.error, marginTop: 4 },
  pwWrap: { flexDirection: "row", alignItems: "center", height: 54, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, paddingLeft: spacing.lg, paddingRight: 6 },
  pwInput: { flex: 1, height: "100%", fontFamily: fonts.regular, fontSize: 16, color: c.onSurface },
  eye: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  errBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.errorSoft, borderWidth: 1, borderColor: c.error, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 12 },
  link: { fontSize: 12, color: c.brandPrimary, textDecorationLine: "underline" },
  google: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 52, borderRadius: radius.lg, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border },
}));
