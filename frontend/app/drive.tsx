// ============================================================
// DRIVE — active navigation (starts immediately; everything else is optional and floating):
// full-screen map following the user, next instruction + ETA on top, floating tools at the bottom
// (add stop, join group members → shared trip with real ETAs, POIs along the route, sharing control, finish).
// Any open panel closes when the map is tapped. Route re-computes when the user leaves it (>120 m).
// Turn-by-turn voice / lock-screen guidance requires a native build (documented gap).
// ============================================================
import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, ScrollView, TextInput, View } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, unavailableOf } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Incident, INCIDENT_TYPE, incidentIcon, LatLng, MapCanvas, MapPerson } from "@/src/components/MapCanvas";
import { SharingFab, SharingPanel } from "@/src/components/SharingFab";
import { Button, showUnavailable, T, toast } from "@/src/components/ui";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Place = { name: string; lat: number; lng: number };
type Overlay = null | "stop" | "group" | "poi" | "sharing" | "traffic";
const POIS = [["cafe", "Cafeterías", "cafe"], ["fuel", "Gasolineras", "water"], ["ev", "Carga EV", "flash"], ["rest", "Descanso", "bed"], ["parking", "Parkings", "car"]] as const;
const MODE_LABEL: Record<string, string> = { car: "Coche", motorcycle: "Moto", bicycle: "Bici", pedestrian: "A pie" };
const fmtT = (s: number) => (s < 60 ? "<1 min" : s < 3600 ? `${Math.round(s / 60)} min` : `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`);
const fmtD = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);
const dist = (a: LatLng, b: LatLng) => Math.hypot((a.lat - b.lat) * 111000, (a.lng - b.lng) * 111000 * Math.cos((a.lat * Math.PI) / 180));
const stepIcon = (t = "") => (/izquierda/i.test(t) ? "arrow-back" : /derecha/i.test(t) ? "arrow-forward" : /rotonda/i.test(t) ? "sync" : /destino|llegad/i.test(t) ? "flag" : "arrow-up");

