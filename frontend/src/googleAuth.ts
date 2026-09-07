// Emergent-managed Google sign-in (frontend side). The frontend never talks to Emergent's API: it only opens the hosted
// auth page and hands the one-time `session_id` from the redirect to our backend (`POST /api/auth/session`).
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

WebBrowser.maybeCompleteAuthSession();

const AUTH_URL = "https://auth.emergentagent.com/";

export function extractSessionId(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function redirectUrl(): string {
  if (Platform.OS === "web") return `${window.location.origin}/`;
  return Linking.createURL("");
}

/** Web: full-page redirect (never a popup). Mobile: auth session; resolves with the session_id or null. */
export async function openGoogleSignIn(): Promise<string | null> {
  const redirect = redirectUrl();
  const authUrl = `${AUTH_URL}?redirect=${encodeURIComponent(redirect)}`;
  if (Platform.OS === "web") { window.location.href = authUrl; return null; }
  let fromListener: string | null = null;
  const sub = Linking.addEventListener("url", (e) => { fromListener = extractSessionId(e.url) ?? fromListener; });
  try {
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirect);
    const direct = result.type === "success" ? extractSessionId(result.url) : null;
    if (direct) return direct;
    // Android Custom Tabs often report "dismiss" although the OS delivered the deep link.
    await new Promise((r) => setTimeout(r, 400));
    return fromListener ?? extractSessionId(await Linking.getInitialURL());
  } finally { sub.remove(); }
}

/** Web only: strip session_id from the current URL after a successful exchange (keep every other param). */
export function cleanWebUrl() {
  if (Platform.OS !== "web") return;
  const u = new URL(window.location.href);
  u.searchParams.delete("session_id");
  const hash = u.hash.replace(/^#/, "").split("&").filter((p) => p && !p.startsWith("session_id=")).join("&");
  u.hash = hash;
  window.history.replaceState(window.history.state, "", u.toString());
}
