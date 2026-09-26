// Zonas (cercas geográficas) vía PostgREST + RLS.
// RLS: los miembros leen; solo owner/admin del grupo crean, editan y borran.
import { db } from "@/src/db";

export type ZoneKind = "home" | "work" | "school" | "other";
export type Zone = {
  id: string;
  group_id: string;
  name: string;
  kind: ZoneKind | string;
  address_hint: string | null;
  lat: number;
  lng: number;
  radius_m: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  /** Para quién es la cerca (quién la activa al entrar/salir). Vacío/null = todo el grupo (legado). */
  watch_user_ids?: string[] | null;
};
export type ZoneEvent = { id: number; zone_id: string; user_id: string; event: "enter" | "exit"; at?: string };

export const ZONE_KIND: Record<string, { label: string; icon: string }> = {
  home: { label: "Casa", icon: "home" },
  work: { label: "Trabajo", icon: "briefcase" },
  school: { label: "Colegio", icon: "school" },
  other: { label: "Otro", icon: "location" },
};

export const fetchZones = (groupId: string) =>
  db.list<Zone>("zones", `group_id=eq.${groupId}&select=*&order=created_at.asc`);

export const createZone = (z: Pick<Zone, "group_id" | "name" | "kind" | "lat" | "lng" | "radius_m"> & { address_hint?: string | null; created_by: string; watch_user_ids?: string[] }) =>
  db.insert<Zone>("zones", { ...z, is_active: true }).then((rows) => rows[0]);

export type ZonePatch = Partial<Pick<Zone, "name" | "kind" | "lat" | "lng" | "radius_m" | "is_active" | "watch_user_ids">>;
export const updateZone = (id: string, patch: ZonePatch) =>
  db.update<Zone>("zones", `id=eq.${id}`, patch).then((rows) => rows[0]);

export type ZoneSubscription = { zone_id: string; user_id: string; created_at: string };
/** Quién recibe el aviso de esta cerca (decide el administrador; nunca notificación implícita a todo el grupo). */
export const fetchZoneSubscriptions = (zoneId: string) =>
  db.list<ZoneSubscription>("zone_subscriptions", `zone_id=eq.${zoneId}&select=*`);

/** Sustituye la lista de suscriptores de una cerca (RLS: solo admin del grupo). */
export const replaceZoneSubscriptions = async (zoneId: string, userIds: string[]) => {
  await db.remove("zone_subscriptions", `zone_id=eq.${zoneId}`);
  if (!userIds.length) return;
  await db.insert("zone_subscriptions", userIds.map((user_id) => ({ zone_id: zoneId, user_id })));
};

/** ¿Le corresponde a este usuario activar esta cerca? (watch vacío = todo el grupo, compatibilidad). */
export const zoneWatchesUser = (z: Zone, userId: string | undefined) =>
  !!userId && (!z.watch_user_ids || z.watch_user_ids.length === 0 || z.watch_user_ids.includes(userId));

export const setZoneActive = (id: string, active: boolean) =>
  db.update<Zone>("zones", `id=eq.${id}`, { is_active: active }).then((rows) => rows[0]);

export const renameZone = (id: string, name: string) =>
  db.update<Zone>("zones", `id=eq.${id}`, { name }).then((rows) => rows[0]);

export const deleteZone = (id: string) => db.remove("zones", `id=eq.${id}`);

export const insertZoneEvent = (e: { group_id: string; zone_id: string; user_id: string; event: "enter" | "exit" }) =>
  db.insert<ZoneEvent>("zone_events", e);

export const fetchZoneEvents = (groupId: string, limit = 30) =>
  db.list<ZoneEvent>("zone_events", `group_id=eq.${groupId}&select=*&order=id.desc&limit=${limit}`);

// Distancia haversine en metros (compartida con map.tsx para evaluar transiciones).
export const distM = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371000, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
export const insideZone = (p: { lat: number; lng: number }, z: Zone) => distM(p, z) <= z.radius_m;
