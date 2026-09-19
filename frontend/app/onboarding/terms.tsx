import { useRouter } from "expo-router";
import { View } from "react-native";

import { setLocalOnboarding } from "@/src/auth";
import { OnboardingScreen } from "@/src/components/OnboardingScreen";
import { T } from "@/src/components/ui";
import { ONBOARDING } from "@/src/copy";
import { useTheme } from "@/src/theme";

export default function Terms() {
  const router = useRouter();
  const { colors } = useTheme();
  const c = ONBOARDING.terms;
  return (
    <OnboardingScreen step="terms" testID="onboarding-terms" title={c.title} body={c.body} primary={c.primary}
      onPrimary={async () => { await setLocalOnboarding({ step: "data", terms_accepted_at: new Date().toISOString() }); router.push("/onboarding/data"); }}>
      <View style={{ gap: 6 }}>
        <T style={{ color: colors.muted, fontSize: 13 }}>Si no aceptas, puedes salir de la configuración. La aceptación es necesaria para operar el servicio.</T>
        <T style={{ color: colors.muted, fontSize: 13 }}>Versión de condiciones: 2026-06-01</T>
      </View>
    </OnboardingScreen>
  );
}
