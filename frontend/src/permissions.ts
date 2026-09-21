// Permissions contract adapter. sentinel-api returns the raw permission EVENT LOG (array of rows, newest first);
// the UI consumes an EFFECTIVE-permissions record keyed `${key}::${scope}` → { effective, expires_at, key, scope }.
// Reduce keeping the latest row per (permission, scope). All screens must read through this — never raw rows.
import { api } from "@/src/api";

export type PermRow = {
  id: number;
  user_id: string;
  permission: string;
  granted: boolean;
  scope?: string | null;
  expires_at?: string | null;
  created_at: string;
};

export type EffectivePerm = { key: string; scope: string; effective: boolean; expires_at: string | null; at: string };

export async function fetchPermissionsRecord(): Promise<Record<string, EffectivePerm>> {
  const rows = await api<PermRow[]>("/permissions");
  const rec: Record<string, EffectivePerm> = {};
  for (const r of rows ?? []) {
    const scope = r.scope || "all";
    const k = `${r.permission}::${scope}`;
    const cur = rec[k];
    if (!cur || new Date(r.created_at).getTime() > new Date(cur.at).getTime()) {
      rec[k] = { key: r.permission, scope, effective: !!r.granted, expires_at: r.expires_at ?? null, at: r.created_at };
    }
  }
  return rec;
}
