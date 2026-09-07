// ============================================================
// MAP — HOME (Life360 / Google Maps style). Visual priority: the map + the compact navigator bar.
// - Compact top pill: greeting → "¿A dónde vamos?" after a few seconds; group + profile shortcuts inside the pill.
// - User centered with navigator-like zoom; recenter FAB; compact tools FAB (menu disappears when the map is tapped).
// - Tap / long-press on the map selects a point → reverse geocoding + tools (go, meet, convoy).
// - No panel ever covers the map; location upload only with effective consent.
// ============================================================
import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { LatLng, MapCanvas, MapPerson } from "@/src/components/MapCanvas";
import { Button, Glass, T, toast } from "@/src/components/ui";
import { useLocationSharing } from "@/src/hooks/useLocationSharing";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";

const distM = (a: LatLng, b: LatLng) => { const R = 6371000, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180; const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

export default function MapHome() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const [greet, setGreet] = useState(true);
  const [menu, setMenu] = useState(false);
  const [locBanner, setLocBanner] = useState(false);
  const [sel, setSel] = useState<LatLng | null>(null);
  const [myPos, setMyPos] = useState<LatLng | null>(null);
  const [focus, setFocus] = useState<(LatLng & { key: number }) | undefined>();

  const groups = useQuery({ queryKey: ["groups"], queryFn: () => api<any[]>("/groups"), refetchInterval: 15000 });
  const group = groups.data?.[0];
  const perms = useQuery({ queryKey: ["permissions"], queryFn: () => api<Record<string, any>>("/permissions") });
  const positions = useQuery({ queryKey: ["positions", group?.id], enabled: !!group, refetchInterval: 10000, queryFn: () => api<MapPerson[]>(`/groups/${group.id}/positions`) });
  const sharesLocation = !!perms.data && Object.values(perms.data).some((v: any) => v.effective && (v.key === "exact_location" || v.key === "approx_location"));
  const loc = useLocationSharing(sharesLocation);
  const reverse = useQuery({ queryKey: ["reverse", sel?.lat, sel?.lng], enabled: !!sel, retry: false, queryFn: () => api<{ name: string }>(`/mobility/reverse?lat=${sel!.lat}&lng=${sel!.lng}`) });

  useEffect(() => { const t = setTimeout(() => setGreet(false), 4000); return () => clearTimeout(t); }, []);
  useEffect(() => { storage.getItem<string | null>("sentinel.pending_invite", null).then((t) => { if (t) router.push(`/invite/${t}`); }); }, [router]);
  useEffect(() => { if (sharesLocation && loc.perm !== "granted") setLocBanner(true); }, [sharesLocation, loc.perm]);
  useEffect(() => { if (loc.lastSentAt) qc.invalidateQueries({ queryKey: ["positions"] }); }, [loc.lastSentAt, qc]);
  // Device position (stays on the device unless a location permission is effective) → centering + navigation origin.
  useEffect(() => {
    if (loc.perm !== "granted") return;
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then((p) => setMyPos({ lat: p.coords.latitude, lng: p.coords.longitude })).catch(() => null);
  }, [loc.perm]);

  const served = positions.data ?? [];
  const meServed = served.find((p) => p.is_me && p.state === "shared" && p.lat != null);
  const name = user?.profile?.name ?? "";
  const mePos: LatLng | null = meServed ? { lat: meServed.lat!, lng: meServed.lng! } : myPos;
  const people: MapPerson[] = meServed || !mePos
    ? served
    : [...served.filter((p) => !p.is_me), { member_id: "me-local", user_id: user?.id ?? "me", name: name || "Tú", color: colors.brandPrimary, state: "shared", lat: mePos.lat, lng: mePos.lng, is_me: true }];
  // First fix → center once with navigator zoom; afterwards only the recenter FAB moves the camera.
  useEffect(() => { if (mePos && !focus) setFocus({ lat: mePos.lat, lng: mePos.lng, key: 1 }); }, [mePos?.lat, mePos?.lng, focus]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeAll = () => { setMenu(false); setSel(null); };
  const onMapPress = (c?: LatLng) => { if (menu || sel || (locBanner && loc.perm !== "granted")) { closeAll(); setLocBanner(false); return; } if (c) setSel(c); };
  const recenter = () => { if (!mePos) { toast(loc.perm === "granted" ? "Obteniendo tu ubicación…" : "Permite la ubicación para centrarte"); if (loc.perm !== "granted") setLocBanner(true); return; } setFocus({ ...mePos, key: (focus?.key ?? 0) + 1 }); };
  const checkIn = async () => {
    if (!group) return toast("Crea un grupo primero");
    try { await api("/events", { method: "POST", json: { group_id: group.id, kind: "checkin", severity: "info", message: "¿Todo bien?" } }); toast("Pregunta enviada a tu grupo", "success"); } catch (e: any) { toast(e.message, "error"); }
  };
  const originParams = mePos ? { fromLat: String(mePos.lat), fromLng: String(mePos.lng) } : {};
  const selName = reverse.data?.name ?? (sel ? `${sel.lat.toFixed(5)}, ${sel.lng.toFixed(5)}` : "");
  const pendingCount = group?.stats?.pending ?? 0;

  return (
    <View style={s.root} testID="map-home">
      <MapCanvas people={people} center={focus} selected={sel} onMapPress={onMapPress} onMapLongPress={(c) => { setMenu(false); setSel(c); }}
        onPersonPress={(p) => { closeAll(); if (p.member_id === "me-local") router.push("/profile"); else router.push(`/person/${p.member_id}?group=${group?.id}`); }} />

      {/* Compact navigator pill */}
      <View style={[s.top, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <View style={s.bar} testID="search-bar">
          <Pressable testID="search-bar-input" onPress={() => { closeAll(); router.push({ pathname: "/navigate", params: originParams }); }} style={s.barLeft}>
            <Ionicons name="search" size={18} color={colors.brandPrimary} />
            {greet ? (
              <Animated.View key="greet" exiting={FadeOut} style={{ flex: 1 }}><T weight="semibold" style={s.barTxt} numberOfLines={1} testID="bar-greeting">Hola {name || "👋"}</T></Animated.View>
            ) : (
              <Animated.View key="ask" entering={FadeIn} style={{ flex: 1 }}><T weight="semibold" style={s.barTxt} numberOfLines={1} testID="bar-prompt">¿A dónde vamos?</T></Animated.View>
            )}
          </Pressable>
          <Pressable testID="search-bar-group" onPress={() => { closeAll(); router.push(group ? `/group/${group.id}` : "/onboarding/group"); }} style={s.barIcon} accessibilityLabel="Grupo">
            <Ionicons name="people" size={18} color={colors.onSurface} />
            {pendingCount ? <View style={s.badge}><T weight="bold" style={{ fontSize: 9, color: colors.onPending }}>{pendingCount}</T></View> : null}
          </Pressable>
          <Pressable testID="profile-shortcut" onPress={() => { closeAll(); router.push("/profile"); }} style={[s.barIcon, s.avatar]} accessibilityLabel="Perfil">
            <T weight="bold" style={{ fontSize: 13, color: colors.onBrandPrimary }}>{(name || "?").charAt(0).toUpperCase()}</T>
          </Pressable>
        </View>
        {locBanner && sharesLocation && loc.perm !== "granted" ? (
          <Animated.View entering={FadeInDown} exiting={FadeOut} style={{ marginTop: spacing.sm }}>
            <Glass style={{ padding: spacing.md }} testID="location-permission-banner">
              <T weight="bold" style={{ fontSize: 13 }}>Permiso de ubicación del dispositivo</T>
              <T style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>Compartes tu ubicación con tu grupo; Sentinel necesita el permiso del sistema (solo con la app abierta).</T>
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                {loc.perm === "blocked" ? <Button small testID="location-open-settings" title="Abrir ajustes" onPress={loc.openSettings} /> : <Button small testID="location-request" title="Permitir" onPress={async () => { const ok = await loc.request(); if (!ok) toast("Sin permiso, tu grupo verá “Ubicación no compartida”"); }} />}
                <Button small testID="location-later" title="Ahora no" variant="ghost" onPress={() => setLocBanner(false)} />
              </View>
            </Glass>
          </Animated.View>
        ) : null}
      </View>

      {/* Right-side FABs: recenter + tools */}
      <View style={[s.fabs, { bottom: insets.bottom + spacing.lg }]} pointerEvents="box-none">
        {menu ? (
          <Animated.View entering={FadeInUp.duration(160)} exiting={FadeOut.duration(120)} style={s.menu} testID="tools-menu">
            <MenuItem testID="qa-meeting" icon="calendar" label="Quedar" onPress={() => { setMenu(false); if (group) router.push({ pathname: "/meeting/new", params: { group: group.id } }); else toast("Crea un grupo primero"); }} />
            <MenuItem testID="qa-convoy" icon="car-sport" label="Convoy" onPress={() => { setMenu(false); if (group) router.push({ pathname: "/convoy/new", params: { group: group.id } }); else toast("Crea un grupo primero"); }} />
            <MenuItem testID="qa-checkin" icon="help-circle" label="¿Todo bien?" onPress={() => { setMenu(false); checkIn(); }} />
            <MenuItem testID="qa-anti" icon="trending-down" label="Anti-congestión" onPress={() => { setMenu(false); router.push({ pathname: "/navigate", params: { ...originParams, anti: "1" } }); }} />
            <MenuItem testID="qa-activity" icon="list" label="Actividad" onPress={() => { setMenu(false); if (group) router.push(`/group/${group.id}?tab=events`); else toast("Crea un grupo primero"); }} />
            <MenuItem testID="qa-privacy" icon="lock-closed" label="Privacidad" onPress={() => { setMenu(false); router.push("/privacy"); }} />
          </Animated.View>
        ) : null}
        <Pressable testID="fab-recenter" onPress={recenter} style={s.fab} accessibilityLabel="Centrar en mi ubicación"><Ionicons name="locate" size={20} color={mePos ? colors.brandPrimary : colors.muted} /></Pressable>
        <Pressable testID="fab-tools" onPress={() => { setSel(null); setMenu(!menu); }} style={[s.fab, menu && s.fabOn]} accessibilityLabel="Herramientas"><Ionicons name={menu ? "close" : "grid"} size={20} color={menu ? colors.onBrandPrimary : colors.onSurface} /></Pressable>
      </View>

      {/* Selected point (compact, never covers the map) */}
      {sel ? (
        <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOut.duration(120)} style={[s.selCard, { bottom: insets.bottom + spacing.lg }]} testID="selected-point-card">
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Ionicons name="location" size={18} color={colors.brandPrimary} />
            <View style={{ flex: 1 }}>
              <T weight="semibold" style={{ fontSize: 14 }} numberOfLines={2} testID="selected-point-name">{reverse.isLoading ? "Buscando dirección…" : selName}</T>
              <T style={{ fontSize: 11, color: colors.muted }}>{mePos ? `${fmtDist(distM(mePos, sel))} de ti` : "Toca “Ir” para calcular la ruta"}</T>
            </View>
            <Pressable testID="selected-point-close" onPress={() => setSel(null)} hitSlop={8} style={s.closeBtn}><Ionicons name="close" size={16} color={colors.onSurface} /></Pressable>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
            <Tool testID="sel-go" icon="navigate" label="Ir" primary onPress={() => { router.push({ pathname: "/navigate", params: { ...originParams, lat: String(sel.lat), lng: String(sel.lng), place: selName } }); setSel(null); }} />
            <Tool testID="sel-meet" icon="calendar" label="Quedar aquí" onPress={() => { if (!group) return toast("Crea un grupo primero"); router.push({ pathname: "/meeting/new", params: { group: group.id, lat: String(sel.lat), lng: String(sel.lng), place: selName } }); setSel(null); }} />
            <Tool testID="sel-convoy" icon="car-sport" label="Convoy" onPress={() => { if (!group) return toast("Crea un grupo primero"); router.push({ pathname: "/convoy/new", params: { group: group.id, lat: String(sel.lat), lng: String(sel.lng), place: selName } }); setSel(null); }} />
          </View>
        </Animated.View>
      ) : null}

      {!group && groups.isSuccess && !sel && !menu ? (
        <View style={[s.hint, { bottom: insets.bottom + spacing.lg }]} pointerEvents="box-none">
          <Pressable testID="create-group-cta" onPress={() => router.push("/onboarding/group")} style={s.hintBtn}><Ionicons name="add-circle" size={18} color={colors.onBrandPrimary} /><T weight="semibold" style={{ fontSize: 13, color: colors.onBrandPrimary }}>Crea tu grupo</T></Pressable>
        </View>
      ) : null}
    </View>
  );
}

function MenuItem({ icon, label, onPress, testID }: { icon: string; label: string; onPress: () => void; testID: string }) {
  const s = useStyles(); const { colors } = useTheme();
  return <Pressable testID={testID} onPress={onPress} style={s.menuItem}><T weight="semibold" style={{ fontSize: 13 }}>{label}</T><View style={s.menuIcon}><Ionicons name={icon as any} size={16} color={colors.brandPrimary} /></View></Pressable>;
}
function Tool({ icon, label, onPress, testID, primary }: { icon: string; label: string; onPress: () => void; testID: string; primary?: boolean }) {
  const s = useStyles(); const { colors } = useTheme();
  const fg = primary ? colors.onBrandPrimary : colors.onSurface;
  return <Pressable testID={testID} onPress={onPress} style={[s.tool, primary && s.toolOn]}><Ionicons name={icon as any} size={15} color={fg} /><T weight="semibold" style={{ fontSize: 12, color: fg }} numberOfLines={1}>{label}</T></Pressable>;
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.mapTint },
  top: { position: "absolute", left: 0, right: 0, paddingHorizontal: spacing.md },
  bar: { flexDirection: "row", alignItems: "center", backgroundColor: c.glassStrong, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, padding: 4, gap: 4, shadowColor: c.surfaceInverse, shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  barLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingLeft: spacing.sm, height: 44 },
  barTxt: { fontSize: 15 },
  barIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: c.surfaceTertiary },
  avatar: { backgroundColor: c.brandPrimary, width: 36, height: 36, borderRadius: 18, marginRight: 2 },
  badge: { position: "absolute", top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: c.pending, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  fabs: { position: "absolute", right: spacing.md, alignItems: "flex-end", gap: spacing.sm },
  fab: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.glassStrong, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center", shadowColor: c.surfaceInverse, shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  fabOn: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  menu: { gap: 6, alignItems: "flex-end", marginBottom: 2 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 40, paddingLeft: 14, paddingRight: 4, borderRadius: radius.pill, backgroundColor: c.glassStrong, borderWidth: 1, borderColor: c.border, shadowColor: c.surfaceInverse, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  menuIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  selCard: { position: "absolute", left: spacing.md, right: spacing.md + 60, backgroundColor: c.glassStrong, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.md, shadowColor: c.surfaceInverse, shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  tool: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, height: 36, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border, paddingHorizontal: 6 },
  toolOn: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  hint: { position: "absolute", left: spacing.md, right: spacing.md + 60, alignItems: "flex-start" },
  hintBtn: { flexDirection: "row", alignItems: "center", gap: 6, height: 44, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: c.brandPrimary, shadowColor: c.surfaceInverse, shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  txt: { fontFamily: fonts.regular },
}));
