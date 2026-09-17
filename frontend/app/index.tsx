// Bootstrap: resolves where the user is (legal onboarding → account → consent → profile → group → map) and survives restarts.
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, View } from "react-native";

import { getLocalOnboarding, useAuth } from "@/src/auth";
import { T } from "@/src/components/ui";
import { fonts, useTheme } from "@/src/theme";

const LOCAL_ROUTES: Record<string, string> = { terms: "/welcome", data: "/onboarding/data", transparency: "/onboarding/transparency", security: "/onboarding/security", account: "/onboarding/account" };
const SERVER_ROUTES: Record<string, string> = { consent: "/onboarding/profile", profile: "/onboarding/profile", group: "/onboarding/group", done: "/map" };

export default function Index() {
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
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#060B16", gap: 18 }} testID="bootstrap-screen">
      <Image source={require("../assets/images/logo.png")} style={{ width: 76, height: 76 }} />
      <T weight="bold" style={{ color: "#F0F5FC", fontSize: 17, letterSpacing: -0.3 }}>Sentinel Family</T>
      <ActivityIndicator color={colors.brandPrimary} />
    </View>
  );
}
