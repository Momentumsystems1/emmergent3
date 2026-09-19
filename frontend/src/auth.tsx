// Auth backed by Supabase (email + password). Keeps the app's AuthProvider interface.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { sb } from "@/src/sb";
import { storage } from "@/src/utils/storage";

export type User = {
  id: string;
  email: string;
  language: string;
  plan: string;
  account_role: string;
  profile: { name: string; surname?: string | null } | null;
  avatar: { color: string; symbol: string; outline: string };
  onboarding: { completed: boolean; step: string };
  has_photo?: boolean;
};

type Ctx = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
  reload: () => Promise<User | null>;
  setUser: (u: User) => void;
};

const AuthContext = createContext<Ctx | null>(null);
export const ONBOARDING_KEY = "mycluster.onboarding";

export type LocalOnboarding = { step: string; terms_accepted_at?: string };

export async function getLocalOnboarding(): Promise<LocalOnboarding> {
  const raw = await storage.getItem<string | null>(ONBOARDING_KEY, null);
  if (!raw) return { step: "terms" };
  try { return JSON.parse(raw); } catch { return { step: "terms" }; }
}

export async function setLocalOnboarding(patch: Partial<LocalOnboarding>) {
  const cur = await getLocalOnboarding();
  await storage.setItem(ONBOARDING_KEY, JSON.stringify({ ...cur, ...patch }));
}

async function buildUser(): Promise<User | null> {
  const { data: { user: au } } = await sb.auth.getUser();
  if (!au) return null;
  const { data: prof } = await sb.from("profiles").select("display_name, avatar_color, avatar_symbol, photo_url").eq("id", au.id).maybeSingle();
  const { data: mems } = await sb.from("group_members").select("group_id").eq("user_id", au.id).eq("status", "active").limit(1);
  const hasName = !!prof?.display_name;
  const hasGroup = !!(mems && mems.length > 0);
  const step = !hasName ? "profile" : !hasGroup ? "group" : "done";
  return {
    id: au.id,
    email: au.email ?? "",
    language: "es",
    plan: "family",
    account_role: "user",
    profile: hasName ? { name: prof!.display_name! } : null,
    avatar: { color: prof?.avatar_color ?? "#06AED5", symbol: prof?.avatar_symbol ?? "person", outline: "none" },
    onboarding: { completed: step === "done", step },
    has_photo: !!prof?.photo_url,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const u = await buildUser();
      setUser(u);
      return u;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
    const { data: sub } = sb.auth.onAuthStateChange(() => { reload(); });
    return () => sub.subscription.unsubscribe();
  }, [reload]);

  const value = useMemo<Ctx>(() => ({
    user, loading, reload, setUser,
    signIn: async (email, password) => {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message === "Invalid login credentials" ? "Email o contraseña incorrectos" : error.message);
      const u = await buildUser();
      if (!u) throw new Error("No se pudo cargar la cuenta");
      setUser(u);
      return u;
    },
    register: async (email, password) => {
      const { error } = await sb.auth.signUp({ email, password });
      if (error) throw new Error(error.message);
      const u = await buildUser();
      if (!u) throw new Error("No se pudo crear la cuenta");
      setUser(u);
      return u;
    },
    signOut: async () => {
      await sb.auth.signOut();
      await storage.removeItem(ONBOARDING_KEY);
      setUser(null);
    },
  }), [user, loading, reload]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthProvider missing");
  return ctx;
}
