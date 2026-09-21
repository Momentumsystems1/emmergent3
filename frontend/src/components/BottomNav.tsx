// Barra de navegación inferior — la columna vertebral de la app.
// Todo lo importante a un pulgar: Cercas · Convoy · SOS (centro, elevado) · Sensores · Menú.
import Ionicons from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { T } from "@/src/components/ui";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export function BottomNav({ onSos, onMenu, sosActive }: { onSos: () => void; onMenu: () => void; sosActive?: boolean }) {
  const s = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.wrap, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]} pointerEvents="box-none" testID="bottom-nav">
      <View style={s.bar}>
        <NavItem testID="nav-fences" icon="radio-button-on" label="Cercas" onPress={() => router.push("/fences")} />
        <NavItem testID="nav-convoy" icon="car-sport" label="Convoy" onPress={() => router.push("/convoy/active")} />
        <Pressable testID="nav-sos" onPress={onSos} accessibilityLabel="SOS" style={s.sosWrap}>
          <LinearGradient colors={[colors.sosStart, colors.sosEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.sosBtn, sosActive && { transform: [{ scale: 0.94 }] }]}>
            <T weight="bold" style={{ fontSize: 15, color: colors.onSos, letterSpacing: 1 }}>SOS</T>
          </LinearGradient>
        </Pressable>
        <NavItem testID="nav-sensors" icon="speedometer" label="Sensores" onPress={() => router.push("/sensors")} />
        <NavItem testID="nav-menu" icon="menu" label="Menú" onPress={onMenu} />
      </View>
    </View>
  );
}

function NavItem({ icon, label, onPress, testID }: { icon: string; label: string; onPress: () => void; testID: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} style={s.item} accessibilityLabel={label}>
      <Ionicons name={icon as any} size={21} color={colors.onSurface} />
      <T weight="medium" style={{ fontSize: 10.5, color: colors.muted }}>{label}</T>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  bar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-around",
    backgroundColor: c.glassStrong, borderRadius: radius.xl, borderWidth: 1, borderColor: c.hairline,
    paddingVertical: 7, paddingHorizontal: spacing.sm,
    shadowColor: c.surfaceInverse, shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  item: { alignItems: "center", justifyContent: "center", gap: 2, minWidth: 58, paddingVertical: 3 },
  sosWrap: { marginTop: -30 },
  sosBtn: {
    width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: "rgba(255,255,255,0.92)",
    shadowColor: c.error, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 9,
  },
}));
