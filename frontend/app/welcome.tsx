// Welcome (first screen): full-bleed artwork + brand mark → legal onboarding.
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Image, ImageBackground, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { T } from "@/src/components/ui";
import { makeStyles, radius, shadow, spacing, useTheme } from "@/src/theme";

export default function Welcome() {
  const router = useRouter(); const insets = useSafeAreaInsets(); const s = useStyles(); const { colors } = useTheme();
  return (
    <ImageBackground source={require("../assets/images/welcome-bg.png")} style={s.root} resizeMode="cover" testID="welcome-screen">
      <LinearGradient colors={["rgba(4,7,15,0.15)", "rgba(4,7,15,0.55)", "rgba(4,7,15,0.96)"]} locations={[0.3, 0.62, 1]} style={s.shade} />
      <View style={[s.content, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={s.brand}>
          <View style={s.logoRing}>
            <Image source={require("../assets/images/logo.png")} style={s.logo} testID="welcome-logo" />
          </View>
          <T weight="bold" style={s.title}>My Cluster</T>
          <T style={s.tagline}>Movilidad, coordinación y seguridad para los tuyos. Tu privacidad, siempre en tus manos.</T>
        </View>
        <View style={{ gap: spacing.md }}>
          <Pressable testID="welcome-start" onPress={() => router.push("/onboarding/terms")}
            style={({ pressed }) => [s.cta, pressed && { opacity: 0.88, transform: [{ scale: 0.985 }] }]}>
            <T weight="bold" style={{ color: colors.onBrandPrimary, fontSize: 16, letterSpacing: 0.3 }}>Empezar</T>
          </Pressable>
          <Pressable testID="welcome-login" onPress={() => router.push("/onboarding/account")}
            style={({ pressed }) => [s.ghost, pressed && { opacity: 0.75 }]}>
            <T weight="semibold" style={{ color: "#FFFFFF", fontSize: 15 }}>Ya tengo cuenta</T>
          </Pressable>
        </View>
      </View>
    </ImageBackground>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: "#04070F", overflow: "hidden" },
  shade: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  content: { flex: 1, justifyContent: "space-between", paddingHorizontal: spacing.xl },
  brand: { alignItems: "center", marginTop: spacing.xxxl },
  logoRing: { width: 128, height: 128, borderRadius: 40, backgroundColor: "rgba(13,21,38,0.55)", borderWidth: 1, borderColor: "rgba(148,170,205,0.22)", alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  logo: { width: 92, height: 92 },
  title: { fontSize: 34, lineHeight: 40, letterSpacing: -0.8, color: "#FFFFFF" },
  tagline: { color: "rgba(255,255,255,0.82)", textAlign: "center", marginTop: spacing.md, fontSize: 15, lineHeight: 23, maxWidth: 320 },
  cta: { height: 56, borderRadius: radius.md + 2, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center", ...shadow.pop },
  ghost: { height: 52, borderRadius: radius.md + 2, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
}));
