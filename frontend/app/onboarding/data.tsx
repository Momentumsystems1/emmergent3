import { useRouter } from "expo-router";
import { View } from "react-native";

import { setLocalOnboarding } from "@/src/auth";
import { OnboardingScreen } from "@/src/components/OnboardingScreen";
import { Pill } from "@/src/components/ui";
import { ONBOARDING } from "@/src/copy";

const ITEMS = ["Ubicación actual", "Ubicación aproximada", "Rutas", "ETA", "Estado de movimiento", "Modo de movilidad", "Eventos de seguridad", "Cámara", "Micrófono", "Dispositivo", "Eventos V16", "Métricas"];

export default function Data() {
  const router = useRouter();
  const c = ONBOARDING.data;
  return (
    <OnboardingScreen step="data" testID="onboarding-data" title={c.title} body={c.body} primary={c.primary} showBack
      onPrimary={async () => { await setLocalOnboarding({ step: "transparency" }); router.push("/onboarding/transparency"); }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {ITEMS.map((i) => <Pill key={i} label={i} />)}
      </View>
    </OnboardingScreen>
  );
}
