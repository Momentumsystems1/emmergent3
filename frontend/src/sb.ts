// ============================================================
// SUPABASE DATA LAYER — replaces the old FastAPI backend (src/api.ts).
// Talks directly to sentinel-dev. All reads/writes go through RLS;
// invitation preview/accept go through security-definer RPCs (P1).
// ============================================================
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

import { storage } from "@/src/utils/storage";

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Storage adapter: web → localStorage (supabase default); native → our storage wrapper.
const nativeStorage = {
  getItem: (k: string) => storage.getItem<string | null>(k, null),
  setItem: (k: string, v: string) => storage.setItem(k, v).then(() => undefined),
  removeItem: (k: string) => storage.removeItem(k).then(() => undefined),
};

export const sb: SupabaseClient = createClient(URL, ANON, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: Platform.OS === "web",
    ...(Platform.OS === "web" ? {} : { storage: nativeStorage }),
  },
});

// ---------- types ----------
export type GroupRow = { id: string; name: string; owner_id: string; my_role?: string; stats?: { pending?: number } };
export type MemberRow = { user_id: string; role: string; status: string; membership: string; expires_at: string | null; name: string; color: string };
export type PositionRow = { user_id: string; group_id: string; lat: number; lng: number; accuracy: number | null; battery: number | null; updated_at: string };

// ---------- groups & members ----------
export async function getMyGroups(): Promise<GroupRow[]> {
  const { data: mems, error } = await sb.from("group_members").select("group_id, role").eq("status", "active");
  if (error) throw new Error(error.message);
  if (!mems?.length) return [];
  const ids = mems.map((m: any) => m.group_id);
  const { data: groups, error: e2 } = await sb.from("groups").select("id, name, owner_id").in("id", ids);
  if (e2) throw new Error(e2.message);
  const { data: { user } } = await sb.auth.getUser();
  return (groups ?? []).map((g: any) => {
    const m = mems.find((mm: any) => mm.group_id === g.id);
    return { ...g, my_role: g.owner_id === user?.id ? "owner" : (m?.role ?? "member") };
  });
}

export async function getGroupMembers(groupId: string): Promise<MemberRow[]> {
  const { data: mems, error } = await sb.from("group_members")
    .select("user_id, role, status, membership, expires_at").eq("group_id", groupId);
  if (error) throw new Error(error.message);
  const ids = (mems ?? []).map((m: any) => m.user_id);
  if (!ids.length) return [];
  const { data: profs } = await sb.from("profiles").select("id, display_name, avatar_color").in("id", ids);
  return (mems ?? []).map((m: any) => {
    const p = (profs ?? []).find((pp: any) => pp.id === m.user_id);
    return { ...m, name: p?.display_name ?? "Miembro", color: p?.avatar_color ?? "#06AED5" };
  });
}

export async function createGroup(name: string): Promise<GroupRow> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Sin sesión");
  const { data: g, error } = await sb.from("groups").insert({ name, owner_id: user.id }).select().single();
  if (error) throw new Error(error.message);
  const { error: e2 } = await sb.from("group_members").insert({ group_id: g.id, user_id: user.id, role: "owner", status: "active", membership: "fixed" });
  if (e2) throw new Error(e2.message);
  return g as GroupRow;
}

// ---------- positions ----------
export async function getPositions(groupId: string): Promise<PositionRow[]> {
  const { data, error } = await sb.from("locations").select("user_id, group_id, lat, lng, accuracy, battery, updated_at").eq("group_id", groupId);
  if (error) throw new Error(error.message);
  return (data ?? []) as PositionRow[];
}

