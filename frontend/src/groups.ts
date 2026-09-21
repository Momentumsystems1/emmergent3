// Groups contract adapter. sentinel-api returns groups WITHOUT the members array (and stats may lack `members`).
// The UI dereferences g.members.filter(...) etc. — normalize once here so every screen gets safe defaults.
import { api } from "@/src/api";

export type NormalizedGroup = {
  id: string;
  name: string;
  owner_id: string;
  my_role: string;
  members: any[];
  stats: { members: number; pending: number };
  [k: string]: any;
};

export function normalizeGroup(g: any): NormalizedGroup {
  return {
    ...g,
    members: Array.isArray(g?.members) ? g.members : [],
    stats: { members: g?.stats?.members ?? (Array.isArray(g?.members) ? g.members.length : 0), pending: g?.stats?.pending ?? 0 },
  };
}

export async function fetchGroups(): Promise<NormalizedGroup[]> {
  const list = await api<any[]>("/groups");
  return (list ?? []).map(normalizeGroup);
}
