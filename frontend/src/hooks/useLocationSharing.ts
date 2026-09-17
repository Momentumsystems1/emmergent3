// Location sharing: contextual permission flow (check → explain → request → settings fallback) and periodic truthful
// position upload only when the user has an effective location-sharing permission.
import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Platform } from "react-native";

import { api } from "@/src/api";

export type LocPermState = "unknown" | "granted" | "denied" | "blocked";

export function useLocationSharing(enabled: boolean, opts?: { refreshSec?: number; paused?: boolean }) {
  const refreshSec = Math.max(5, Math.min(opts?.refreshSec ?? 10, 900));
  const paused = !!opts?.paused;
  const active = enabled && !paused;
  const [perm, setPerm] = useState<LocPermState>("unknown");
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sub = useRef<Location.LocationSubscription | null>(null);
  const lastPost = useRef(0);

  const check = useCallback(async () => {
    const p = await Location.getForegroundPermissionsAsync();
    setPerm(p.granted ? "granted" : p.canAskAgain ? (p.status === "undetermined" ? "unknown" : "denied") : "blocked");
    return p;
  }, []);

  const request = useCallback(async () => {
    const p = await Location.requestForegroundPermissionsAsync();
    setPerm(p.granted ? "granted" : p.canAskAgain ? "denied" : "blocked");
    return p.granted;
  }, []);

  const openSettings = useCallback(() => { Linking.openSettings().catch(() => null); }, []);

  useEffect(() => { check(); }, [check]);

  useEffect(() => {
    if (!active || perm !== "granted") { sub.current?.remove(); sub.current = null; return; }
    let cancelled = false;
    const gap = refreshSec * 1000;
    (async () => {
      try {
        sub.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: gap, distanceInterval: 15 }, async (loc) => {
          if (cancelled || Date.now() - lastPost.current < gap - 1500) return;
          lastPost.current = Date.now();
          const speed = loc.coords.speed ?? null;
          try {
            const r = await api<{ at: string }>("/location", { method: "POST", json: {
              lat: loc.coords.latitude, lng: loc.coords.longitude, accuracy: loc.coords.accuracy, speed, heading: loc.coords.heading,
              status: speed != null && speed > 1 ? "moving" : "stopped", mobility_mode: speed != null && speed > 8 ? "car" : speed != null && speed > 1.5 ? "walk" : "unknown",
            } });
            setLastSentAt(r.at); setError(null);
          } catch (e: any) { setError(e?.message ?? "No se pudo enviar la ubicación"); }
        });
      } catch (e: any) { setError(Platform.OS === "web" ? "Ubicación no disponible en este navegador" : e?.message); }
    })();
    return () => { cancelled = true; sub.current?.remove(); sub.current = null; };
  }, [active, perm, refreshSec]);

  return { perm, request, check, openSettings, lastSentAt, error, refreshSec, paused };
}
