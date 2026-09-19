// Consent: one real switch — share my location with my groups. It controls the actual position upload; revocable anytime from Privacidad.
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Switch, View } from "react-native";

import { OnboardingScreen } from "@/src/components/OnboardingScreen";
import { T } from "@/src/components/ui";
import { getShareLocation, setShareLocation } from "@/src/sb";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Consent() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useStyles();
  const [share, setShare] = useState(true);

  useEffect(() => { getShareLocation().then(setShare); }, []);

  const toggle = async (v: boolean) => { setShare(v); await setShareLocation(v); };

  return (
    <OnboardingScreen step="consent" testID="onboarding-consent" title="Decide qué compartes" body="Puedes cambiarlo en cualquier momento desde Privacidad. Sin este permiso, tu grupo verá “Ubicación no compartida”: nunca simulamos tu posición."
      primary="Guardar y continuar" onPrimary={() => router.replace("/onboarding/profile")}>
      <View style={{ gap: spacing.sm }}>
        <View style={s.row} testID="consent-row-location">
          <View style={{ flex: 1 }}>
            <T weight="semibold" style={{ fontSize: 15 }}>Compartir mi ubicación</T>
            <T style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>Qué: tu posición actual · Por qué: verte en el mapa del grupo · Con quién: tus grupos · Duración: hasta que lo desactives</T>
          </View>
          <Switch testID="consent-switch-location" value={share} onValueChange={toggle} trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} />
        </View>
        <T style={{ color: colors.muted, fontSize: 12 }}>Además, el navegador o el dispositivo te pedirá su propio permiso de ubicación cuando actives el mapa.</T>
      </View>
    </OnboardingScreen>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: c.border },
}));
