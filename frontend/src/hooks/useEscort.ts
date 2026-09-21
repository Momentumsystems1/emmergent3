// Modo Escolta — detector básico de caída v1 sobre useMotion (datos reales del acelerómetro).
// Patrón: pico de fuerza (>3 g ≈ 29,4 m/s²) seguido de inmovilidad sostenida (5 s cerca de 1 g)
// en una ventana de 10 s. Un bache en coche da el pico pero NO la inmovilidad: no dispara.
// Sin acelerómetro (escritorio) el modo funciona igual como estado visible, sin detector.
import { useEffect, useRef, useState } from "react";
import { useMotion, type MotionPermission } from "./useMotion";

const G = 9.81;
const SPIKE_MS2 = 3 * G; // > 3 g
const STILL_BAND = 1.6; // |a|-g dentro de ±1,6 m/s² = quieto
const STILL_MS = 5000; // inmovilidad sostenida
const WINDOW_MS = 10000; // ventana tras el pico

export type EscortState = {
  active: boolean;
  permission: MotionPermission;
  enable: () => Promise<void>; // pide permiso de sensores (gesto del usuario en iOS) y activa
  disable: () => void;
  fallAlert: boolean;
  clearFall: () => void;
};

export function useEscort(): EscortState {
  const [active, setActive] = useState(false);
  const [fallAlert, setFallAlert] = useState(false);
  const motion = useMotion(active);
  const spikeAt = useRef(0);
  const stillSince = useRef(0);

  useEffect(() => {
    if (!active || !motion.accel) return;
    const g = Math.hypot(motion.accel.x, motion.accel.y, motion.accel.z);
    const now = Date.now();
    if (g > SPIKE_MS2) {
      spikeAt.current = now;
      stillSince.current = 0;
      return;
    }
    if (!spikeAt.current) return;
    if (now - spikeAt.current > WINDOW_MS) {
      spikeAt.current = 0; // pico sin inmovilidad posterior: bache, no caída
      stillSince.current = 0;
      return;
    }
    if (Math.abs(g - G) <= STILL_BAND) {
      if (!stillSince.current) stillSince.current = now;
      else if (now - stillSince.current >= STILL_MS) {
        setFallAlert(true);
        spikeAt.current = 0;
        stillSince.current = 0;
      }
    } else {
      stillSince.current = 0; // se sigue moviendo tras el pico: no es caída
    }
  }, [active, motion.accel]);

  return {
    active,
    permission: motion.permission,
    enable: async () => {
      if (motion.permission === "prompt") await motion.request();
      setActive(true);
    },
    disable: () => {
      setActive(false);
      setFallAlert(false);
      spikeAt.current = 0;
      stillSince.current = 0;
    },
    fallAlert,
    clearFall: () => setFallAlert(false),
  };
}
