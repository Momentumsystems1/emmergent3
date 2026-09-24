// Web renderer: Google Maps JavaScript API (interactive, MY CLUSTER look) with automatic fallback
// to the backend static image if the browser key is missing/rejected or the API can't load.
// Same props contract as the native canvas (mapTypes.ts) — callers don't change.
import Ionicons from "@react-native-vector-icons/ionicons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, Pressable, Text, View } from "react-native";

import { api, BASE, loadTokens } from "@/src/api";
import { incidentIcon, LatLng, MapCanvasProps, MapPerson } from "@/src/components/mapTypes";
import { PersonAvatar } from "@/src/components/orbs";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export * from "@/src/components/mapTypes";

const TILE = 256;
const zoomFor = (delta: number) => Math.max(3, Math.min(19, Math.round(Math.log2(180 / delta))));
const mx = (lng: number, z: number) => ((lng + 180) / 360) * TILE * 2 ** z;
const my = (lat: number, z: number) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * TILE * 2 ** z; };
const unx = (x: number, z: number) => (x / (TILE * 2 ** z)) * 360 - 180;
const uny = (y: number, z: number) => { const n = Math.PI - (2 * Math.PI * y) / (TILE * 2 ** z); return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); };
const hex = (c?: string) => (c && /^#[0-9a-fA-F]{6}$/.test(c) ? c.slice(1) : "E11D48");

const GKEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? "";
// Segunda key de respaldo: si la principal está restringida/bloqueada en este dominio, se prueba la alternativa.
const GKEY_FALLBACK = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY_FALLBACK ?? "";
const GKEYS = [...new Set([GKEY, GKEY_FALLBACK].filter((k) => !!k))];
// Optional vector Map ID (cloud console). With it: tilt/3D on roadmap + AdvancedMarkerElement. Without: raster roadmap (no tilt).
const GMAPID = process.env.EXPO_PUBLIC_GOOGLE_MAP_ID ?? "";
const FOLLOW_ZOOM = 17.5; // close follow on a person (native uses pitch3d=50 + tight zoom; mirror it on web)
const TILT_3D = 60; // apertura "tipo Google": perspectiva 3D real (requiere mapId vectorial; sin él Google lo ignora)

// Calle de cada persona (geocodificación inversa): caché global con TTL, clave por persona y rejilla ~11 m,
// para no repetir llamadas en cada poll de posiciones (10 s).
const streetCache = new Map<string, { t: number; s: string }>();
const STREET_TTL = 10 * 60 * 1000;
const streetKey = (p: MapPerson) => `${p.member_id}:${(p.lat ?? 0).toFixed(4)}:${(p.lng ?? 0).toFixed(4)}`;

// CSS de los marcadores avanzados (AdvancedMarkerElement): se inyecta una sola vez en el documento.
let mcStylesInjected = false;
function ensureMcStyles() {
  if (mcStylesInjected || typeof document === "undefined") return;
  mcStylesInjected = true;
  const css = `
.mc-pin{display:flex;flex-direction:column;align-items:center;transform:translateY(-4px)}
.mc-ava{width:44px;height:44px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;overflow:hidden;background:#D93025}
.mc-ava img{width:100%;height:100%;object-fit:cover}
.mc-ava span{color:#fff;font:700 16px/1 "Plus Jakarta Sans",Roboto,sans-serif}
.mc-pin--me .mc-ava{width:52px;height:52px}
.mc-pin--me .mc-ava{border-color:#fff;box-shadow:0 0 0 4px rgba(234,67,53,.28),0 2px 8px rgba(0,0,0,.35)}
.mc-stem{width:2px;height:6px;background:rgba(255,255,255,.92)}
.mc-chip{margin-top:5px;background:rgba(255,255,255,.95);border-radius:9px;padding:3px 8px 4px;text-align:center;box-shadow:0 1px 6px rgba(0,0,0,.25);max-width:180px}
.mc-name{display:block;color:#202124;font:700 11.5px/1.25 "Plus Jakarta Sans",Roboto,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mc-addr{display:block;color:#5F6368;font:600 10px/1.3 "Plus Jakarta Sans",Roboto,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mc-dark .mc-chip{background:rgba(32,33,36,.92)}
.mc-dark .mc-name{color:#E8EAED}
.mc-dark .mc-addr{color:#9AA0A6}`;
  const tag = document.createElement("style");
  tag.setAttribute("data-mc", "1");
  tag.textContent = css;
  document.head.appendChild(tag);
}

// ---------- Google Maps boot (no dependency: script injection + importLibrary) ----------
declare global { interface Window { google?: any; __mcGmapsPromise?: Promise<any> } }
// Inyecta el bootstrap de Google para UNA key. Con loading=async, el onload del <script> solo
// confirma que el loader ligero llegó; window.google.maps aparece DESPUÉS (puede tardar segundos
// en móvil). Por eso tras onload se hace polling en vez de rechazar de inmediato: el rechazo
// prematuro era la causa del falso "fallo" que activaba el mapa estático.
function injectGmaps(key: string, timeoutMs = 20000): Promise<any> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&v=weekly&loading=async`;
    s.async = true;
    let settled = false;
    const done = (err?: Error) => { if (settled) return; settled = true; clearTimeout(to); clearInterval(poll); if (err) s.remove(); err ? reject(err) : resolve(window.google.maps); };
    const to = setTimeout(() => done(new Error("gmaps timeout")), timeoutMs);
    let polls = 0;
    let poll: any;
    s.onerror = () => done(new Error("gmaps script error"));
    s.onload = () => {
      poll = setInterval(() => {
        // Con loading=async, window.google.maps aparece antes de que exista la
        // clase Map: no dar por buena la API hasta que el constructor esté disponible.
        if (window.google?.maps?.Map) done();
        else if (++polls > 100) done(new Error("gmaps not present")); // ~10s de gracia tras onload
      }, 100);
    };
    document.head.appendChild(s);
  });
}
function loadGmaps(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
  if (window.__mcGmapsPromise) return window.__mcGmapsPromise;
  window.__mcGmapsPromise = (async () => {
    let lastErr: any = new Error("no gmaps keys configured");
    for (const key of GKEYS) {
      if (deadKeys.has(key)) continue; // key ya rechazada por Google en este dispositivo
      try { const m = await injectGmaps(key); activeKey = key; return m; } catch (e) { lastErr = e; }
    }
    window.__mcGmapsPromise = undefined;
    throw lastErr;
  })();
  return window.__mcGmapsPromise;
}

// Keys que Google ha rechazado en este dispositivo (p. ej. restricción de referrer).
const deadKeys = new Set<string>();
let activeKey = "";
// Limpia por completo una instancia de Google Maps fallida para poder recargar con otra key.
function purgeGmaps() {
  if (typeof window === "undefined") return;
  document.querySelectorAll('script[src*="maps.googleapis.com"]').forEach((s) => s.parentNode?.removeChild(s));
  (window as any).google = undefined;
  window.__mcGmapsPromise = undefined;
}

const DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1d1f24" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9aa0a6" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1d1f24" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2e3138" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#141518" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#14181f" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#23252b" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#18211b" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#23252b" }] },
];

// ---------- marker artwork (SVG data URIs, self-contained) ----------
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "·";
function personIcon(p: MapPerson, isMe: boolean, street?: string): { url: string; scaledSize: any; anchor: any } {
  const color = /^#[0-9a-fA-F]{6}$/.test(p.color) ? p.color : "#D93025";
  const init = esc(initials(p.name));
  const name = esc(p.name.length > 14 ? `${p.name.slice(0, 13)}…` : p.name);
  const addr = street ? esc(street.length > 22 ? `${street.slice(0, 21)}…` : street) : "";
  const svg = isMe
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="30" fill="${color}" opacity="0.16"/><circle cx="32" cy="32" r="19" fill="${color}" opacity="0.32"/><circle cx="32" cy="32" r="10" fill="${color}" stroke="#ffffff" stroke-width="3.5"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="${addr ? 88 : 72}"><g><circle cx="48" cy="26" r="22" fill="${color}" stroke="#ffffff" stroke-width="3"/><text x="48" y="32" font-family="Arial, sans-serif" font-size="17" font-weight="700" fill="#ffffff" text-anchor="middle">${init}</text></g><rect x="${48 - (name.length * 3.4 + 10)}" y="52" width="${name.length * 6.8 + 20}" height="${addr ? 30 : 17}" rx="8.5" fill="#ffffff" opacity="0.94"/><text x="48" y="64.5" font-family="Arial, sans-serif" font-size="10.5" font-weight="600" fill="#202124" text-anchor="middle">${name}</text>${addr ? `<text x="48" y="77" font-family="Arial, sans-serif" font-size="9" font-weight="600" fill="#5F6368" text-anchor="middle">${addr}</text>` : ""}</svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: isMe ? { width: 64, height: 64 } : { width: 96, height: addr ? 88 : 72 },
    anchor: isMe ? { x: 32, y: 32 } : { x: 48, y: 28 },
  };
}

// Contenido HTML del marcador avanzado (requiere mapId vectorial): avatar con foto, nombre y calle.
// `token` autentica la foto contra nuestro backend (mismo patrón que UserPhoto en web).
function personHtml(p: MapPerson, street: string | undefined, token: string | null): { html: string; key: string } {
  const color = /^#[0-9a-fA-F]{6}$/.test(p.color) ? p.color : "#D93025";
  const photoUrl = p.photo_url && token ? `${BASE}/media/user/${p.user_id}/photo?token=${encodeURIComponent(token)}` : null;
  const init = esc(initials(p.name));
  const name = esc(p.name.length > 20 ? `${p.name.slice(0, 19)}…` : p.name);
  const addr = street ? esc(street) : "";
  const key = `${p.name}|${p.color}|${addr}|${photoUrl ? 1 : 0}|${p.is_me ? 1 : 0}`;
  const html = `<div class="mc-pin${p.is_me ? " mc-pin--me" : ""}"><div class="mc-ava" style="background:${color}">${photoUrl ? `<img src="${photoUrl}" alt="" onerror="this.parentElement.innerHTML='<span>${init}</span>'">` : `<span>${init}</span>`}</div><div class="mc-stem"></div><div class="mc-chip"><span class="mc-name">${name}</span>${addr ? `<span class="mc-addr">${addr}</span>` : ""}</div></div>`;
  return { html, key };
}
function incidentIconG(roadClosed: boolean): { url: string; scaledSize: any; anchor: any } {
  const bg = roadClosed ? "#D93025" : "#F9AB00";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26"><circle cx="13" cy="13" r="11" fill="${bg}" stroke="#ffffff" stroke-width="2"/><text x="13" y="17.5" font-family="Arial, sans-serif" font-size="13" font-weight="800" fill="#ffffff" text-anchor="middle">!</text></svg>`;
  return { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, scaledSize: { width: 26, height: 26 }, anchor: { x: 13, y: 13 } };
}
function pinIcon(color: string): { url: string; scaledSize: any; anchor: any } {
  const c = /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#D93025";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42"><path d="M15 1C7.8 1 2 6.8 2 14c0 9.8 13 27 13 27s13-17.2 13-27C28 6.8 22.2 1 15 1z" fill="${c}" stroke="#ffffff" stroke-width="2"/><circle cx="15" cy="14" r="5.5" fill="#ffffff"/></svg>`;
  return { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, scaledSize: { width: 30, height: 42 }, anchor: { x: 15, y: 41 } };
}