export default function Drive() {
  const p = useLocalSearchParams<{ lat: string; lng: string; place?: string; mode?: string; stops?: string; fromLat?: string; fromLng?: string; trip?: string }>();
  const router = useRouter(); const insets = useSafeAreaInsets(); const s = useStyles(); const { colors } = useTheme(); const qc = useQueryClient();
  const { user } = useAuth();
  const dest: Place = { name: p.place ?? "Destino", lat: Number(p.lat), lng: Number(p.lng) };
  const [stops, setStops] = useState<Place[]>(() => { try { return p.stops ? JSON.parse(p.stops) : []; } catch { return []; } });
  const mode = p.mode ?? "car";
  const [pos, setPos] = useState<LatLng | null>(p.fromLat && !Number.isNaN(Number(p.fromLat)) ? { lat: Number(p.fromLat), lng: Number(p.fromLng) } : null);
  const [origin, setOrigin] = useState<LatLng | null>(pos);
  const [perm, setPerm] = useState<"unknown" | "granted" | "denied" | "blocked">("unknown");
  const [follow, setFollow] = useState(true);
  const [tick, setTick] = useState(0);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [tripId, setTripId] = useState<string | null>(p.trip ?? null);
  const [q, setQ] = useState(""); const [typed, setTyped] = useState("");
  const [poiCat, setPoiCat] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [arrived, setArrived] = useState(false);
  const lastReroute = useRef(0);

  // ---- live device position (local; upload to the group happens only through the consent-gated hook on the map) ----
  useEffect(() => { Location.getForegroundPermissionsAsync().then((r) => setPerm(r.granted ? "granted" : r.status === "undetermined" ? "unknown" : r.canAskAgain ? "denied" : "blocked")).catch(() => setPerm("blocked")); }, []);
  useEffect(() => {
    if (perm !== "granted") return;
    let sub: Location.LocationSubscription | null = null;
    Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 8 }, (l) => { const c = { lat: l.coords.latitude, lng: l.coords.longitude }; setPos(c); setOrigin((o) => o ?? c); setTick((t) => t + 1); }).then((x) => { sub = x; }).catch((e) => toast(e.message ?? "Sin acceso a la ubicación", "error"));
    return () => { sub?.remove(); };
  }, [perm]);
  const requestPerm = async () => { const r = await Location.requestForegroundPermissionsAsync(); setPerm(r.granted ? "granted" : r.canAskAgain ? "denied" : "blocked"); };

  // ---- route ----
  const points = useMemo(() => (origin ? [[origin.lat, origin.lng], ...stops.map((st) => [st.lat, st.lng]), [dest.lat, dest.lng]] : null), [origin, stops, dest.lat, dest.lng]);
  const route = useQuery({ queryKey: ["drive-route", points, mode], enabled: !!points, retry: false, queryFn: () => api<any>("/mobility/nav-route", { method: "POST", json: { points, mode } }) });
  useEffect(() => { const u = route.error && unavailableOf(route.error); if (u) showUnavailable(u); }, [route.error]);
  const geom: number[][] = useMemo(() => route.data?.geometry ?? [], [route.data]);
  const cum = useMemo(() => { const out = [0]; for (let i = 1; i < geom.length; i++) out.push(out[i - 1] + dist({ lat: geom[i - 1][0], lng: geom[i - 1][1] }, { lat: geom[i][0], lng: geom[i][1] })); return out; }, [geom]);
  const progress = useMemo(() => {
    if (!pos || geom.length < 2) return null;
    let bi = 0, bd = Infinity;
    for (let i = 0; i < geom.length; i++) { const d = dist(pos, { lat: geom[i][0], lng: geom[i][1] }); if (d < bd) { bd = d; bi = i; } }
    const total = cum[cum.length - 1] || 1, offset = cum[bi];
    const remaining = Math.max(0, total - offset);
    const next = (route.data.steps ?? []).find((st: any) => (st.distance_m ?? 0) > offset + 15) ?? null;
    return { off: bd, offset, remaining, remainingS: (route.data.duration_s ?? 0) * (remaining / total), next, toNext: next ? Math.max(0, next.distance_m - offset) : null };
  }, [pos, geom, cum, route.data]);
  /* eslint-disable react-hooks/set-state-in-effect -- re-route / arrival are derived from external GPS updates */
  useEffect(() => {
    if (!progress || !pos) return;
    if (progress.off > 120 && Date.now() - lastReroute.current > 15000 && !route.isFetching) { lastReroute.current = Date.now(); setOrigin(pos); }
    if (progress.remaining < 40 && !arrived) { setArrived(true); toast(`Has llegado a ${dest.name.split(",")[0]}`, "success"); }
  }, [progress, pos, route.isFetching, arrived, dest.name]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ---- group / trip ----
  const groups = useQuery({ queryKey: ["groups"], queryFn: () => api<any[]>("/groups") });
  const group = groups.data?.[0];
  const trip = useQuery({ queryKey: ["trip", tripId], enabled: !!tripId, refetchInterval: 10000, queryFn: () => api<any>(`/trips/${tripId}`) });
  const positions = useQuery({ queryKey: ["positions", group?.id], enabled: !!group && !!tripId, refetchInterval: 10000, queryFn: () => api<MapPerson[]>(`/groups/${group.id}/positions`) });
  const invite = useMutation({
    mutationFn: async (ids: string[]) => {
      let id = tripId;
      if (!id) { const t = await api<any>("/trips", { method: "POST", json: { group_id: group.id, lat: dest.lat, lng: dest.lng, place_name: dest.name, mode, stops } }); id = t.id; setTripId(id); }
      return api<{ invited: string[] }>(`/trips/${id}/invite`, { method: "POST", json: { user_ids: ids } });
    },
    onSuccess: (r) => { setPicked({}); qc.invalidateQueries({ queryKey: ["trip"] }); toast(r.invited.length ? `${r.invited.length} ${r.invited.length === 1 ? "miembro invitado" : "miembros invitados"} al viaje` : "Ya estaban en el viaje", "success"); },
    onError: (e: any) => toast(e.message, "error"),
  });
  useEffect(() => { if (tripId && trip.data?.is_leader) api(`/trips/${tripId}`, { method: "PATCH", json: { stops } }).catch(() => null); }, [stops, tripId, trip.data?.is_leader]);
  const finish = async () => { if (tripId && trip.data?.is_leader) await api(`/trips/${tripId}/close`, { method: "POST" }).catch(() => null); else if (tripId) await api(`/trips/${tripId}/leave`, { method: "POST" }).catch(() => null); if (router.canGoBack()) router.back(); else router.replace("/map"); };
  const others = (group?.members ?? []).filter((m: any) => m.status === "active" && m.user_id && m.user_id !== user?.id);
  const participants: any[] = trip.data?.participants ?? [];
  const onTrip = new Set(participants.filter((x) => x.status !== "left").map((x) => x.user_id));

  // ---- stops: search / POIs / long-press ----
  useEffect(() => { const t = setTimeout(() => setTyped(q), 300); return () => clearTimeout(t); }, [q]);
  const suggest = useQuery({ queryKey: ["autocomplete", typed, pos?.lat], enabled: overlay === "stop" && typed.length > 1, queryFn: () => api<Place[]>(`/mobility/autocomplete?q=${encodeURIComponent(typed)}${pos ? `&lat=${pos.lat}&lng=${pos.lng}` : ""}`) });
  const pois = useQuery({ queryKey: ["along", geom.length, poiCat], enabled: overlay === "poi" && !!poiCat && geom.length > 1, queryFn: () => api<any[]>("/mobility/along-route", { method: "POST", json: { geometry: geom, category: poiCat } }) });
  const addStop = (st: Place) => { setStops((x) => [...x, { name: st.name, lat: st.lat, lng: st.lng }]); setOverlay(null); setQ(""); setTyped(""); toast(`Parada añadida: ${st.name.split(",")[0]}`, "success"); };
  const longPress = async (c: LatLng) => { try { const r = await api<Place>(`/mobility/reverse?lat=${c.lat}&lng=${c.lng}`); addStop(r); } catch { addStop({ name: `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`, ...c }); } };

  // ---- traffic incidents along the route + weather at destination (Azure) ----
  const bbox = useMemo(() => { if (geom.length < 2) return null; let a = 90, b = 180, c2 = -90, d = -180; for (const [la, ln] of geom) { if (la < a) a = la; if (la > c2) c2 = la; if (ln < b) b = ln; if (ln > d) d = ln; } return { a: a - 0.01, b: b - 0.01, c: c2 + 0.01, d: d + 0.01 }; }, [geom]);
  const incidentsQ = useQuery({ queryKey: ["incidents-route", bbox], enabled: !!bbox, refetchInterval: 120000, retry: false, queryFn: () => api<Incident[]>(`/mobility/incidents?min_lat=${bbox!.a}&min_lng=${bbox!.b}&max_lat=${bbox!.c}&max_lng=${bbox!.d}`) });
  const onRoute = useMemo(() => { const step = Math.max(1, Math.floor(geom.length / 250)); return (incidentsQ.data ?? []).filter((i) => { for (let k = 0; k < geom.length; k += step) if (dist(i, { lat: geom[k][0], lng: geom[k][1] }) < 600) return true; return false; }); }, [incidentsQ.data, geom]);
  const weather = useQuery({ queryKey: ["weather", dest.lat.toFixed(3), dest.lng.toFixed(3)], retry: false, staleTime: 600000, queryFn: () => api<any>(`/mobility/weather?lat=${dest.lat}&lng=${dest.lng}`) });
  const [incSel, setIncSel] = useState<Incident | null>(null);

  const people: MapPerson[] = [
    ...(pos ? [{ member_id: "me-local", user_id: user?.id ?? "me", name: user?.profile?.name || "Tú", color: colors.brandPrimary, state: "shared", lat: pos.lat, lng: pos.lng, is_me: true }] : []),
    ...(positions.data ?? []).filter((x) => !x.is_me && onTrip.has(x.user_id)),
  ];
  const pins = [
    ...stops.map((st, i) => ({ id: `s${i}`, lat: st.lat, lng: st.lng, title: `${i + 1}. ${st.name.split(",")[0]}`, color: colors.warning })),
    { id: "d", lat: dest.lat, lng: dest.lng, title: dest.name.split(",")[0], color: colors.error },
    ...(overlay === "poi" ? (pois.data ?? []).map((x, i) => ({ id: `p${i}`, lat: x.lat, lng: x.lng, title: x.name, color: colors.brandTertiary })) : []),
  ];
  const center = follow && pos ? { ...pos, key: tick } : !pos ? { ...dest, key: 0 } : undefined;
  const toolsBottom = insets.bottom + spacing.md;
  const panelBottom = toolsBottom + 56;
  const remainingS = progress?.remainingS ?? route.data?.duration_s;
  // eslint-disable-next-line react-hooks/purity -- wall-clock arrival time is intentionally recomputed with each progress update
  const arrival = useMemo(() => (remainingS != null ? new Date(Date.now() + remainingS * 1000).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : null), [remainingS]);

  return (
    <View style={s.root} testID="drive-screen">
      <MapCanvas people={people} pins={pins} polyline={geom as any} center={center} zoomDelta={0.006} onMapPress={() => { if (overlay || incSel) { setOverlay(null); setIncSel(null); } }} onMapLongPress={longPress} onUserPan={() => setFollow(false)}
        traffic incidents={onRoute} onIncidentPress={(i) => { setOverlay(null); setIncSel(i); }} />

      {/* Top: next instruction + ETA */}
      <View style={[s.top, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <View style={s.card} testID="drive-top">
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <View style={s.stepIcon}><Ionicons name={arrived ? "flag" : (stepIcon(progress?.next?.text) as any)} size={22} color={colors.onBrandPrimary} /></View>
            <View style={{ flex: 1 }}>
              <T weight="bold" style={{ fontSize: 15 }} numberOfLines={2} testID="drive-instruction">
                {arrived ? `Has llegado a ${dest.name.split(",")[0]}` : !origin ? `Hacia ${dest.name.split(",")[0]}` : route.isLoading ? "Calculando ruta…" : route.isError ? "Ruta no disponible" : progress?.next ? progress.next.text : `Hacia ${dest.name.split(",")[0]}`}
              </T>
              <T style={{ fontSize: 12, color: colors.muted }} testID="drive-eta">
                {!origin ? (perm === "granted" ? "Esperando tu ubicación…" : "Sin ubicación: permite el acceso para guiarte") : route.data ? `${progress?.toNext != null && !arrived ? `en ${fmtD(progress.toNext)} · ` : ""}${fmtT(progress?.remainingS ?? route.data.duration_s)} · ${fmtD(progress?.remaining ?? route.data.distance_m)}${arrival ? ` · llegada ${arrival}` : ""}${route.data.delay_s > 60 ? ` · +${fmtT(route.data.delay_s)} tráfico` : ""}` : " "}
              </T>
            </View>
            <Pressable testID="drive-close" onPress={finish} hitSlop={8} style={s.closeBtn}><Ionicons name="close" size={18} color={colors.onSurface} /></Pressable>
          </View>
          {stops.length || tripId ? <T style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>{MODE_LABEL[mode]}{stops.length ? ` · ${stops.length} ${stops.length === 1 ? "parada" : "paradas"}` : ""}{tripId ? ` · viaje compartido (${participants.filter((x) => x.status === "joined" || x.status === "leader").length})` : ""}</T> : null}
        </View>
        {perm !== "granted" && perm !== "unknown" || (perm === "unknown" && !pos) ? (
          <Animated.View entering={FadeInDown} exiting={FadeOut} style={[s.card, { marginTop: spacing.sm }]} testID="drive-permission">
            <T weight="bold" style={{ fontSize: 13 }}>Ubicación para guiarte</T>
            <T style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>MY CLUSTER necesita tu posición en el dispositivo para seguir la ruta. Solo se comparte con tu grupo si tú lo has activado.</T>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
              {perm === "blocked" ? <Button small testID="drive-open-settings" title="Abrir ajustes" onPress={() => Linking.openSettings().catch(() => null)} /> : <Button small testID="drive-permit" title="Permitir" onPress={requestPerm} />}
            </View>
          </Animated.View>
        ) : null}
      </View>

      {/* Panels */}
      {overlay === "sharing" ? <SharingPanel onClose={() => setOverlay(null)} bottom={panelBottom} /> : null}
      {overlay === "traffic" ? (
        <Animated.View entering={FadeInDown.duration(160)} exiting={FadeOut.duration(120)} style={[s.panel, { bottom: panelBottom }]} testID="panel-traffic">
          <T weight="bold" style={{ fontSize: 14 }}>{incidentsQ.isLoading ? "Buscando incidencias…" : `${onRoute.length} ${onRoute.length === 1 ? "incidencia" : "incidencias"} en tu ruta`}</T>
          {weather.data ? <T style={{ fontSize: 12, color: colors.muted, marginTop: 2 }} testID="drive-weather">Destino: {weather.data.temp_c != null ? `${Math.round(weather.data.temp_c)}°C · ` : ""}{weather.data.phrase}{weather.data.wind_kmh ? ` · viento ${Math.round(weather.data.wind_kmh)} km/h` : ""}</T> : null}
          {(weather.data?.alerts ?? []).slice(0, 1).map((a: any, i: number) => <T key={i} style={{ fontSize: 12, color: colors.warning }} numberOfLines={2}>⚠ {a.title}{a.source ? ` (${a.source})` : ""}</T>)}
          <ScrollView style={{ maxHeight: 190, marginTop: 4 }} showsVerticalScrollIndicator={false}>
            {onRoute.slice(0, 10).map((i) => (
              <Pressable key={i.id} testID={`route-incident-${i.id}`} onPress={() => { setFollow(false); setIncSel(i); setOverlay(null); }} style={s.row}>
                <Ionicons name={incidentIcon(i) as any} size={16} color={i.road_closed ? colors.error : colors.warning} />
                <View style={{ flex: 1 }}><T weight="semibold" style={{ fontSize: 13 }} numberOfLines={1}>{i.title || i.type}</T><T style={{ fontSize: 11, color: colors.muted }} numberOfLines={1}>{INCIDENT_TYPE[i.type ?? ""] ?? i.type}{i.road_closed ? " · vía cortada" : ""}{i.delay_s ? ` · +${Math.round(i.delay_s / 60)} min` : ""}</T></View>
              </Pressable>
            ))}
            {incidentsQ.isSuccess && onRoute.length === 0 ? <T style={{ fontSize: 12, color: colors.muted }}>Ruta despejada: sin incidencias notificadas (Mapbox).</T> : null}
            {incidentsQ.isError ? <T style={{ fontSize: 12, color: colors.error }}>Incidencias no disponibles ahora.</T> : null}
          </ScrollView>
        </Animated.View>
      ) : null}
      {incSel ? (
        <Animated.View entering={FadeInDown.duration(160)} exiting={FadeOut.duration(120)} style={[s.panel, { bottom: panelBottom }]} testID="drive-incident-card">
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Ionicons name={incidentIcon(incSel) as any} size={20} color={incSel.road_closed ? colors.error : colors.warning} />
            <View style={{ flex: 1 }}><T weight="semibold" style={{ fontSize: 13 }} numberOfLines={2}>{incSel.description || incSel.title}</T><T style={{ fontSize: 11, color: colors.muted }}>{INCIDENT_TYPE[incSel.type ?? ""] ?? incSel.type}{incSel.road_closed ? " · vía cortada" : ""}{incSel.delay_s ? ` · retraso ${Math.round(incSel.delay_s / 60)} min` : ""}{pos ? ` · a ${fmtD(dist(pos, incSel))}` : ""}</T></View>
            <Pressable testID="drive-incident-close" onPress={() => setIncSel(null)} hitSlop={8} style={s.closeBtn}><Ionicons name="close" size={16} color={colors.onSurface} /></Pressable>
          </View>
        </Animated.View>
      ) : null}
      {overlay === "stop" ? (
        <Animated.View entering={FadeInDown.duration(160)} exiting={FadeOut.duration(120)} style={[s.panel, { bottom: panelBottom }]} testID="panel-stop">
          <View style={s.search}><Ionicons name="search" size={16} color={colors.muted} /><TextInput testID="stop-search-input" style={s.searchInput} placeholder="Añadir parada: calle, lugar…" placeholderTextColor={colors.muted} value={q} onChangeText={setQ} autoFocus /></View>
          {(suggest.data ?? []).slice(0, 5).map((r, i) => <Pressable key={i} testID={`stop-result-${i}`} onPress={() => addStop(r)} style={s.row}><Ionicons name="add-circle" size={16} color={colors.warning} /><T style={{ fontSize: 13, flex: 1 }} numberOfLines={1}>{r.name}</T></Pressable>)}
          {typed.length < 2 ? <T style={{ fontSize: 11, color: colors.muted, marginTop: 6 }}>También puedes mantener pulsado un punto del mapa para añadirlo como parada.</T> : null}
          {stops.length ? <Pressable testID="stops-clear" onPress={() => setStops([])} style={[s.row, { borderBottomWidth: 0 }]}><Ionicons name="trash" size={16} color={colors.error} /><T style={{ fontSize: 13 }}>Quitar {stops.length} {stops.length === 1 ? "parada" : "paradas"}</T></Pressable> : null}
        </Animated.View>
      ) : null}
      {overlay === "poi" ? (
        <Animated.View entering={FadeInDown.duration(160)} exiting={FadeOut.duration(120)} style={[s.panel, { bottom: panelBottom }]} testID="panel-poi">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ flexGrow: 0 }}>
            {POIS.map(([k, l, ic]) => <Pressable key={k} testID={`poi-${k}`} onPress={() => setPoiCat(poiCat === k ? null : k)} style={[s.chip, poiCat === k && s.chipOn]}><Ionicons name={ic as any} size={14} color={poiCat === k ? colors.onBrandPrimary : colors.onSurface} /><T weight="semibold" style={{ fontSize: 12, color: poiCat === k ? colors.onBrandPrimary : colors.onSurface }}>{l}</T></Pressable>)}
          </ScrollView>
          {!poiCat ? <T style={{ fontSize: 11, color: colors.muted, marginTop: 6 }}>Elige qué buscar a lo largo de tu ruta.</T> : pois.isLoading ? <T style={{ fontSize: 12, color: colors.muted, marginTop: 6 }}>Buscando en ruta…</T> : (pois.data ?? []).length === 0 ? <T style={{ fontSize: 12, color: colors.muted, marginTop: 6 }}>Nada cerca de tu ruta</T> : (pois.data ?? []).slice(0, 5).map((x, i) => <Pressable key={i} testID={`poi-result-${i}`} onPress={() => addStop(x)} style={s.row}><Ionicons name="add-circle" size={16} color={colors.brandTertiary} /><View style={{ flex: 1 }}><T style={{ fontSize: 13 }} numberOfLines={1}>{x.name}</T><T style={{ fontSize: 11, color: colors.muted }}>desvío {fmtT(x.detour_s ?? 0)} · toca para parar aquí</T></View></Pressable>)}
        </Animated.View>
      ) : null}
      {overlay === "group" ? (
        <Animated.View entering={FadeInDown.duration(160)} exiting={FadeOut.duration(120)} style={[s.panel, { bottom: panelBottom }]} testID="panel-group">
          <T weight="bold" style={{ fontSize: 14 }}>{group ? `Viaje con ${group.name}` : "Sin grupo"}</T>
          {!group ? <T style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>Crea un grupo para compartir el viaje.</T> : null}
          {participants.filter((x) => x.user_id !== user?.id).map((x) => (
            <View key={x.user_id} style={s.row} testID={`trip-part-${x.user_id}`}>
              <View style={[s.dotB, { backgroundColor: x.color ?? colors.muted }]} />
              <T weight="semibold" style={{ fontSize: 13, flex: 1 }}>{x.name}</T>
              <T style={{ fontSize: 12, color: x.eta?.state === "ok" ? colors.success : colors.muted }}>{x.status === "invited" ? "Invitado" : x.status === "left" ? "Ha salido" : x.eta?.state === "ok" ? `ETA ${fmtT(x.eta.eta_s)}` : x.eta?.label ?? "—"}</T>
            </View>
          ))}
          {group && (!tripId || trip.data?.is_leader) ? (
            <>
              {others.filter((m: any) => !onTrip.has(m.user_id)).map((m: any) => { const on = !!picked[m.user_id]; return (
                <Pressable key={m.id} testID={`trip-pick-${m.id}`} onPress={() => setPicked((x) => ({ ...x, [m.user_id]: !x[m.user_id] }))} style={s.row}>
                  <View style={[s.check, on && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>{on ? <Ionicons name="checkmark" size={14} color={colors.onBrandPrimary} /> : null}</View>
                  <T style={{ fontSize: 13, flex: 1 }}>{m.display_name}</T>
                </Pressable>); })}
              {others.length === 0 ? <T style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>Aún no hay otros miembros activos en tu grupo.</T> : null}
              {Object.values(picked).some(Boolean) ? <View style={{ marginTop: spacing.sm }}><Button small testID="trip-invite" title="Unir al viaje" icon="person-add" loading={invite.isPending} onPress={() => invite.mutate(Object.keys(picked).filter((k) => picked[k]))} /></View> : null}
            </>
          ) : null}
        </Animated.View>
      ) : null}

      {/* Bottom tools */}
      <View style={[s.tools, { bottom: toolsBottom }]} pointerEvents="box-none">
        <Tool testID="tool-stop" icon="add" label="Parada" on={overlay === "stop"} onPress={() => setOverlay(overlay === "stop" ? null : "stop")} />
        <Tool testID="tool-group" icon="people" label={onTrip.size > 1 ? `Grupo ${onTrip.size}` : "Grupo"} on={overlay === "group"} onPress={() => setOverlay(overlay === "group" ? null : "group")} />
        <Tool testID="tool-poi" icon="cafe" label="En ruta" on={overlay === "poi"} onPress={() => setOverlay(overlay === "poi" ? null : "poi")} />
        <Tool testID="tool-traffic" icon="warning" label={onRoute.length ? `${onRoute.length}` : "Tráfico"} on={overlay === "traffic"} warn={onRoute.some((i) => i.road_closed)} onPress={() => setOverlay(overlay === "traffic" ? null : "traffic")} />
      </View>
      <View style={[s.fabs, { bottom: toolsBottom }]} pointerEvents="box-none">
        <SharingFab open={overlay === "sharing"} onPress={() => setOverlay(overlay === "sharing" ? null : "sharing")} />
        <Pressable testID="drive-follow" onPress={() => { setFollow(true); setTick((t) => t + 1); }} style={[s.fab, follow && s.fabOn]} accessibilityLabel="Seguir mi posición"><Ionicons name="navigate" size={20} color={follow ? colors.onBrandPrimary : colors.onSurface} /></Pressable>
      </View>
    </View>
  );
}

function Tool({ icon, label, onPress, testID, on, warn }: { icon: string; label: string; onPress: () => void; testID: string; on?: boolean; warn?: boolean }) {
  const s = useStyles(); const { colors } = useTheme();
  const fg = on ? colors.onBrandPrimary : warn ? colors.error : colors.onSurface;
  return <Pressable testID={testID} onPress={onPress} style={[s.tool, on && s.fabOn]}><Ionicons name={icon as any} size={16} color={fg} /><T weight="semibold" style={{ fontSize: 12, color: fg }}>{label}</T></Pressable>;
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.mapTint },
  top: { position: "absolute", left: 0, right: 0, paddingHorizontal: spacing.md },
  card: { backgroundColor: c.glassStrong, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.md, shadowColor: c.surfaceInverse, shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  stepIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  panel: { position: "absolute", left: spacing.md, right: spacing.md + 60, backgroundColor: c.glassStrong, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.md, maxHeight: 320, shadowColor: c.surfaceInverse, shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, height: 44, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.sm },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: c.onSurface, height: 42 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 8, borderBottomWidth: 1, borderColor: c.divider },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, height: 32, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border },
  chipOn: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  dotB: { width: 10, height: 10, borderRadius: 5 },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: c.borderStrong, alignItems: "center", justifyContent: "center" },
  tools: { position: "absolute", left: spacing.md, right: spacing.md + 60, flexDirection: "row", gap: spacing.sm },
  tool: { flexDirection: "row", alignItems: "center", gap: 4, height: 44, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: c.glassStrong, borderWidth: 1, borderColor: c.border, shadowColor: c.surfaceInverse, shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  fabs: { position: "absolute", right: spacing.md, alignItems: "flex-end", gap: spacing.sm },
  fab: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.glassStrong, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center", shadowColor: c.surfaceInverse, shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  fabOn: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
}));
