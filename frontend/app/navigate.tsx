// ============================================================
// NAVIGATION — search (history nearest-first → autocomplete), house-number prompt, multi-mode route with flag,
// named stops, POIs along route, people of your group on the route, step list. Anti-congestion embedded (plan gated).
// Real data only (Azure Maps). Turn-by-turn voice guidance: not in this build (documented gap).
// ============================================================
import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, unavailableOf } from "@/src/api";
import { MapCanvas, MapPerson } from "@/src/components/MapCanvas";
import { Button, Header, Pill, showUnavailable, T, toast } from "@/src/components/ui";
import { useLocationSharing } from "@/src/hooks/useLocationSharing";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Place = { name: string; lat: number; lng: number; has_number?: boolean; street?: string; distance_m?: number };
type Stop = Place & { label: string };
const MODES = [["car", "Coche", "car"], ["motorcycle", "Moto", "bicycle"], ["bicycle", "Bici", "bicycle"], ["pedestrian", "A pie", "walk"]] as const;
const POIS = [["cafe", "Cafeterías", "cafe"], ["ev", "Carga EV", "flash"], ["fuel", "Gasolineras", "water"], ["rest", "Áreas descanso", "bed"], ["parking", "Parkings", "car"]] as const;
const fmt = (s: number) => (s < 3600 ? `${Math.round(s / 60)} min` : `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`);
const km = (m: number) => `${(m / 1000).toFixed(1)} km`;
function distToPolyline(lat: number, lng: number, geom: number[][]) {
  let best = Infinity;
  for (let i = 0; i < geom.length; i += Math.max(1, Math.floor(geom.length / 200))) { const d = Math.hypot((geom[i][0] - lat) * 111000, (geom[i][1] - lng) * 111000 * Math.cos((lat * Math.PI) / 180)); if (d < best) best = d; }
  return best;
}

