// useMotion (web) — DeviceMotion/DeviceOrientation nativos del navegador.
// iOS 13+ exige requestPermission() tras un gesto del usuario; Chrome/Android lo da directo.
// En escritorio no hay sensores: permission queda "unsupported" y la UI lo muestra con claridad.
import { useEffect, useRef, useState } from "react";

export type Vec3 = { x: number; y: number; z: number };
export type MotionPermission = "granted" | "prompt" | "denied" | "unsupported";

export type MotionState = {
  accel: Vec3 | null; // m/s² con gravedad
  gyro: Vec3 | null; // deg/s (rotationRate alpha/beta/gamma)
  heading: number | null; // grados 0-360 si el navegador la da
  permission: MotionPermission;
  request: () => Promise<boolean>;
};

export function useMotion(active: boolean): MotionState {
  const [accel, setAccel] = useState<Vec3 | null>(null);
  const [gyro, setGyro] = useState<Vec3 | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [permission, setPermission] = useState<MotionPermission>(() =>
    typeof window !== "undefined" && "DeviceMotionEvent" in window ? "prompt" : "unsupported",
  );
  const last = useRef(0);

  useEffect(() => {
    if (!active || permission !== "granted") return;
    const onMotion = (e: DeviceMotionEvent) => {
      const now = Date.now();
      if (now - last.current < 200) return; // 5 Hz bastan para la UI
      last.current = now;
      const a = e.accelerationIncludingGravity;
      if (a && a.x != null) setAccel({ x: a.x, y: a.y ?? 0, z: a.z ?? 0 });
      const r = e.rotationRate;
      if (r && r.alpha != null) setGyro({ x: r.beta ?? 0, y: r.gamma ?? 0, z: r.alpha });
    };
    const onOrient = (e: DeviceOrientationEvent) => {
      const h = (e as any).webkitCompassHeading ?? (e.alpha != null ? 360 - e.alpha : null);
      if (h != null) setHeading(Math.round(((h % 360) + 360) % 360));
    };
    window.addEventListener("devicemotion", onMotion);
    window.addEventListener("deviceorientation", onOrient);
    return () => {
      window.removeEventListener("devicemotion", onMotion);
      window.removeEventListener("deviceorientation", onOrient);
    };
  }, [active, permission]);

  const request = async () => {
    try {
      const DM: any = (window as any).DeviceMotionEvent;
      const DO: any = (window as any).DeviceOrientationEvent;
      if (DM?.requestPermission) {
        const r = await DM.requestPermission();
        if (DO?.requestPermission) await DO.requestPermission().catch(() => null);
        setPermission(r === "granted" ? "granted" : "denied");
        return r === "granted";
      }
      setPermission("granted");
      return true;
    } catch {
      setPermission("denied");
      return false;
    }
  };

  return { accel, gyro, heading, permission, request };
}
