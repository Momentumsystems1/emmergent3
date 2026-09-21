// PostgREST directo (datos con RLS: zones, zone_events, convoys…).
// El JWT de la app es un token real de Supabase Auth (iss …/auth/v1, role authenticated),
// así que PostgREST aplica las políticas RLS por sí solo. La anon key es publicable por diseño;
// el service_role NUNCA aparece aquí (solo edge functions).
// Origen Supabase derivado de EXPO_PUBLIC_BACKEND_URL (…/functions/v1/sentinel-api → origen).
import { currentAccessToken, loadTokens, refreshAccess } from "@/src/api";

const FN_BASE = process.env.EXPO_PUBLIC_BACKEND_URL ?? "";
export const SUPA_ORIGIN = FN_BASE.split("/functions/")[0] || FN_BASE;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
const REST = `${SUPA_ORIGIN}/rest/v1`;

export class DbError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

async function raw<T>(method: string, path: string, body?: any, prefer?: string): Promise<T> {
  const headers: Record<string, string> = {
    apikey: ANON,
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;
  const tok = currentAccessToken() ?? (await loadTokens())?.access_token;
  if (tok) headers.Authorization = `Bearer ${tok}`;
  let r = await fetch(`${REST}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (r.status === 401 && (await refreshAccess())) {
    const t2 = currentAccessToken();
    if (t2) headers.Authorization = `Bearer ${t2}`;
    r = await fetch(`${REST}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  }
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    let msg = "Error de datos";
    try { const j = JSON.parse(text); msg = j.message || j.hint || msg; } catch { /* texto plano */ }
    throw new DbError(r.status, msg);
  }
  const text = await r.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const db = {
  list: <T>(table: string, query: string) => raw<T[]>("GET", `/${table}?${query}`),
  insert: <T>(table: string, row: any) => raw<T[]>("POST", `/${table}`, row, "return=representation"),
  update: <T>(table: string, query: string, patch: any) => raw<T[]>("PATCH", `/${table}?${query}`, patch, "return=representation"),
  remove: (table: string, query: string) => raw<null>("DELETE", `/${table}?${query}`),
};