export default function Navigate() {
  const params = useLocalSearchParams<{ lat?: string; lng?: string; place?: string; fromLat?: string; fromLng?: string; anti?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const loc = useLocationSharing(false);
  const [origin, setOrigin] = useState<Place | null>(params.fromLat && !Number.isNaN(Number(params.fromLat)) ? { name: "Mi ubicación", lat: Number(params.fromLat), lng: Number(params.fromLng) } : null);
  const [dest, setDest] = useState<Place | null>(params.lat ? { name: params.place ?? "Destino", lat: Number(params.lat), lng: Number(params.lng), has_number: true } : null);
  const [q, setQ] = useState(""); const [typed, setTyped] = useState("");
  const [askNumber, setAskNumber] = useState<Place | null>(null); const [number, setNumber] = useState("");
  const [mode, setMode] = useState<string>("car");
  const [stops, setStops] = useState<Stop[]>([]); const [addingStop, setAddingStop] = useState(false); const [stopLabel, setStopLabel] = useState("");
  const [poiCat, setPoiCat] = useState<string | null>(null);

  useEffect(() => { const t = setTimeout(() => setTyped(q), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => { if (!origin && loc.perm === "granted") import("expo-location").then((L) => L.getCurrentPositionAsync({}).then((p) => setOrigin({ name: "Mi ubicación", lat: p.coords.latitude, lng: p.coords.longitude })).catch(() => null)); }, [loc.perm, origin]);

  const history = useQuery({ queryKey: ["nav-history", origin?.lat], queryFn: () => api<Place[]>(`/mobility/history${origin ? `?lat=${origin.lat}&lng=${origin.lng}` : ""}`) });
  const suggest = useQuery({ queryKey: ["autocomplete", typed, origin?.lat], enabled: typed.length > 1, queryFn: () => api<Place[]>(`/mobility/autocomplete?q=${encodeURIComponent(typed)}${origin ? `&lat=${origin.lat}&lng=${origin.lng}` : ""}`) });
  const groups = useQuery({ queryKey: ["groups"], queryFn: () => api<any[]>("/groups") });
  const gid = groups.data?.[0]?.id;
  const positions = useQuery({ queryKey: ["positions", gid], enabled: !!gid, queryFn: () => api<MapPerson[]>(`/groups/${gid}/positions`) });

  const points = useMemo(() => (origin && dest ? [[origin.lat, origin.lng], ...stops.map((st) => [st.lat, st.lng]), [dest.lat, dest.lng]] : null), [origin, dest, stops]);
  const route = useQuery({ queryKey: ["nav-route", points, mode], enabled: !!points, queryFn: () => api<any>("/mobility/nav-route", { method: "POST", json: { points, mode } }), retry: false });
  const pois = useQuery({ queryKey: ["along", route.data?.geometry?.length, poiCat], enabled: !!route.data && !!poiCat, queryFn: () => api<any[]>("/mobility/along-route", { method: "POST", json: { geometry: route.data.geometry, category: poiCat } }) });
  const anti = useMutation({
    mutationFn: () => api<any>(`/mobility/anti-congestion?from_lat=${origin!.lat}&from_lng=${origin!.lng}&to_lat=${dest!.lat}&to_lng=${dest!.lng}`),
    onError: (e) => { const u = unavailableOf(e); if (u) showUnavailable(u); else toast((e as any).message, "error"); },
  });
  useEffect(() => { const u = route.error && unavailableOf(route.error); if (u) showUnavailable(u); }, [route.error]);

  const choose = (p: Place, asStop = false) => {
    if (!p.has_number && p.street && !asStop) { setAskNumber(p); return; }
    if (asStop) { setStops([...stops, { ...p, label: stopLabel.trim() || p.name.split(",")[0] }]); setAddingStop(false); setStopLabel(""); }
    else { setDest(p); api("/mobility/history", { method: "POST", json: { name: p.name, lat: p.lat, lng: p.lng } }).catch(() => null); }
    setQ(""); setTyped("");
  };
  const confirmNumber = async () => {
    if (!askNumber) return;
    try { const r = await api<Place[]>(`/mobility/autocomplete?q=${encodeURIComponent(`${askNumber.street} ${number}, ${(askNumber as any).municipality ?? ""}`)}`); const hit = r.find((x) => x.has_number) ?? { ...askNumber, name: `${askNumber.street} ${number}`, has_number: true }; setAskNumber(null); setNumber(""); choose(hit, addingStop); }
    catch (e: any) { toast(e.message, "error"); }
  };
  const peopleOnRoute = (positions.data ?? []).filter((p) => p.state === "shared" && !p.is_me && route.data && distToPolyline(p.lat!, p.lng!, route.data.geometry) < 500);
  const searching = !dest || addingStop;
  const list = typed.length > 1 ? suggest.data ?? [] : history.data ?? [];

  return (
    <View style={s.root} testID="navigate-screen">
      <Header title={addingStop ? "Añadir parada" : dest ? "Ruta" : "¿A dónde vamos?"} onBack={() => (addingStop ? setAddingStop(false) : dest ? setDest(null) : router.back())} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        {searching ? (
          <View style={{ flex: 1, paddingHorizontal: spacing.lg }}>
            {addingStop ? <TextInput testID="stop-label-input" style={s.input} placeholder="Nombre de la parada (ej. Recoger a Marta)" placeholderTextColor={colors.muted} value={stopLabel} onChangeText={setStopLabel} /> : null}
            <View style={s.searchBox}><Ionicons name="search" size={18} color={colors.muted} /><TextInput testID="navigate-search-input" style={s.searchInput} placeholder="Calle, número, lugar…" placeholderTextColor={colors.muted} value={q} onChangeText={setQ} autoFocus /></View>
            {!origin ? <T style={{ fontSize: 12, color: colors.muted, marginTop: 6 }}>Sin tu ubicación no puedo ordenar por cercanía ni trazar la ruta. Activa “Ubicación exacta” en Privacidad y permite el acceso.</T> : null}
            <T style={s.section}>{typed.length > 1 ? "Propuestas" : "Últimos destinos (más cercanos primero)"}</T>
            <ScrollView keyboardShouldPersistTaps="handled">
              {suggest.isLoading ? <T style={{ color: colors.muted }}>Buscando…</T> : null}
              {list.length === 0 && !suggest.isLoading ? <T style={{ color: colors.muted, fontSize: 13 }}>{typed.length > 1 ? "Sin coincidencias" : "Aún no hay destinos guardados"}</T> : null}
              {list.map((p, i) => (
                <Pressable key={i} testID={`nav-result-${i}`} onPress={() => choose(p, addingStop)} style={s.row}>
                  <Ionicons name={typed.length > 1 ? "location" : "time"} size={18} color={colors.brandSecondary} />
                  <View style={{ flex: 1 }}><T weight="semibold" style={{ fontSize: 14 }} numberOfLines={1}>{p.name}</T>{p.distance_m != null ? <T style={{ fontSize: 11, color: colors.muted }}>{km(p.distance_m)}{!p.has_number && p.street ? " · pediremos el número" : ""}</T> : null}</View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <View style={{ height: "38%" }}>
              <MapCanvas people={peopleOnRoute} polyline={route.data?.geometry} center={dest ?? undefined}
                pins={[...(origin ? [{ id: "o", lat: origin.lat, lng: origin.lng, title: "Inicio", color: colors.success }] : []), ...stops.map((st, i) => ({ id: `s${i}`, lat: st.lat, lng: st.lng, title: st.label, color: colors.warning })), { id: "d", lat: dest!.lat, lng: dest!.lng, title: `🏁 ${dest!.name.split(",")[0]}`, color: colors.error }, ...(pois.data ?? []).map((p, i) => ({ id: `p${i}`, lat: p.lat, lng: p.lng, title: p.name, color: colors.brandTertiary }))]} />
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}>
              <View style={s.card} testID="route-summary">
                <T weight="bold" numberOfLines={1}>🏁 {dest!.name}</T>
                {route.isLoading ? <T style={{ color: colors.muted }}>Calculando ruta…</T> : route.data ? <T style={{ color: colors.muted, fontSize: 13 }}>{fmt(route.data.duration_s)} · {km(route.data.distance_m)} · retraso tráfico {fmt(route.data.delay_s)} · llegada {route.data.arrival ? new Date(route.data.arrival).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "—"}</T> : <T style={{ color: colors.error, fontSize: 13 }}>{origin ? "Ruta no disponible para este modo" : "Falta tu ubicación de origen"}</T>}
                <View style={{ marginTop: spacing.sm }}>
                  <Button testID="nav-go" title="Ir" icon="navigate" onPress={() => router.push({ pathname: "/drive", params: { lat: String(dest!.lat), lng: String(dest!.lng), place: dest!.name, mode, stops: JSON.stringify(stops.map((st) => ({ name: st.label, lat: st.lat, lng: st.lng }))), ...(origin ? { fromLat: String(origin.lat), fromLng: String(origin.lng) } : {}) } })} />
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ height: 44, flexGrow: 0 }}>
                {MODES.map(([k, l, ic]) => <Pressable key={k} testID={`mode-${k}`} onPress={() => setMode(k)} style={[s.chip, mode === k && s.chipOn]}><Ionicons name={ic as any} size={14} color={mode === k ? colors.onBrandPrimary : colors.onSurface} /><T weight="semibold" style={{ fontSize: 13, color: mode === k ? colors.onBrandPrimary : colors.onSurface }}>{l}</T></Pressable>)}
                <Pressable testID="mode-transit" onPress={() => showUnavailable({ code: "SERVICE_NOT_CONFIGURED", title: "SERVICIO NO CONFIGURADO", reason: "Transporte público no disponible en el proveedor actual (Mapbox). Requiere integración GTFS de operadores." })} style={[s.chip, { opacity: 0.6 }]}><Ionicons name="train" size={14} color={colors.muted} /><T style={{ fontSize: 13, color: colors.muted }}>Transporte público</T></Pressable>
              </ScrollView>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {stops.map((st, i) => <Pill key={i} label={`${i + 1}. ${st.label}`} tone="amber" testID={`stop-${i}`} />)}
                <Pressable testID="add-stop" onPress={() => setAddingStop(true)} style={s.chip}><Ionicons name="add" size={14} color={colors.onSurface} /><T weight="semibold" style={{ fontSize: 13 }}>Parada</T></Pressable>
                {stops.length ? <Pressable testID="clear-stops" onPress={() => setStops([])} style={s.chip}><T style={{ fontSize: 13 }}>Quitar paradas</T></Pressable> : null}
              </View>
              <T style={s.section}>En ruta</T>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ height: 44, flexGrow: 0 }}>
                {POIS.map(([k, l, ic]) => <Pressable key={k} testID={`poi-${k}`} onPress={() => setPoiCat(poiCat === k ? null : k)} style={[s.chip, poiCat === k && s.chipOn]}><Ionicons name={ic as any} size={14} color={poiCat === k ? colors.onBrandPrimary : colors.onSurface} /><T weight="semibold" style={{ fontSize: 13, color: poiCat === k ? colors.onBrandPrimary : colors.onSurface }}>{l}</T></Pressable>)}
              </ScrollView>
              {poiCat ? (pois.isLoading ? <T style={{ color: colors.muted }}>Buscando en ruta…</T> : (pois.data ?? []).slice(0, 6).map((p, i) => <Pressable key={i} testID={`poi-result-${i}`} onPress={() => { setStops([...stops, { ...p, label: p.name }]); }} style={s.row}><Ionicons name="add-circle" size={18} color={colors.brandTertiary} /><View style={{ flex: 1 }}><T style={{ fontSize: 14 }} numberOfLines={1}>{p.name}</T><T style={{ fontSize: 11, color: colors.muted }}>desvío {fmt(p.detour_s ?? 0)} · toca para añadir como parada</T></View></Pressable>)) : null}
              <T style={s.section}>Personas de tu grupo en la ruta</T>
              {peopleOnRoute.length === 0 ? <T style={{ color: colors.muted, fontSize: 13 }}>Nadie con ubicación compartida a menos de 500 m de tu ruta</T> : peopleOnRoute.map((p) => <View key={p.member_id} style={s.row} testID={`person-on-route-${p.member_id}`}><View style={[s.dot, { backgroundColor: p.color }]} /><T style={{ fontSize: 14 }}>{p.name}</T></View>)}
              <Button testID="anti-evaluate" title="Evaluar anti-congestión (salir ahora / descansar / alternativa)" variant="secondary" icon="trending-down" loading={anti.isPending} onPress={() => anti.mutate()} disabled={!origin} />
              {anti.data ? <View style={s.card} testID="anti-results">{anti.data.recommendations.map((r: any, i: number) => <T key={i} style={{ fontSize: 13 }}>• <T weight="bold">{r.strategy}</T>: {r.why}</T>)}{anti.data.unavailable.map((u: any) => <T key={u.strategy} style={{ fontSize: 12, color: colors.muted }}>• {u.strategy}: SERVICIO NO CONFIGURADO</T>)}</View> : null}
              {route.data?.steps?.length ? (<><T style={s.section}>Indicaciones ({route.data.steps.length})</T>{route.data.steps.map((st: any, i: number) => <View key={i} style={s.row} testID={`step-${i}`}><T style={{ fontSize: 12, color: colors.muted, width: 56 }}>{km(st.distance_m ?? 0)}</T><T style={{ fontSize: 13, flex: 1 }}>{st.text}</T></View>)}<T style={{ fontSize: 11, color: colors.muted }}>Guiado por voz y avisos con pantalla bloqueada: requieren build nativa (no disponible en esta versión).</T></>) : null}
            </ScrollView>
          </View>
        )}
      </KeyboardAvoidingView>
      <Modal visible={!!askNumber} transparent animationType="fade" onRequestClose={() => setAskNumber(null)}>
        <View style={s.modalBg}><View style={s.modal} testID="number-popup">
          <T weight="bold" style={{ fontSize: 16 }}>¿Qué número?</T><T style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>{askNumber?.street}</T>
          <TextInput testID="number-input" style={s.input} keyboardType="number-pad" placeholder="Número" placeholderTextColor={colors.muted} value={number} onChangeText={setNumber} autoFocus />
          <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.md }}><Button small testID="number-skip" title="Sin número" variant="ghost" onPress={() => { const p = askNumber!; setAskNumber(null); choose({ ...p, has_number: true }, addingStop); }} /><Button small testID="number-go" title="Ir" onPress={confirmNumber} disabled={!number.trim()} /></View>
        </View></View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, height: 52, borderRadius: radius.lg, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: c.onSurface, height: 50 },
  input: { height: 50, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.md, fontFamily: fonts.regular, fontSize: 15, color: c.onSurface, marginBottom: spacing.sm },
  section: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.8, color: c.muted, marginTop: spacing.md, marginBottom: 6, textTransform: "uppercase" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 10, borderBottomWidth: 1, borderColor: c.divider },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: c.border, gap: 4 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border, flexShrink: 0 },
  chipOn: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  dot: { width: 10, height: 10, borderRadius: 5 },
  modalBg: { flex: 1, backgroundColor: c.overlay, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  modal: { width: "100%", backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg },
}));
