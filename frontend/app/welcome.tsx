// Welcome (primera pantalla) MY CLUSTER: bloque rojo con anillos radar + casco → onboarding legal.
import { useRouter } from "expo-router";
import { Image, ImageBackground, Pressable, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { T } from "@/src/components/ui";
import { fonts, makeStyles, radius, shadow, spacing, useTheme } from "@/src/theme";

export default function Welcome() {
  const router = useRouter(); const insets = useSafeAreaInsets(); const s = useStyles(); const { colors } = useTheme();
  const { height: winH } = useWindowDimensions();
  const topH = Math.round(winH * 0.56);
  return (
    <View style={s.root} testID="welcome-screen">
      <ImageBackground source={require("../assets/images/welcome-top.png")} style={[s.top, { height: topH }]} resizeMode="cover">
        <View style={s.pinDotHalo}><View style={s.pinDot} /></View>
        <Image source={require("../assets/images/helmet-white.png")} style={[s.helm, { top: Math.round(topH * 0.40) - 56 }]} testID="welcome-logo" />
        <T weight="bold" style={s.wordmark}>MY CLUSTER</T>
      </ImageBackground>

      <View style={[s.bottom, { paddingBottom: insets.bottom + spacing.xl }]}>
        <T weight="bold" style={s.title}>Tu gente, en tu cluster<T weight="bold" style={{ color: colors.brand }}>.</T></T>
        <T style={s.sub}>Ubicación en vivo, alertas y rutas compartidas con quien tú eliges. Privado y sin anuncios.</T>
        <View style={s.ctaZone}>
          <Pressable testID="welcome-start" onPress={() => router.push("/onboarding/terms")}
            style={({ pressed }) => [s.cta, pressed && { opacity: 0.88, transform: [{ scale: 0.985 }] }]}>
            <T weight="bold" style={{ color: colors.onBrandPrimary, fontSize: 16 }}>Crear mi cluster</T>
          </Pressable>
          <Pressable testID="welcome-login" onPress={() => router.push("/onboarding/account")}
            style={({ pressed }) => [s.ghost, pressed && { opacity: 0.7 }]}>
            <T weight="semibold" style={{ color: colors.onSurface, fontSize: 15.5 }}>Ya tengo cuenta</T>
          </Pressable>
          <T weight="bold" style={s.micro}>PRIVADO · CIFRADO · TIEMPO REAL</T>
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface, overflow: "hidden" },
  top: {
    width: "100%", borderBottomLeftRadius: 44, borderBottomRightRadius: 44, overflow: "hidden",
    alignItems: "center", justifyContent: "center",
  },
  helm: { position: "absolute", width: 124, height: 112 },
  wordmark: { position: "absolute", bottom: 40, color: "#FFFFFF", fontSize: 21, letterSpacing: 7, fontFamily: fonts.bold },
  pinDotHalo: {
    position: "absolute", top: "16%", right: "22%", width: 26, height: 26, borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center",
  },
  pinDot: { width: 13, height: 13, borderRadius: 7, backgroundColor: "#FFFFFF" },
  bottom: { flex: 1, alignItems: "center", paddingTop: spacing.xl, paddingHorizontal: 32 },
  title: { fontSize: 27, lineHeight: 34, letterSpacing: -0.5, color: c.onSurface, textAlign: "center" },
  sub: { marginTop: spacing.sm + 2, fontSize: 14.5, lineHeight: 22, color: c.muted, textAlign: "center", maxWidth: 300 },
  ctaZone: { marginTop: "auto", width: "100%", gap: spacing.md },
  cta: { height: 56, borderRadius: radius.pill, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center", ...shadow.pop },
  ghost: { height: 56, borderRadius: radius.pill, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" },
  micro: { textAlign: "center", fontSize: 10.5, letterSpacing: 1.6, color: "#9AA0A6", marginTop: spacing.xs },
}));
