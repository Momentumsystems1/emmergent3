import Ionicons from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import { View } from "react-native";

import { setLocalOnboarding } from "@/src/auth";
import { OnboardingScreen } from "@/src/components/OnboardingScreen";
import { T } from "@/src/components/ui";
import { ONBOARDING } from "@/src/copy";
import { useTheme } from "@/src/theme";

const ITEMS: [string, string][] = [["lock-closed", "Comunicaciones cifradas (HTTPS)"], ["key", "Sesiones autenticadas con tokens seguros"], ["timer", "Permisos temporales y expiración de sesión"],
  ["hand-left", "Compartición revocable"], ["list", "Historial de accesos"], ["layers", "Separación de datos personales, de grupo y temporales"]];

export default function Security() {
  const router = useRouter();
  const { colors } = useTheme();
  const c = ONBOARDING.security;
  return (
    <OnboardingScreen step="security" testID="onboarding-security" title={c.title} body={c.body} primary={c.primary} showBack
      onPrimary={async () => { await setLocalOnboarding({ step: "account" }); router.push("/onboarding/account"); }}>
      <View style={{ gap: 12 }}>
        {ITEMS.map(([i, t]) => (
          <View key={t} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Ionicons name={i as any} size={18} color={colors.brandSecondary} /><T style={{ fontSize: 15, flex: 1 }}>{t}</T>
          </View>
        ))}
      </View>
    </OnboardingScreen>
  );
}
