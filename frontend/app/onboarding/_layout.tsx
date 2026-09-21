// Onboarding funnel layout: legal/branding screens are always light (white), even on dark-mode devices.
import { Stack } from "expo-router";
import React from "react";

import { ForceLightTheme } from "@/src/theme";

export default function OnboardingLayout() {
  return (
    <ForceLightTheme.Provider value>
      <Stack screenOptions={{ headerShown: false }} />
    </ForceLightTheme.Provider>
  );
}
