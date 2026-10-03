import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { LogBox, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "@/src/auth";
import { ErrorBoundary } from "@/src/components/error-boundary";
import { ToastHost, UnavailableHost } from "@/src/components/ui";
import { queryClient } from "@/src/query-client";
import { useTheme } from "@/src/theme";

LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  const [loaded, fontErr] = useFonts({
    Jakarta: require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    JakartaMedium: require("../assets/fonts/PlusJakartaSans-Medium.ttf"),
    JakartaSemi: require("../assets/fonts/PlusJakartaSans-SemiBold.ttf"),
    JakartaBold: require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });
  // Si una fuente se queda colgada o falla (CDN lento, fallo del navegador), la app arranca
  // igual a los 7 s con la fuente del sistema; nunca pantalla blanca permanente.
  const [giveUp, setGiveUp] = useState(false);
  useEffect(() => { const t = setTimeout(() => setGiveUp(true), 7000); return () => clearTimeout(t); }, []);
  const { scheme, colors } = useTheme();
  if (!loaded && !fontErr && !giveUp) return <View style={{ flex: 1, backgroundColor: colors.surface }} />;
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <KeyboardProvider>
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <StatusBar style={scheme === "dark" ? "light" : "dark"} />
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface }, animation: "fade" }} />
                <UnavailableHost />
                <ToastHost />
              </AuthProvider>
            </QueryClientProvider>
          </KeyboardProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