export function subscribePositions(groupId: string, onChange: () => void) {
  return sb.channel(`locations-${groupId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "locations", filter: `group_id=eq.${groupId}` }, onChange)
    .subscribe();
}

export async function uploadPosition(groupId: string, p: { lat: number; lng: number; accuracy?: number | null; battery?: number | null }) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Sin sesión");
  const { error } = await sb.from("locations").upsert({
    user_id: user.id, group_id: groupId, lat: p.lat, lng: p.lng,
    accuracy: p.accuracy ?? null, battery: p.battery ?? null, updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,group_id" });
  if (error) throw new Error(error.message);
  return new Date().toISOString();
}

// ---------- invitations (P1) ----------
export type InvitePreview = { group_name?: string; inviter_name?: string; invitee_name?: string; membership?: string; expires_at?: string | null; error?: string };

export async function getInvitationPreview(token: string): Promise<InvitePreview> {
  const { data, error } = await sb.rpc("get_invitation_preview", { p_token: token });
  if (error) throw new Error(error.message);
  return data as InvitePreview;
}

export async function acceptInvitation(token: string): Promise<{ group_name?: string; error?: string }> {
  const { data, error } = await sb.rpc("accept_invitation", { p_token: token });
  if (error) throw new Error(error.message);
  return data as { group_name?: string; error?: string };
}

export type InvitationRow = { token: string; group_id: string; invitee_name: string | null; membership: string; status: string; expires_at: string | null; created_at: string };

export async function createInvitation(groupId: string, input: { name: string; membership: "fixed" | "temporary"; expiresAt?: string | null }): Promise<InvitationRow> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Sin sesión");
  const { data, error } = await sb.from("invitations").insert({
    group_id: groupId, invited_by: user.id, invitee_name: input.name,
    membership: input.membership, expires_at: input.membership === "temporary" ? input.expiresAt : null,
    status: "prepared",
  }).select().single();
  if (error) throw new Error(error.message);
  return data as InvitationRow;
}

export async function getGroupInvitations(groupId: string): Promise<InvitationRow[]> {
  const { data, error } = await sb.from("invitations").select("token, group_id, invitee_name, membership, status, expires_at, created_at")
    .eq("group_id", groupId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as InvitationRow[];
}

export async function markDispatched(token: string) {
  await sb.from("invitations").update({ status: "dispatched" }).eq("token", token).eq("status", "prepared");
}

// ---------- SOS ----------
export async function sendSos(groupIds: string[], pos: { lat: number; lng: number } | null) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Sin sesión");
  const rows = groupIds.map((gid) => ({
    user_id: user.id, group_id: gid, kind: "emergency", status: "open",
    ...(pos ? { lat: pos.lat, lng: pos.lng } : {}),
  }));
  const { error } = await sb.from("alert_events").insert(rows);
  if (error) throw new Error(error.message);
}

// ---------- saved places ----------
export type SavedPlace = { id: number; label: string; address: string | null; lat: number; lng: number };

export async function getSavedPlaces(): Promise<SavedPlace[]> {
  const { data, error } = await sb.from("saved_places").select("id, label, address, lat, lng").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SavedPlace[];
}

export async function addSavedPlace(p: { label: string; address?: string | null; lat: number; lng: number }) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Sin sesión");
  const { error } = await sb.from("saved_places").insert({ user_id: user.id, label: p.label, address: p.address ?? null, lat: p.lat, lng: p.lng });
  if (error) throw new Error(error.message);
}

export async function deleteSavedPlace(id: number) {
  const { error } = await sb.from("saved_places").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------- profile ----------
export async function getMyProfile() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data;
}

export async function upsertProfile(patch: { display_name?: string; avatar_color?: string; avatar_symbol?: string }) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Sin sesión");
  const { error } = await sb.from("profiles").upsert({ id: user.id, ...patch });
  if (error) throw new Error(error.message);
}

// ---------- share flag (local, honest: user controls it) ----------
const SHARE_KEY = "mycluster.share_location";
export async function getShareLocation(): Promise<boolean> {
  const v = await storage.getItem<string | null>(SHARE_KEY, null);
  return v == null ? true : v === "1";
}
export async function setShareLocation(on: boolean) {
  await storage.setItem(SHARE_KEY, on ? "1" : "0");
}