// ---------- interactive Google canvas ----------
function GoogleMapCanvas(props: MapCanvasProps) {
  const { people, pins = [], polyline, circles = [], onPersonPress, center, zoomDelta = 0.01, onMapPress, onMapLongPress, onUserPan, selected, traffic, incidents = [], onIncidentPress } = props;
  const { colors, scheme } = useTheme();
  const hostRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const markersMap = useRef(new Map<string, any>()); // diff por id: update en vez de recrear
  const circlesMap = useRef(new Map<string, any>()); // cercas: diff por id
  const circleLabelsMap = useRef(new Map<string, any>()); // etiquetas de cerca: diff por id
  const pulsePhase = useRef(0);
  const listenersRef = useRef<any[]>([]); // todos los listeners mueren al desmontar
  const polyRef = useRef<any>(null);
  const trafficRef = useRef<any>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [advLib, setAdvLib] = useState<any>(null); // AdvancedMarkerElement cuando hay mapId vectorial
  const [token, setToken] = useState<string | null>(null); // JWT para las fotos de los avatares
  const [streets, setStreets] = useState<Record<string, string>>({});
  const retry = () => { deadKeys.clear(); purgeGmaps(); setAdvLib(null); setFailed(false); setReady(false); setAttempt((a) => a + 1); };

  const located = people.filter((p) => p.state === "shared" && p.lat != null);
  const me = located.find((p) => p.is_me);
  const fallback: LatLng = me ? { lat: me.lat!, lng: me.lng! } : located[0] ? { lat: located[0].lat!, lng: located[0].lng! } : pins[0] ? { lat: pins[0].lat, lng: pins[0].lng } : { lat: 40.4168, lng: -3.7038 };

  // boot once
  useEffect(() => {
    let dead = false;
    loadGmaps().then(async (maps) => {
      if (dead || !hostRef.current) return;
      ensureMcStyles();
      loadTokens().then((t) => !dead && setToken(t?.access_token ?? null)).catch(() => {});
      // Librería de marcadores avanzados (avatar con foto): solo con mapId vectorial.
      if (GMAPID && maps.importLibrary) {
        maps.importLibrary("marker").then((lib: any) => !dead && setAdvLib(lib)).catch(() => {});
      }
      const c = center ?? fallback;
      // Apertura "tipo Google": se crea un poco alejado y la cámara entra en 3D hacia el avatar.
      const map = new maps.Map(hostRef.current, {
        center: { lat: c.lat, lng: c.lng },
        zoom: center ? 14 : 12,
        mapId: GMAPID || undefined,
        disableDefaultUI: true,
        gestureHandling: "greedy",
        clickableIcons: false,
        // mapId switches styling to cloud-based; only pass inline styles without it
        styles: !GMAPID && scheme === "dark" ? DARK_STYLE : undefined,
        backgroundColor: colors.mapTint,
      });
      if (center) {
        const cam: any = { center: { lat: c.lat, lng: c.lng }, zoom: FOLLOW_ZOOM, tilt: TILT_3D, heading: 0 };
        setTimeout(() => {
          if (dead || !mapRef.current) return;
          if (typeof map.moveCamera === "function") map.moveCamera(cam);
          else { map.setZoom(cam.zoom); map.setTilt(cam.tilt); if (map.setHeading) map.setHeading(cam.heading); }
        }, 450);
      }
      const L = listenersRef.current;
      L.push(map.addListener("click", (e: any) => onMapPress?.({ lat: e.latLng.lat(), lng: e.latLng.lng() })));
      L.push(map.addListener("dragstart", () => onUserPan?.()));
      // long-press emulation (web has no native long-press)
      let lpTimer: any = null;
      L.push(map.addListener("mousedown", (e: any) => { lpTimer = setTimeout(() => onMapLongPress?.({ lat: e.latLng.lat(), lng: e.latLng.lng() }), 550); }));
      ["mouseup", "dragstart"].forEach((ev) => L.push(map.addListener(ev, () => clearTimeout(lpTimer))));
      trafficRef.current = new maps.TrafficLayer();
      mapRef.current = map;
      setReady(true);
      // Si Google rechaza la key (p. ej. restricción de referrer), no lanza excepción:
      // pinta su propio overlay "Oops! Something went wrong" dentro del contenedor.
      // Lo detectamos y saltamos a la siguiente key; si no quedan, respaldo estático + reintento.
      const errPoll = setInterval(() => {
        if (dead) { clearInterval(errPoll); return; }
        const host = hostRef.current;
        if (host && (host.querySelector('.gm-err-message') || host.querySelector('[class*="gm-err"]'))) {
          clearInterval(errPoll);
          if (activeKey) deadKeys.add(activeKey);
          purgeGmaps();
          if (GKEYS.some((k) => !deadKeys.has(k))) {
            setReady(false);
            setAttempt((a) => a + 1);
          } else {
            setFailed(true);
          }
        }
      }, 500);
      setTimeout(() => clearInterval(errPoll), 10000);
    }).catch(() => setFailed(true));
    return () => {
      dead = true;
      listenersRef.current.forEach((l) => l?.remove?.());
      listenersRef.current = [];
      markersMap.current.forEach((m) => { window.google?.maps?.event?.clearInstanceListeners?.(m); if (typeof m.setMap === "function") m.setMap(null); else m.map = null; });
      markersMap.current.clear();
      circlesMap.current.forEach((c) => c.setMap(null));
      circlesMap.current.clear();
      circleLabelsMap.current.forEach((m) => m.setMap(null));
      circleLabelsMap.current.clear();
      polyRef.current?.setMap(null); polyRef.current = null;
      trafficRef.current?.setMap(null); trafficRef.current = null;
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // style follow (theme switch without rebuild)
  useEffect(() => { if (ready && mapRef.current && !GMAPID) mapRef.current.setOptions({ styles: scheme === "dark" ? DARK_STYLE : undefined }); }, [ready, scheme]);
  // camera follow: close 3D zoom on the followed target
  useEffect(() => {
    if (!ready || !center || !mapRef.current) return;
    const map = mapRef.current;
    const cam: any = { center: { lat: center.lat, lng: center.lng }, zoom: FOLLOW_ZOOM, tilt: TILT_3D };
    if (typeof map.moveCamera === "function") map.moveCamera(cam);
    else { map.panTo(cam.center); map.setZoom(cam.zoom); map.setTilt(cam.tilt); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, center?.lat, center?.lng, center?.key]);
  // traffic layer
  useEffect(() => { if (ready && trafficRef.current) trafficRef.current.setMap(traffic ? mapRef.current : null); }, [ready, traffic]);

  // Calle de cada persona visible: geocodificación inversa con caché (1 llamada por persona y ~11 m de movimiento)
  useEffect(() => {
    if (!ready) return;
    const now = Date.now();
    const fresh: Record<string, string> = {};
    let changed = false;
    for (const p of located) {
      if (p.lat == null || p.lng == null) continue;
      const k = streetKey(p);
      const hit = streetCache.get(k);
      if (hit && now - hit.t < STREET_TTL) {
        if (streets[p.member_id] !== hit.s) { fresh[p.member_id] = hit.s; changed = true; }
        continue;
      }
      api<{ short?: string }>(`/mobility/reverse?lat=${p.lat}&lng=${p.lng}`)
        .then((r) => {
          const s = r?.short;
          if (!s) return;
          streetCache.set(k, { t: Date.now(), s });
          setStreets((prev) => prev[p.member_id] === s ? prev : { ...prev, [p.member_id]: s });
        })
        .catch(() => {});
    }
    if (changed) setStreets((prev) => ({ ...prev, ...fresh }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, JSON.stringify(located.map((p) => [p.member_id, p.lat, p.lng]))]);

  // markers sync: create once, then setPosition/setIcon — no parpadeo ni recreación en cada poll
  useEffect(() => {
    if (!ready || !mapRef.current || !window.google) return;
    const maps = window.google.maps;
    const alive = new Set<string>();
    const upsert = (id: string, pos: { lat: number; lng: number }, icon: any, title: string, zIndex: number, onClick?: () => void) => {
      alive.add(id);
      let m = markersMap.current.get(id);
      if (!m) {
        m = new maps.Marker({ map: mapRef.current, zIndex, title });
        m.__mcClick = onClick;
        m.addListener("click", () => m.__mcClick?.());
        markersMap.current.set(id, m);
      }
      m.setPosition(pos);
      m.setIcon(icon);
      m.setTitle(title);
      m.setZIndex(zIndex);
    };
    const drop = (m: any) => { window.google.maps.event.clearInstanceListeners(m); if (typeof m.setMap === "function") m.setMap(null); else m.map = null; };
    const upsertPerson = (p: (typeof located)[number]) => {
      const id = `person-${p.member_id}`;
      alive.add(id);
      const pos = { lat: p.lat!, lng: p.lng! };
      const street = streets[p.member_id];
      const Adv = advLib?.AdvancedMarkerElement;
      if (Adv) {
        // Marcador avanzado: avatar con foto + nombre + calle. Se recrea solo cuando cambia su contenido.
        const { html, key } = personHtml(p, street, token);
        const fullKey = `${key}|${scheme}`;
        let m = markersMap.current.get(id);
        if (m && m.__mcKey === fullKey) { m.position = pos; return; }
        if (m) drop(m);
        ensureMcStyles();
        const wrap = document.createElement("div");
        wrap.innerHTML = html;
        const rootEl = wrap.firstElementChild as HTMLElement;
        if (scheme === "dark") rootEl?.classList.add("mc-dark");
        m = new Adv({ map: mapRef.current, position: pos, content: rootEl, zIndex: p.is_me ? 4 : 3, title: p.name, gmpClickable: true });
        m.__mcKey = fullKey;
        m.addListener?.("click", () => onPersonPress?.(p));
        markersMap.current.set(id, m);
        return;
      }
      upsert(id, pos, personIcon(p, !!p.is_me, street), p.name, p.is_me ? 4 : 3, () => onPersonPress?.(p));
    };
    incidents.forEach((i) => upsert(`inc-${i.id}`, { lat: i.lat, lng: i.lng }, incidentIconG(!!i.road_closed), i.title ?? "", 2, () => onIncidentPress?.(i)));
    located.forEach(upsertPerson);
    pins.forEach((p) => upsert(`pin-${p.id}`, { lat: p.lat, lng: p.lng }, pinIcon(p.color ?? colors.brandPrimary), p.title ?? "", 2, undefined));
    if (selected) upsert("selected", { lat: selected.lat, lng: selected.lng }, pinIcon(colors.brandPrimary), "", 5, undefined);
    markersMap.current.forEach((m, id) => {
      if (!alive.has(id)) { drop(m); markersMap.current.delete(id); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, advLib, token, scheme, JSON.stringify(streets), JSON.stringify(located.map((p) => [p.member_id, p.lat, p.lng, p.color, p.name, p.photo_url])), JSON.stringify(incidents.map((i) => [i.id, i.lat, i.lng])), JSON.stringify(pins.map((p) => [p.id, p.lat, p.lng])), selected?.lat, selected?.lng]);

  // cercas: círculos translúcidos de marca (diff por id; el radio solo cambia al crearla)
  // + etiqueta con el nombre sobre el círculo; las ocupadas pulsan (efecto aparte, abajo)
  useEffect(() => {
    if (!ready || !mapRef.current || !window.google) return;
    const maps = window.google.maps;
    const alive = new Set<string>();
    circles.forEach((c) => {
      alive.add(c.id);
      let cir = circlesMap.current.get(c.id);
      const stroke = c.active === false ? "#9AA0A6" : c.occupied ? "#34A853" : colors.brandPrimary;
      if (!cir) {
        cir = new maps.Circle({ map: mapRef.current, clickable: false });
        circlesMap.current.set(c.id, cir);
      }
      cir.setCenter({ lat: c.lat, lng: c.lng });
      cir.setRadius(c.radius_m);
      cir.setOptions({
        strokeColor: stroke, strokeOpacity: 0.9, strokeWeight: 2,
        fillColor: stroke, fillOpacity: c.occupied ? 0.14 : 0.08,
      });
      // etiqueta: marcador con icono transparente y texto
      let lab = circleLabelsMap.current.get(c.id);
      if (!lab) {
        lab = new maps.Marker({
          map: mapRef.current, clickable: false, zIndex: 2,
          icon: { url: "data:image/gif;base64,R0lGODlhAQABAAAAACw=", anchor: new maps.Point(0, 0) },
        });
        circleLabelsMap.current.set(c.id, lab);
      }
      lab.setPosition({ lat: c.lat, lng: c.lng });
      lab.setLabel({ text: c.title, color: stroke, fontSize: "11px", fontWeight: "700" });
    });
    circlesMap.current.forEach((cir, id) => { if (!alive.has(id)) { cir.setMap(null); circlesMap.current.delete(id); } });
    circleLabelsMap.current.forEach((lab, id) => { if (!alive.has(id)) { lab.setMap(null); circleLabelsMap.current.delete(id); } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, JSON.stringify(circles.map((c) => [c.id, c.lat, c.lng, c.radius_m, c.active, c.occupied]))]);

  // pulso sutil en cercas ocupadas (strokeOpacity oscila; respeta reduced-motion)
  useEffect(() => {
    if (!ready) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
    const t = setInterval(() => {
      pulsePhase.current = (pulsePhase.current + 1) % 4;
      const up = pulsePhase.current < 2;
      circles.forEach((c) => {
        if (!c.occupied) return;
        const cir = circlesMap.current.get(c.id);
        if (cir) cir.setOptions({ strokeOpacity: up ? 0.95 : 0.4, fillOpacity: up ? 0.18 : 0.1, strokeWeight: up ? 3 : 2 });
      });
    }, 650);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, JSON.stringify(circles.map((c) => [c.id, c.occupied]))]);

  // polyline
  useEffect(() => {
    if (!ready || !window.google) return;
    polyRef.current?.setMap(null);
    polyRef.current = null;
    if (polyline && polyline.length > 1) {
      polyRef.current = new window.google.maps.Polyline({ path: polyline.map(([lat, lng]) => ({ lat, lng })), strokeColor: colors.brandPrimary, strokeWeight: 5, strokeOpacity: 0.9, map: mapRef.current });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, JSON.stringify(polyline ?? [])]);

  if (!GKEYS.length) return <StaticMapCanvas {...props} />;

  if (failed) return (
    <View style={{ flex: 1 }} testID="map-failed">
      <StaticMapCanvas {...props} />
      <Pressable testID="map-retry" onPress={retry} style={{ position: "absolute", top: spacing.md, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 8, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 }}>
        <Ionicons name="refresh" size={14} color={colors.brandPrimary} />
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.onSurface }}>Mapa en modo respaldo. Reintentar interactivo</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.mapTint, overflow: "hidden" }} testID="map-canvas">
      <View ref={hostRef} style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }} />
      {!ready ? <View style={{ position: "absolute", left: 0, right: 0, top: "48%", alignItems: "center" }}><Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.muted }}>Cargando mapa…</Text></View> : null}
    </View>
  );
}

// ---------- static fallback (previous renderer, backend-proxied image) ----------

// Anillo de cerca: pulso de opacidad suave cuando está ocupada (alguien del grupo dentro).
function FenceRing({ occupied, stroke, style, children }: { occupied: boolean; stroke: string; style: any; children?: React.ReactNode }) {
  const op = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!occupied) { op.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(op, { toValue: 0.45, duration: 650, useNativeDriver: true }),
        Animated.timing(op, { toValue: 1, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [occupied, op]);
  return (
    <Animated.View pointerEvents="none" style={[style, { opacity: occupied ? op : 1 }]} testID={`fence-ring-${stroke}`}>
      {children}
    </Animated.View>
  );
}
const zoomForS = zoomFor;
function StaticMapCanvas({ people, pins = [], polyline, circles = [], onPersonPress, center, zoomDelta = 0.01, onMapPress, onMapLongPress, selected, incidents = [], onIncidentPress }: MapCanvasProps) {
  const s = useStyles();
  const { colors, scheme } = useTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const located = people.filter((p) => p.state === "shared" && p.lat != null);
  const me = located.find((p) => p.is_me);
  const fallback: LatLng = me ? { lat: me.lat!, lng: me.lng! } : located[0] ? { lat: located[0].lat!, lng: located[0].lng! } : pins[0] ? { lat: pins[0].lat, lng: pins[0].lng } : { lat: 40.4168, lng: -3.7038 };
  const [view, setView] = useState<{ lat: number; lng: number; zoom: number }>({ ...(center ?? fallback), zoom: center ? zoomForS(zoomDelta) : 12 });
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { if (center) setView({ lat: center.lat, lng: center.lng, zoom: zoomForS(zoomDelta) }); }, [center?.lat, center?.lng, center?.key]);
  const [loaded, setLoaded] = useState(false);

  const z = view.zoom, cx = mx(view.lng, z), cy = my(view.lat, z);
  const proj = (lat: number, lng: number) => ({ left: size.w / 2 + (mx(lng, z) - cx), top: size.h / 2 + (my(lat, z) - cy) });
  const unproj = (px: number, py: number): LatLng => ({ lat: uny(cy + (py - size.h / 2), z), lng: unx(cx + (px - size.w / 2), z) });
  const uri = useMemo(() => {
    if (!size.w || !size.h) return null;
    const pinStr = [...pins.map((p) => `${p.lat},${p.lng},${hex(p.color)}`), ...(selected ? [`${selected.lat},${selected.lng},${hex(colors.brandPrimary)}`] : [])].join(";");
    const pathStr = polyline && polyline.length > 1 ? polyline.filter((_, i) => i % Math.max(1, Math.floor(polyline.length / 60)) === 0).concat([polyline[polyline.length - 1]]).map(([a, b]) => `${a},${b}`).join(";") : "";
    return `${BASE}/mobility/static.png?lat=${view.lat}&lng=${view.lng}&zoom=${z}&w=${Math.round(size.w)}&h=${Math.round(size.h)}&dark=${scheme === "dark"}&pins=${encodeURIComponent(pinStr)}&path=${encodeURIComponent(pathStr)}`;
  }, [size.w, size.h, view.lat, view.lng, z, pins, selected, polyline, scheme, colors.brandPrimary]);
  const at = (e: any): LatLng => { const n = e.nativeEvent ?? {}; return unproj(n.offsetX ?? n.locationX ?? size.w / 2, n.offsetY ?? n.locationY ?? size.h / 2); };
  const inView = (lat: number, lng: number) => { const p = proj(lat, lng); return p.left > -30 && p.left < size.w + 30 && p.top > -30 && p.top < size.h + 30; };

  return (
    <Pressable style={s.root} testID="map-canvas" onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      onPress={(e) => onMapPress?.(at(e))} onLongPress={(e) => onMapLongPress?.(at(e))}>
      {uri ? <Image source={{ uri }} style={{ position: "absolute", left: 0, top: 0, width: size.w, height: size.h }} onLoad={() => setLoaded(true)} onError={() => setLoaded(false)} testID="map-static-image" /> : null}
      {!loaded ? <View style={s.loading} pointerEvents="none"><Text style={s.noticeTxt}>Cargando mapa…</Text></View> : null}
      {/* cercas: círculo proyectado (metros → píxeles según zoom) + etiqueta; pulsa si hay alguien dentro */}
      {circles.map((c) => {
        const p = proj(c.lat, c.lng);
        const mpp = (156543.03392 * Math.cos((c.lat * Math.PI) / 180)) / 2 ** z;
        const rpx = c.radius_m / mpp;
        if (p.left + rpx < 0 || p.left - rpx > size.w || p.top + rpx < 0 || p.top - rpx > size.h) return null;
        const stroke = c.active === false ? colors.muted : c.occupied ? colors.success : colors.brandPrimary;
        return (
          <FenceRing key={c.id} occupied={!!c.occupied} stroke={stroke}
            style={[s.abs, { left: p.left - rpx, top: p.top - rpx, width: rpx * 2, height: rpx * 2, borderRadius: rpx, borderWidth: 2, borderColor: stroke, backgroundColor: `${stroke}${c.occupied ? "24" : "14"}` }]}>
            {rpx > 34 ? <Text style={[s.pinTxt, { marginTop: 6 }]}>{c.title}</Text> : null}
          </FenceRing>
        );
      })}
      {incidents.filter((i) => inView(i.lat, i.lng)).map((i) => (
        <Pressable key={i.id} testID={`map-incident-${i.id}`} onPress={() => onIncidentPress?.(i)} style={[s.abs, proj(i.lat, i.lng), { marginLeft: -13, marginTop: -13 }]}>
          <View style={[s.inc, { backgroundColor: i.road_closed ? colors.error : colors.warning }]}><Ionicons name={incidentIcon(i) as any} size={14} color={i.road_closed ? colors.onError : colors.onWarning} /></View>
        </Pressable>
      ))}
      {located.filter((p) => inView(p.lat!, p.lng!)).map((p) => (
        <Pressable key={p.member_id} testID={`map-person-${p.member_id}`} onPress={() => onPersonPress?.(p)} style={[s.abs, proj(p.lat!, p.lng!), { marginLeft: -22, marginTop: -30 }]}>
          <PersonAvatar name={p.name} color={p.color} state="shared" size={p.is_me ? 46 : 40} />
          <Text style={s.pinTxt}>{p.name}</Text>
        </Pressable>
      ))}
      <View style={s.zoom} testID="map-zoom">
        <Pressable testID="map-zoom-in" onPress={() => setView((v) => ({ ...v, zoom: Math.min(19, v.zoom + 1) }))} style={s.zBtn}><Ionicons name="add" size={18} color={colors.onSurface} /></Pressable>
        <Pressable testID="map-zoom-out" onPress={() => setView((v) => ({ ...v, zoom: Math.max(3, v.zoom - 1) }))} style={s.zBtn}><Ionicons name="remove" size={18} color={colors.onSurface} /></Pressable>
      </View>
      <View style={s.notice} pointerEvents="none" testID="map-web-notice"><Ionicons name="map" size={12} color={colors.muted} /><Text style={s.noticeTxt}>Vista estática (respaldo)</Text></View>
    </Pressable>
  );
}

export function MapCanvas(props: MapCanvasProps) {
  if (!GKEY) return <StaticMapCanvas {...props} />;
  return <GoogleMapCanvas {...props} />;
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.mapTint, overflow: "hidden" },
  loading: { position: "absolute", left: 0, right: 0, top: "48%", alignItems: "center" },
  notice: { position: "absolute", bottom: 8, left: spacing.md, flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: c.glass, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border },
  noticeTxt: { fontFamily: fonts.medium, fontSize: 11, color: c.muted },
  abs: { position: "absolute", alignItems: "center" },
  inc: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.glassStrong },
  pinTxt: { fontFamily: fonts.semibold, fontSize: 11, color: c.onSurface, marginTop: -2, backgroundColor: c.glassStrong, paddingHorizontal: 4, borderRadius: 4 },
  zoom: { position: "absolute", left: spacing.md, top: "50%", gap: 6 },
  zBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.glassStrong, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
}));
