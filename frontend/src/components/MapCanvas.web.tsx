// Web renderer: react-native-maps has no web build, so we render a REAL Azure Maps static image (proxied by the backend)
// and project people / incidents on top with Web-Mercator math. Tap → coordinate (so point selection works on web too).
// Zoom buttons; no panning (static image). Traffic flow tiles are native-only (static API renders one tileset).
import Ionicons from "@react-native-vector-icons/ionicons";
import React, { useEffect, useMemo, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";

import { BASE } from "@/src/api";
import { incidentIcon, LatLng, MapCanvasProps } from "@/src/components/mapTypes";
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

export function MapCanvas({ people, pins = [], polyline, onPersonPress, center, zoomDelta = 0.01, onMapPress, onMapLongPress, selected, incidents = [], onIncidentPress }: MapCanvasProps) {
  const s = useStyles();
  const { colors, scheme } = useTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const located = people.filter((p) => p.state === "shared" && p.lat != null);
  const me = located.find((p) => p.is_me);
  const fallback: LatLng = me ? { lat: me.lat!, lng: me.lng! } : located[0] ? { lat: located[0].lat!, lng: located[0].lng! } : pins[0] ? { lat: pins[0].lat, lng: pins[0].lng } : { lat: 40.4168, lng: -3.7038 };
  const [view, setView] = useState<{ lat: number; lng: number; zoom: number }>({ ...(center ?? fallback), zoom: center ? zoomFor(zoomDelta) : 12 });
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- camera follows the caller's center like animateToRegion on native
  useEffect(() => { if (center) setView({ lat: center.lat, lng: center.lng, zoom: zoomFor(zoomDelta) }); }, [center?.lat, center?.lng, center?.key]);
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
      {!loaded ? <View style={s.loading} pointerEvents="none"><Text style={s.noticeTxt}>Cargando mapa Azure…</Text></View> : null}
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
      <View style={s.notice} pointerEvents="none" testID="map-web-notice"><Ionicons name="map" size={12} color={colors.muted} /><Text style={s.noticeTxt}>Azure Maps · vista estática (web)</Text></View>
    </Pressable>
  );
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
