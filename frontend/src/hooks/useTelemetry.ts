// useTelemetry nativo (Android/iOS): expo-battery + expo-location.
import { useEffect, useRef, useState } from "react";
import * as Battery from "expo-battery";
import * as Location from "expo-location";
import { stateFromSpeed, type Telemetry } from "./useTelemetry.web";

export function useTelemetry(active: boolean): Telemetry {
  const [battery, setBattery] = useState<number | null>(null);
  const [speedKmh, setSpeedKmh] = useState<number | null>(null);
  const subRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    Battery.getBatteryLevelAsync()
      .then((l) => alive && setBattery(l >= 0 ? Math.round(l * 100) : null))
      .catch(() => {});
    const sub = Battery.addBatteryLevelListener(({ batteryLevel }) => {
      setBattery(batteryLevel >= 0 ? Math.round(batteryLevel * 100) : null);
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    Location.getForegroundPermissionsAsync()
      .then((p) => {
        if (!alive || !p.granted) return;
        return Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 5 },
          (loc) => {
            if (!alive) return;
            const mps = loc.coords.speed;
            setSpeedKmh(mps != null && mps >= 0 ? mps * 3.6 : null);
          },
        ).then((s) => {
          if (alive) subRef.current = s;
          else s.remove();
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
      subRef.current?.remove();
      subRef.current = null;
    };
  }, [active]);

  return { battery, speedKmh, state: stateFromSpeed(speedKmh) };
}
