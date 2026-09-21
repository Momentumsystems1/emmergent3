// Web renderer: Google Maps JavaScript API (interactive, MY CLUSTER look) with automatic fallback
// to the backend static image if the browser key is missing/rejected or the API can't load.
// Same props contract as the native canvas (mapTypes.ts) — callers don't change.
import Ionicons from "@react-native-vector-icons/ionicons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";

import { BASE } from "@/src/api";
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

// ---------- Google Maps boot (no dependency: script injection + importLibrary) ----------
declare global { interface Window { google?: any; __mcGmapsPromise?: Promise<any> } }
function loadGmaps(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (window.__mcGmapsPromise) return window.__mcGmapsPromise;
  window.__mcGmapsPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GKEY}&v=weekly&loading=async`;
    s.async = true;
    s.onerror = () => { window.__mcGmapsPromise = undefined; reject(new Error("gmaps script error")); };
    s.onload = () => { window.google?.maps ? resolve(window.google.maps) : reject(new Error("gmaps not present")); };
    document.head.appendChild(s);
    setTimeout(() => { if (!window.google?.maps) { window.__mcGmapsPromise = undefined; reject(new Error("gmaps timeout")); } }, 12000);
  });
  return window.__mcGmapsPromise;
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
function personIcon(p: MapPerson, isMe: boolean): { url: string; scaledSize: any; anchor: any } {
  const color = /^#[0-9a-fA-F]{6}$/.test(p.color) ? p.color : "#D93025";
  const init = esc(initials(p.name));
  const name = esc(p.name.length > 14 ? `${p.name.slice(0, 13)}…` : p.name);
  const svg = isMe
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="30" fill="${color}" opacity="0.16"/><circle cx="32" cy="32" r="19" fill="${color}" opacity="0.32"/><circle cx="32" cy="32" r="10" fill="${color}" stroke="#ffffff" stroke-width="3.5"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="72"><g><circle cx="48" cy="26" r="22" fill="${color}" stroke="#ffffff" stroke-width="3"/><text x="48" y="32" font-family="Arial, sans-serif" font-size="17" font-weight="700" fill="#ffffff" text-anchor="middle">${init}</text></g><rect x="${48 - (name.length * 3.4 + 10)}" y="52" width="${name.length * 6.8 + 20}" height="17" rx="8.5" fill="#ffffff" opacity="0.94"/><text x="48" y="64.5" font-family="Arial, sans-serif" font-size="10.5" font-weight="600" fill="#202124" text-anchor="middle">${name}</text></svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: isMe ? { width: 64, height: 64 } : { width: 96, height: 72 },
    anchor: isMe ? { x: 32, y: 32 } : { x: 48, y: 28 },
  };
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
  const { people, pins = [], polyline, onPersonPress, center, zoomDelta = 0.01, onMapPress, onMapLongPress, onUserPan, selected, traffic, incidents = [], onIncidentPress } = props;
  const { colors, scheme } = useTheme();
  const hostRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polyRef = useRef<any>(null);
  const trafficRef = useRef<any>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  const located = people.filter((p) => p.state === "shared" && p.lat != null);
  const me = located.find((p) => p.is_me);
  const fallback: LatLng = me ? { lat: me.lat!, lng: me.lng! } : located[0] ? { lat: located[0].lat!, lng: located[0].lng! } : pins[0] ? { lat: pins[0].lat, lng: pins[0].lng } : { lat: 40.4168, lng: -3.7038 };

  // boot once
  useEffect(() => {
    let dead = false;
    loadGmaps().then((maps) => {
      if (dead || !hostRef.current) return;
      const c = center ?? fallback;
      const map = new maps.Map(hostRef.current, {
        center: { lat: c.lat, lng: c.lng },
        zoom: center ? Math.min(19, zoomFor(zoomDelta) + 1) : 12,
        disableDefaultUI: true,
        gestureHandling: "greedy",
        clickableIcons: false,
        styles: scheme === "dark" ? DARK_STYLE : undefined,
        backgroundColor: colors.mapTint,
      });
      map.addListener("click", (e: any) => onMapPress?.({ lat: e.latLng.lat(), lng: e.latLng.lng() }));
      map.addListener("dragstart", () => onUserPan?.());
      // long-press emulation (web has no native long-press)
      let lpTimer: any = null;
      map.addListener("mousedown", (e: any) => { lpTimer = setTimeout(() => onMapLongPress?.({ lat: e.latLng.lat(), lng: e.latLng.lng() }), 550); });
      ["mouseup", "dragstart"].forEach((ev) => map.addListener(ev, () => clearTimeout(lpTimer)));
      trafficRef.current = new maps.TrafficLayer();
      mapRef.current = map;
      setReady(true);
    }).catch(() => setFailed(true));
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // style follow (theme switch without rebuild)
  useEffect(() => { if (ready && mapRef.current) mapRef.current.setOptions({ styles: scheme === "dark" ? DARK_STYLE : undefined }); }, [ready, scheme]);
  // camera follow
  useEffect(() => {
    if (!ready || !center || !mapRef.current) return;
    mapRef.current.panTo({ lat: center.lat, lng: center.lng });
    mapRef.current.setZoom(Math.min(19, zoomFor(zoomDelta) + 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, center?.lat, center?.lng, center?.key]);
  // traffic layer
  useEffect(() => { if (ready && trafficRef.current) trafficRef.current.setMap(traffic ? mapRef.current : null); }, [ready, traffic]);

  // markers redraw (simple + robust: data volumes are tiny in a family map)
  useEffect(() => {
    if (!ready || !mapRef.current || !window.google) return;
    const maps = window.google.maps;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    incidents.forEach((i) => {
      const mk = new maps.Marker({ position: { lat: i.lat, lng: i.lng }, map: mapRef.current, icon: incidentIconG(!!i.road_closed), title: i.title ?? "", zIndex: 2 });
      mk.addListener("click", () => onIncidentPress?.(i));
      markersRef.current.push(mk);
    });
    located.forEach((p) => {
      const mk = new maps.Marker({ position: { lat: p.lat!, lng: p.lng! }, map: mapRef.current, icon: personIcon(p, !!p.is_me), title: p.name, zIndex: p.is_me ? 4 : 3 });
      (mk as any).gmTestId = `map-person-${p.member_id}`;
      mk.addListener("click", () => onPersonPress?.(p));
      markersRef.current.push(mk);
    });
    pins.forEach((p) => {
      markersRef.current.push(new maps.Marker({ position: { lat: p.lat, lng: p.lng }, map: mapRef.current, icon: pinIcon(p.color ?? colors.brandPrimary), title: p.title, zIndex: 2 }));
    });
    if (selected) {
      markersRef.current.push(new maps.Marker({ position: { lat: selected.lat, lng: selected.lng }, map: mapRef.current, icon: pinIcon(colors.brandPrimary), zIndex: 5 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, JSON.stringify(located.map((p) => [p.member_id, p.lat, p.lng, p.color, p.name])), JSON.stringify(incidents.map((i) => [i.id, i.lat, i.lng])), JSON.stringify(pins.map((p) => [p.id, p.lat, p.lng])), selected?.lat, selected?.lng, scheme]);

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

  if (failed) return <StaticMapCanvas {...props} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.mapTint, overflow: "hidden" }} testID="map-canvas">
      <View ref={hostRef} style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }} />
      {!ready ? <View style={{ position: "absolute", left: 0, right: 0, top: "48%", alignItems: "center" }}><Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.muted }}>Cargando mapa…</Text></View> : null}
    </View>
  );
}

// ---------- static fallback (previous renderer, backend-proxied image) ----------
const zoomForS = zoomFor;
function StaticMapCanvas({ people, pins = [], polyline, onPersonPress, center, zoomDelta = 0.01, onMapPress, onMapLongPress, selected, incidents = [], onIncidentPress }: MapCanvasProps) {
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
