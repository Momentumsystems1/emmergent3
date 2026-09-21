// CO2 y sostenibilidad — calculado SOLO con datos reales: puntos del trail de ubicación
// (location_trail) de hoy del grupo. Distancia por haversine entre muestras consecutivas;
// el CO2 "evitado" cuenta solo los km no recorridos en coche × 0,12 kg/km (emisión media
// de un turismo; se muestra siempre como estimación).
import { db } from "./db";
import { distM } from "./zones";

export type TrailPoint = {
  id: number;
  user_id: string;
  group_id: string;
  lat: number;
  lng: number;
  speed_kmh: number | null;
  mode: string | null; // still | walk | bike | car | unknown
  at: string;
};

export const CO2_PER_KM = 0.12; // kg CO2 por km (coche medio, estimación)

const modeOf = (kmh: number | null): string =>
  kmh == null ? "unknown" : kmh < 1.8 ? "still" : kmh <= 8 ? "walk" : kmh <= 25 ? "bike" : "car";

// Registra un punto del trail (adornado: solo si >15 m o >60 s desde el último).
let lastTrail: { lat: number; lng: number; t: number } | null = null;
export async function recordTrailPoint(groupId: string, userId: string, pos: { lat: number; lng: number }, speedKmh: number | null) {
  const now = Date.now();
  if (lastTrail && distM(lastTrail, pos) < 15 && now - lastTrail.t < 60000) return;
  const prev = lastTrail;
  lastTrail = { ...pos, t: now };
  try {
    await db.insert("location_trail", { user_id: userId, group_id: groupId, lat: pos.lat, lng: pos.lng, speed_kmh: speedKmh, mode: modeOf(speedKmh) });
  } catch {
    lastTrail = prev; // si falla la red, el próximo punto vuelve a intentarlo
  }
}

export async function fetchTodayTrail(groupId: string): Promise<TrailPoint[]> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  return db.list<TrailPoint>("location_trail", `group_id=eq.${groupId}&at=gte.${since.toISOString()}&order=user_id.asc,at.asc&limit=2000&select=*`);
}

export type TrailSummary = { kmTotal: number; kmClean: number; kgCo2: number; members: number };

export function summarizeTrail(rows: TrailPoint[]): TrailSummary {
  let totalM = 0;
  let cleanM = 0;
  const byUser = new Map<string, TrailPoint[]>();
  rows.forEach((r) => {
    const a = byUser.get(r.user_id) ?? [];
    a.push(r);
    byUser.set(r.user_id, a);
  });
  byUser.forEach((list) => {
    for (let i = 1; i < list.length; i++) {
      const d = distM(list[i - 1], list[i]);
      if (d > 2000) continue; // salto irreal (salto de GPS): no cuenta
      totalM += d;
      if (list[i].mode !== "car") cleanM += d;
    }
  });
  return { kmTotal: totalM / 1000, kmClean: cleanM / 1000, kgCo2: (cleanM / 1000) * CO2_PER_KM, members: byUser.size };
}
