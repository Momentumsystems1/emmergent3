// Location sharing: contextual permission flow (check → explain → request → settings fallback) and periodic truthful
// position upload to Supabase (locations table) only when the user has granted the device permission.
import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Platform } from "react-native";

import { uploadPosition } from "@/src/sb";

export type LocPermState = "unknown" | "granted" | "denied" | "blocked";

export function useLocationSharing(enabled: boolean, groupId?: string) {
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
    if (!enabled || !groupId || perm !== "granted") { sub.current?.remove(); sub.current = null; return; }
    let cancelled = false;
    (async () => {
      try {
        sub.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 10000, distanceInterval: 15 }, async (loc) => {
          if (cancelled || Date.now() - lastPost.current < 8000) return;
          lastPost.current = Date.now();
          try {
            const at = await uploadPosition(groupId, { lat: loc.coords.latitude, lng: loc.coords.longitude, accuracy: loc.coords.accuracy });
            setLastSentAt(at); setError(null);
          } catch (e: any) { setError(e?.message ?? "No se pudo enviar la ubicación"); }
        });
      } catch (e: any) { setError(Platform.OS === "web" ? "Ubicación no disponible en este navegador" : e?.message); }
    })();
    return () => { cancelled = true; sub.current?.remove(); sub.current = null; };
  }, [enabled, groupId, perm]);

  return { perm, request, check, openSettings, lastSentAt, error };
}
