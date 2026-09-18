// Global "under construction" notice shown across the whole app during the testing phase, so invited users who open the
// web/preview build immediately understand it is a work-in-progress and not broken. Dismissible per session.
import Ionicons from "@react-native-vector-icons/ionicons";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { T } from "@/src/components/ui";
import { makeStyles, spacing, useTheme } from "@/src/theme";

export function ConstructionBanner() {
  const [hidden, setHidden] = useState(false);
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const ink = "#2A1D05"; // fixed dark ink for readable contrast on the amber pill (same in light/dark)
  if (hidden) return null;
  return (
    <View pointerEvents="box-none" style={[s.wrap, { bottom: insets.bottom + spacing.sm }]}>
      <View style={s.pill} testID="construction-banner">
        <Ionicons name="construct" size={16} color={ink} />
        <View style={{ flex: 1 }}>
          <T weight="bold" style={{ color: ink, fontSize: 12.5 }}>App en proceso de construcción</T>
          <T style={{ color: ink, fontSize: 11, opacity: 0.85 }}>Versión de pruebas · algunas funciones aún no están disponibles</T>
        </View>
        <Pressable testID="construction-dismiss" onPress={() => setHidden(true)} hitSlop={8} style={s.close}>
          <Ionicons name="close" size={15} color={ink} />
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center", paddingHorizontal: spacing.md },
  pill: { flexDirection: "row", alignItems: "center", gap: spacing.sm, maxWidth: 480, width: "100%", paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: 999, backgroundColor: c.warning, borderWidth: 1, borderColor: "rgba(0,0,0,0.15)", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  close: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.12)" },
}));
