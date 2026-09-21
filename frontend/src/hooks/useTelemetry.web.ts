// useTelemetry (web) — batería (Battery Status API, Chrome/Android; Safari iOS no la expone)
// y velocidad real del GPS (geolocation.watchPosition). Todo local: nada sale del dispositivo.
import { useEffect, useState } from "react";

export type Telemetry = {
  battery: number | null; // 0-100
  speedKmh: number | null;
  state: "ruta" | "movimiento" | "parado" | null;
};

export const stateFromSpeed = (kmh: number | null): Telemetry["state"] =>
  kmh == null ? null : kmh >= 14 ? "ruta" : kmh >= 2 ? "movimiento" : "parado";

export function useTelemetry(active: boolean): Telemetry {
  const [battery, setBattery] = useState<number | null>(null);
  const [speedKmh, setSpeedKmh] = useState<number | null>(null);

  useEffect(() => {
    if (!active) return;
    let bat: any = null;
    let onLevel: (() => void) | null = null;
    (async () => {
      try {
        const nav: any = navigator;
        if (!nav.getBattery) return;
        bat = await nav.getBattery();
        setBattery(Math.round(bat.level * 100));
        onLevel = () => setBattery(Math.round(bat.level * 100));
        bat.addEventListener("levelchange", onLevel);
      } catch { /* sin batería: el HUD oculta ese dato */ }
    })();

    let watchId: number | null = null;
    try {
      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          (p) => setSpeedKmh(p.coords.speed != null ? Math.max(0, p.coords.speed * 3.6) : null),
          () => null,
          { enableHighAccuracy: true, maximumAge: 5000 },
        );
      }
    } catch { /* sin GPS */ }

    return () => {
      if (bat && onLevel) bat.removeEventListener("levelchange", onLevel);
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
    };
  }, [active]);

  return { battery, speedKmh, state: stateFromSpeed(speedKmh) };
}
