// Design norm for Sentinel map overlays: translucent-black card with blur that never covers the whole map.
// Always dark regardless of the app theme (glass over the map), so its text is white.
import { BlurView } from "expo-blur";
import React from "react";
import { Platform, StyleSheet, View, ViewProps } from "react-native";

import { radius } from "@/src/theme";

export const BLUR_TEXT = "#FFFFFF";
export const BLUR_MUTED = "rgba(255,255,255,0.66)";

export function BlurCard({ style, children, intensity = 32, rounded = radius.lg, ...p }: ViewProps & { intensity?: number; rounded?: number }) {
  return (
    <View {...p} style={[{ borderRadius: rounded, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.16)" }, style]}>
      {Platform.OS === "web" ? null : <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: Platform.OS === "web" ? "rgba(8,12,20,0.82)" : "rgba(6,10,18,0.56)" }]} />
      {children}
    </View>
  );
}
