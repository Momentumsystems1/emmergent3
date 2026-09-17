import { useRouter } from "expo-router";
import React from "react";
import { ScrollView, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, T } from "@/src/components/ui";
import { makeStyles, spacing } from "@/src/theme";

export const ONBOARDING_STEPS = ["terms", "data", "transparency", "security", "account", "consent", "profile", "group"];

type Props = {
  step: string;
  title: string;
  body?: string;
  children?: React.ReactNode;
  primary: string;
  onPrimary: () => void;
  loading?: boolean;
  primaryDisabled?: boolean;
  secondary?: string;
  onSecondary?: () => void;
  testID: string;
  showBack?: boolean;
};

export function OnboardingScreen({ step, title, body, children, primary, onPrimary, loading, primaryDisabled, secondary, onSecondary, testID, showBack }: Props) {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const idx = ONBOARDING_STEPS.indexOf(step);
  return (
    <View style={s.root} testID={testID}>
      <View style={[s.progress, { paddingTop: insets.top + spacing.lg }]}>
        {ONBOARDING_STEPS.map((k, i) => <View key={k} style={[s.dot, i <= idx && s.dotOn]} />)}
      </View>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInUp.duration(420)}>
          <T weight="bold" style={s.title} testID={`${testID}-title`}>{title}</T>
          {body ? <T style={s.body} testID={`${testID}-body`}>{body}</T> : null}
        </Animated.View>
        {children ? <Animated.View entering={FadeInUp.delay(120).duration(420)} style={{ marginTop: spacing.xl }}>{children}</Animated.View> : null}
      </ScrollView>
      <View style={[s.actions, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Button testID={`${testID}-primary`} title={primary} onPress={onPrimary} loading={loading} disabled={primaryDisabled} />
        {secondary ? <Button testID={`${testID}-secondary`} title={secondary} variant="ghost" onPress={onSecondary} /> : null}
        {showBack ? <Button testID={`${testID}-back`} title="Volver" variant="ghost" onPress={() => router.back()} /> : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  progress: { flexDirection: "row", gap: 5, paddingHorizontal: spacing.xl },
  dot: { height: 3, flex: 1, borderRadius: 2, backgroundColor: c.surfaceTertiary },
  dotOn: { backgroundColor: c.brandPrimary },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.xxxl + spacing.md, paddingBottom: spacing.xl },
  title: { fontSize: 30, lineHeight: 37, letterSpacing: -0.8 },
  body: { fontSize: 15.5, lineHeight: 24, color: c.muted, marginTop: spacing.lg },
  actions: { paddingHorizontal: spacing.xl, gap: spacing.xs },
}));
