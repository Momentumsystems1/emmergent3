// Privacy: the real switches the user controls. Everything shown here is wired to actual behavior — no decorative toggles.
import { useEffect, useState } from "react";
import { ScrollView, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Header, T } from "@/src/components/ui";
import { getShareLocation, setShareLocation } from "@/src/sb";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Privacy() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const [share, setShare] = useState(true);

  useEffect(() => { getShareLocation().then(setShare); }, []);
  const toggle = async (v: boolean) => { setShare(v); await setShareLocation(v); };

  return (
    <View style={s.root} testID="privacy-screen">
      <Header title="Privacidad" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
        <View style={s.row} testID="privacy-row-location">
          <View style={{ flex: 1 }}>
            <T weight="semibold" style={{ fontSize: 15 }}>Compartir mi ubicación</T>
            <T style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Qué: tu posición actual · Con quién: tus grupos · Duración: hasta que lo desactives. Al apagarlo, tu grupo deja de recibir tu posición (verá “Ubicación no compartida”).</T>
          </View>
          <Switch testID="privacy-switch-location" value={share} onValueChange={toggle} trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} />
        </View>
        <View style={s.card}>
          <T weight="bold">Tus datos</T>
          <T style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
            Guardamos tu nombre, tu color de avatar, tus grupos, tus lugares guardados y —solo mientras compartes— tu última posición conocida por grupo. Los miembros temporales pierden acceso automáticamente al terminar su plazo.
          </T>
        </View>
        <View style={s.card}>
          <T weight="bold">Permiso del dispositivo</T>
          <T style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
            Además de este interruptor, el navegador o el sistema operativo controla su propio permiso de ubicación. Si lo revocas en los ajustes del dispositivo, My Cluster deja de recibirla aunque este interruptor esté activo.
          </T>
        </View>
      </ScrollView>
    </View>
  );
}
const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: c.border },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: c.border },
}));
