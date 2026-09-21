// Convoys vía PostgREST + RLS (tablas convoys / convoy_members, migración 2026-09-21).
// Modelo: cualquier miembro activo del grupo crea un convoy y es su líder; unirse es self-join;
// cerrar lo hace el líder o un admin del grupo. Los gaps se calculan en cliente con las
// posiciones del grupo (edge /groups/:id/positions) — nunca instrucciones de velocidad.
import { db } from "@/src/db";

export type Convoy = {
  id: string;
  group_id: string;
  leader_id: string;
  name: string;
  dest_name: string | null;
  dest_lat: number | null;
  dest_lng: number | null;
  status: "active" | "closed";
  created_at: string;
  closed_at: string | null;
};
export type ConvoyMember = { convoy_id: string; group_id: string; user_id: string; role: "leader" | "member" | string; joined_at: string };

export const fetchActiveConvoy = (groupId: string) =>
  db.list<Convoy>("convoys", `group_id=eq.${groupId}&status=eq.active&select=*&order=created_at.desc&limit=1`).then((r) => r[0] ?? null);

export const fetchConvoy = (id: string) =>
  db.list<Convoy>("convoys", `id=eq.${id}&select=*`).then((r) => r[0] ?? null);

export const fetchConvoyMembers = (convoyId: string) =>
  db.list<ConvoyMember>("convoy_members", `convoy_id=eq.${convoyId}&select=*&order=joined_at.asc`);

export async function createConvoy(v: { group_id: string; leader_id: string; name: string; dest_name?: string | null; dest_lat?: number | null; dest_lng?: number | null }) {
  const rows = await db.insert<Convoy>("convoys", { ...v, status: "active" });
  const convoy = rows[0];
  await db.insert<ConvoyMember>("convoy_members", { convoy_id: convoy.id, group_id: v.group_id, user_id: v.leader_id, role: "leader" });
  return convoy;
}

export const joinConvoy = (convoyId: string, groupId: string, userId: string) =>
  db.insert<ConvoyMember>("convoy_members", { convoy_id: convoyId, group_id: groupId, user_id: userId, role: "member" });

export const leaveConvoy = (convoyId: string, userId: string) =>
  db.remove("convoy_members", `convoy_id=eq.${convoyId}&user_id=eq.${userId}`);

export const closeConvoy = (id: string) =>
  db.update<Convoy>("convoys", `id=eq.${id}`, { status: "closed", closed_at: new Date().toISOString() }).then((r) => r[0]);

// Estado de cohesión por distancia al líder (línea recta, posiciones en vivo del grupo).
export function gapState(meters: number | null): { label: string; tone: "green" | "amber" | "red" | "muted" } {
  if (meters == null) return { label: "Sin señal", tone: "muted" };
  if (meters < 300) return { label: "En formación", tone: "green" };
  if (meters < 1000) return { label: "Cerca", tone: "amber" };
  return { label: "Rezagado", tone: "red" };
}
