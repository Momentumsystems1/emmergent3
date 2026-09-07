import * as Linking from "expo-linking";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";

import { api, clientMeta, loadTokens, saveTokens } from "@/src/api";
import { cleanWebUrl, extractSessionId, openGoogleSignIn } from "@/src/googleAuth";
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
  google?: { name?: string; picture?: string } | null;
};

type Ctx = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string) => Promise<User>;
  /** Emergent-managed Google sign-in. Resolves with the user on mobile; on web it redirects (resolves null) and the
   * session is completed on the next mount. */
  signInWithGoogle: () => Promise<User | null>;
  signOut: () => Promise<void>;
  reload: () => Promise<User | null>;
  setUser: (u: User) => void;
};

const AuthContext = createContext<Ctx | null>(null);
export const ONBOARDING_KEY = "sentinel.onboarding";

export type LocalOnboarding = { step: string; terms_accepted_at?: string };

export async function getLocalOnboarding(): Promise<LocalOnboarding> {
  const raw = await storage.getItem<string | null>(ONBOARDING_KEY, null);
  if (!raw) return { step: "terms" };
  try {
    return JSON.parse(raw);
  } catch {
    return { step: "terms" };
  }
}

export async function setLocalOnboarding(patch: Partial<LocalOnboarding>) {
  const cur = await getLocalOnboarding();
  await storage.setItem(ONBOARDING_KEY, JSON.stringify({ ...cur, ...patch }));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const t = await loadTokens();
      if (!t) {
        setUser(null);
        return null;
      }
      const me = await api<User>("/auth/me");
      setUser(me);
      return me;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  const handleTokens = async (res: any) => {
    await saveTokens({ access_token: res.access_token, refresh_token: res.refresh_token });
    setUser(res.user);
    return res.user as User;
  };

  // One exchange per session_id (a deep link can surface the same id from several sources).
  const exchanged = useRef(new Set<string>());
  const exchange = useCallback(async (sessionId: string): Promise<User | null> => {
    if (exchanged.current.has(sessionId)) return null;
    exchanged.current.add(sessionId);
    const res = await api("/auth/session", { method: "POST", auth: false, json: { session_id: sessionId } });
    const u = await handleTokens(res);
    if (!u.onboarding?.completed) {
      const local = await getLocalOnboarding();
      await api("/consents", { method: "POST", json: { document: "terms", version: "2026-06-01", accepted: true, accepted_at_client: local.terms_accepted_at ?? new Date().toISOString(), ...clientMeta } }).catch(() => null);
      await setLocalOnboarding({ step: "profile" });
    }
    cleanWebUrl();
    return u;
  }, []);

  useEffect(() => {
    (async () => {
      // A session_id on the URL always wins over a stored session (Critical Rule 3).
      const url = Platform.OS === "web" ? window.location.href : await Linking.getInitialURL();
      const sid = extractSessionId(url);
      if (sid) { try { await exchange(sid); return; } catch { /* fall back to stored session */ } }
      await reload();
    })().finally(() => setLoading(false));
    if (Platform.OS === "web") return;
    const sub = Linking.addEventListener("url", (e) => { const sid = extractSessionId(e.url); if (sid) exchange(sid).catch(() => null); });
    return () => sub.remove();
  }, [reload, exchange]);

  const value = useMemo<Ctx>(() => ({
    user, loading, reload, setUser,
    signIn: async (email, password) => handleTokens(await api("/auth/login", { method: "POST", auth: false, json: { email, password, ...clientMeta } })),
    register: async (email, password) => handleTokens(await api("/auth/register", { method: "POST", auth: false, json: { email, password, ...clientMeta } })),
    signInWithGoogle: async () => { const sid = await openGoogleSignIn(); return sid ? exchange(sid) : null; },
    signOut: async () => {
      const t = await loadTokens();
      if (t) await api("/auth/logout", { method: "POST", json: { refresh_token: t.refresh_token } }).catch(() => null);
      await saveTokens(null);
      await storage.removeItem(ONBOARDING_KEY);
      setUser(null);
    },
  }), [user, loading, reload, exchange]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthProvider missing");
  return ctx;
}
