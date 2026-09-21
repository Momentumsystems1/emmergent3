// useMotion (nativo) — expo-sensors. Misma interfaz que la versión web.
import { Accelerometer, Gyroscope } from "expo-sensors";
import { useEffect, useState } from "react";

export type Vec3 = { x: number; y: number; z: number };
export type MotionPermission = "granted" | "prompt" | "denied" | "unsupported";

export type MotionState = {
  accel: Vec3 | null;
  gyro: Vec3 | null;
  heading: number | null;
  permission: MotionPermission;
  request: () => Promise<boolean>;
};

export function useMotion(active: boolean): MotionState {
  const [accel, setAccel] = useState<Vec3 | null>(null);
  const [gyro, setGyro] = useState<Vec3 | null>(null);
  const [permission, setPermission] = useState<MotionPermission>("granted"); // nativo no pide permiso para acelerómetro/giroscopio

  useEffect(() => {
    if (!active) return;
    Accelerometer.setUpdateInterval(200);
    Gyroscope.setUpdateInterval(200);
    const sa = Accelerometer.addListener((v) => setAccel({ x: v.x * 9.80665, y: v.y * 9.80665, z: v.z * 9.80665 })); // g → m/s²
    const sg = Gyroscope.addListener((v) => setGyro({ x: (v.x * 180) / Math.PI, y: (v.y * 180) / Math.PI, z: (v.z * 180) / Math.PI })); // rad/s → deg/s
    return () => { sa.remove(); sg.remove(); };
  }, [active]);

  return { accel, gyro, heading: null, permission, request: async () => true };
}
