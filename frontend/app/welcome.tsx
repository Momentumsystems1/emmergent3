// Welcome (first screen): full-bleed artwork + logo (placeholders, swappable in assets/images) → legal onboarding.
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Image, ImageBackground, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { T } from "@/src/components/ui";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Welcome() {
  const router = useRouter(); const insets = useSafeAreaInsets(); const s = useStyles(); const { colors } = useTheme();
  return (
    <ImageBackground source={require("../assets/images/welcome-bg.png")} style={s.root} resizeMode="cover" testID="welcome-screen">
      <LinearGradient colors={["transparent", "rgba(5,12,25,0.55)", "rgba(5,12,25,0.95)"]} locations={[0.35, 0.65, 1]} style={s.shade} />
      <View style={[s.content, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={s.brand}>
          <Image source={require("../assets/images/logo.png")} style={s.logo} testID="welcome-logo" />
          <T weight="bold" style={s.title}>Sentinel Family</T>
          <T style={s.tagline}>Movilidad, coordinación y seguridad para los tuyos. Tu privacidad, siempre en tus manos.</T>
        </View>
        <View style={{ gap: spacing.sm }}>
          <Pressable testID="welcome-start" onPress={() => router.push("/onboarding/terms")} style={s.cta}><T weight="bold" style={{ color: colors.onBrandPrimary, fontSize: 16 }}>Empezar</T></Pressable>
          <Pressable testID="welcome-login" onPress={() => router.push("/onboarding/account")} style={s.ghost}><T weight="semibold" style={{ color: "#FFFFFF", fontSize: 15 }}>Ya tengo cuenta</T></Pressable>
        </View>
      </View>
    </ImageBackground>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceInverse },
  shade: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  content: { flex: 1, justifyContent: "space-between", paddingHorizontal: spacing.xl },
  brand: { alignItems: "center", marginTop: spacing.xxxl },
  logo: { width: 108, height: 108, marginBottom: spacing.md },
  title: { fontSize: 34, color: "#FFFFFF", letterSpacing: 0.5 },
  tagline: { color: "rgba(255,255,255,0.85)", textAlign: "center", marginTop: spacing.sm, fontSize: 15, lineHeight: 22, maxWidth: 320 },
  cta: { height: 54, borderRadius: radius.lg, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  ghost: { height: 50, borderRadius: radius.lg, borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", alignItems: "center", justifyContent: "center" },
}));
