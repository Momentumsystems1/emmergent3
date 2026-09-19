// Native fallback for MapCanvas. The web build uses MapCanvas.web.tsx (interactive Google Maps);
// Metro picks the platform file automatically, so this module exists for TypeScript and native bundles.
import { View } from "react-native";

import { T } from "@/src/components/ui";

export * from "@/src/components/mapTypes";
import { MapCanvasProps } from "@/src/components/mapTypes";

export function MapCanvas(_props: MapCanvasProps) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <T>El mapa nativo no está incluido en esta compilación.</T>
    </View>
  );
}
