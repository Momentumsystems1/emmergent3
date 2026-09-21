// Bootstrap: resolves where the user is (legal onboarding → account → consent → profile → group → map) and survives restarts.
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, View } from "react-native";

import { getLocalOnboarding, useAuth } from "@/src/auth";
import { T } from "@/src/components/ui";
import { fonts, ForceLightTheme, useTheme } from "@/src/theme";

const LOCAL_ROUTES: Record<string, string> = { terms: "/welcome", data: "/onboarding/data", transparency: "/onboarding/transparency", security: "/onboarding/security", account: "/onboarding/account" };
const SERVER_ROUTES: Record<string, string> = { consent: "/onboarding/profile", profile: "/onboarding/profile", group: "/onboarding/group", done: "/map" };

function Bootstrap() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    (async () => {
      if (user) {
        if (user.onboarding?.completed) return setTarget("/map");
        return setTarget(SERVER_ROUTES[user.onboarding?.step] ?? "/onboarding/profile");
      }
      const local = await getLocalOnboarding();
      setTarget(LOCAL_ROUTES[local.step] ?? "/onboarding/terms");
    })();
  }, [user, loading]);

  if (target) return <Redirect href={target as any} />;
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, gap: 18 }} testID="bootstrap-screen">
      <Image source={require("../assets/images/helmet-dark.png")} style={{ width: 72, height: 64 }} />
      <T weight="bold" style={{ color: colors.onSurface, fontSize: 16, letterSpacing: 3 }}>MY CLUSTER</T>
      <ActivityIndicator color={colors.brandPrimary} />
    </View>
  );
}

export default function Index() {
  return (
    <ForceLightTheme.Provider value>
      <Bootstrap />
    </ForceLightTheme.Provider>
  );
}
