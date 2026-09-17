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
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Incident, INCIDENT_TYPE, incidentIcon, LatLng, MapCanvas, MapPerson, MapPin } from "@/src/components/MapCanvas";
import { GroupsBar, GroupChip } from "@/src/components/GroupsBar";
import { MainMenu } from "@/src/components/MainMenu";
import { MemberRail } from "@/src/components/MemberRail";
import { MemberToolsSheet } from "@/src/components/MemberToolsSheet";
import { SharingPanel } from "@/src/components/SharingFab";
import { UserCard } from "@/src/components/UserCard";
import { UserPhoto } from "@/src/components/UserPhoto";
import { LinearGradient } from "expo-linear-gradient";
import { Button, Glass, T, toast } from "@/src/components/ui";
import { useLocationSharing } from "@/src/hooks/useLocationSharing";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";

const distM = (a: LatLng, b: LatLng) => { const R = 6371000, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180; const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);
const originParamsOf = (p: LatLng | null) => (p ? { fromLat: String(p.lat), fromLng: String(p.lng) } : {});

// Map layer categories (Azure POIs). Colors are semantic per category and stay constant across themes.
const POI_META: Record<string, { label: string; icon: string; color: string }> = {
  pharmacy: { label: "Farmacias", icon: "medkit", color: "#10B981" },
  restaurant: { label: "Restaurantes", icon: "restaurant", color: "#F59E0B" },
  park: { label: "Parques", icon: "leaf", color: "#22C55E" },
  hospital: { label: "Hospitales", icon: "medical", color: "#EF4444" },
  police: { label: "Comisarías", icon: "shield", color: "#3B82F6" },
  fuel: { label: "Gasolineras", icon: "flame", color: "#F97316" },
  market: { label: "Supermercados", icon: "cart", color: "#8B5CF6" },
  cafe: { label: "Cafeterías", icon: "cafe", color: "#A855F7" },
};

export default function MapHome() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const [greet, setGreet] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [mainMenu, setMainMenu] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const [locBanner, setLocBanner] = useState(false);
  const [sel, setSel] = useState<LatLng | null>(null);
  const [memberSel, setMemberSel] = useState<MapPerson | null>(null);
  const [myPos, setMyPos] = useState<LatLng | null>(null);
  const [focus, setFocus] = useState<(LatLng & { key: number }) | undefined>();
  const [hidden, setHidden] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [layers, setLayers] = useState<string[]>([]);
  const [followMode, setFollowMode] = useState<"off" | "follow" | "heading">("off");
  const [deviceHeading, setDeviceHeading] = useState(0);
  const [mapHeading, setMapHeading] = useState(0);
  const hideAnim = useSharedValue(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { hideAnim.value = withTiming(hidden ? 1 : 0, { duration: 220 }); }, [hidden]);
  const topStyle = useAnimatedStyle(() => ({ opacity: 1 - hideAnim.value, transform: [{ translateY: -hideAnim.value * 160 }] }));
  const rightStyle = useAnimatedStyle(() => ({ opacity: 1 - hideAnim.value, transform: [{ translateX: hideAnim.value * 260 }] }));
  const ctrlStyle = useAnimatedStyle(() => ({ opacity: 1 - hideAnim.value, transform: [{ translateX: -hideAnim.value * 120 }] }));

  const groups = useQuery({ queryKey: ["groups"], queryFn: () => api<any[]>("/groups"), refetchInterval: 15000 });
  const group = groups.data?.[0];
  const perms = useQuery({ queryKey: ["permissions"], queryFn: () => api<Record<string, any>>("/permissions") });
  const positions = useQuery({ queryKey: ["positions", group?.id], enabled: !!group, refetchInterval: 10000, queryFn: () => api<MapPerson[]>(`/groups/${group.id}/positions`) });
  const sharesLocation = !!perms.data && Object.values(perms.data).some((v: any) => v.effective && (v.key === "exact_location" || v.key === "approx_location"));
  const loc = useLocationSharing(sharesLocation);
  const reverse = useQuery({ queryKey: ["reverse", sel?.lat, sel?.lng], enabled: !!sel, retry: false, queryFn: () => api<{ name: string }>(`/mobility/reverse?lat=${sel!.lat}&lng=${sel!.lng}`) });
  const weather = useQuery({ queryKey: ["weather", sel?.lat?.toFixed(3), sel?.lng?.toFixed(3)], enabled: !!sel, retry: false, staleTime: 600000, queryFn: () => api<any>(`/mobility/weather?lat=${sel!.lat}&lng=${sel!.lng}`) });
  const [traffic, setTraffic] = useState(false);
  const [trafficPanel, setTrafficPanel] = useState(false);
  const incCenter = focus ?? { lat: 40.4168, lng: -3.7038 };
  const incidents = useQuery({ queryKey: ["incidents", incCenter.lat.toFixed(2), incCenter.lng.toFixed(2)], enabled: traffic, refetchInterval: 120000, retry: false,
    queryFn: () => api<Incident[]>(`/mobility/incidents?min_lat=${incCenter.lat - 0.12}&min_lng=${incCenter.lng - 0.16}&max_lat=${incCenter.lat + 0.12}&max_lng=${incCenter.lng + 0.16}`) });
  const [incSel, setIncSel] = useState<Incident | null>(null);
  const pendingTrips = useQuery({ queryKey: ["trips-pending"], refetchInterval: 15000, queryFn: () => api<any[]>("/trips/pending") });
  const [dismissedTrip, setDismissedTrip] = useState<string | null>(null);
  const tripInvite = (pendingTrips.data ?? []).find((t) => t.id !== dismissedTrip);
  const joinTrip = async () => {
    if (!tripInvite) return;
    try { await api(`/trips/${tripInvite.id}/join`, { method: "POST" }); qc.invalidateQueries({ queryKey: ["trips-pending"] }); router.push({ pathname: "/drive", params: { ...originParamsOf(mePos), lat: String(tripInvite.destination.lat), lng: String(tripInvite.destination.lng), place: tripInvite.destination.name, trip: tripInvite.id } }); }
    catch (e: any) { toast(e.message, "error"); }
  };

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
  const otherMembers = served.filter((p) => !p.is_me);
  const name = user?.profile?.name ?? "";
  const mePos: LatLng | null = meServed ? { lat: meServed.lat!, lng: meServed.lng! } : myPos;
  const people: MapPerson[] = meServed || !mePos
    ? served
    : [...served.filter((p) => !p.is_me), { member_id: "me-local", user_id: user?.id ?? "me", name: name || "Tú", color: colors.brandPrimary, state: "shared", lat: mePos.lat, lng: mePos.lng, is_me: true, has_photo: user?.has_photo }];
  // one-shot centering on the first GPS fix
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (mePos && !focus) { setFocus({ lat: mePos.lat, lng: mePos.lng, key: 1 }); setFollowMode("follow"); } }, [mePos?.lat, mePos?.lng, focus]);
  // Compass: subscribe to the device heading only while in "heading" mode.
  useEffect(() => {
    if (followMode !== "heading") return;
    let sub: any;
    Location.watchHeadingAsync((h) => setDeviceHeading(Math.round(h.trueHeading >= 0 ? h.trueHeading : h.magHeading))).then((s) => { sub = s; }).catch(() => {});
    return () => sub?.remove?.();
  }, [followMode]);

  const closeAll = () => { setSel(null); setMemberSel(null); setSharing(false); setTrafficPanel(false); setIncSel(null); setUserOpen(false); setSosOpen(false); setLayersOpen(false); };
  const anyOpen = !!sel || !!memberSel || sharing || trafficPanel || !!incSel || userOpen || sosOpen || layersOpen || (locBanner && loc.perm !== "granted");
  const onMapPress = (c?: LatLng) => { setHidden(false); if (anyOpen) { closeAll(); setLocBanner(false); return; } if (c) setSel(c); };
  const recenter = () => { setHidden(false); closeAll(); if (!mePos) { toast(loc.perm === "granted" ? "Obteniendo tu ubicación…" : "Permite la ubicación para centrarte"); if (loc.perm !== "granted") setLocBanner(true); return; } setFollowMode("follow"); setFocus({ ...mePos, key: (focus?.key ?? 0) + 1 }); };
  // Google-Maps-style location button: off → recenter (follow, north-up); follow → tap again → heading (map points where the phone points); heading → back to follow.
  const onLocate = () => {
    if (!mePos) return recenter();
    if (followMode === "follow") { setHidden(false); setFollowMode("heading"); return; }
    if (followMode === "heading") { setHidden(false); setFollowMode("follow"); setFocus({ ...mePos, key: (focus?.key ?? 0) + 1 }); return; }
    recenter();
  };
  const resetNorth = () => { setFollowMode("follow"); if (mePos) setFocus({ ...mePos, key: (focus?.key ?? 0) + 1 }); setMapHeading(0); };
  const locateIcon = followMode === "heading" ? "compass" : followMode === "follow" ? "locate" : "locate-outline";
  const originParams = originParamsOf(mePos);
  const poiCenter = focus ?? mePos ?? { lat: 40.4168, lng: -3.7038 };
  const poi = useQuery({
    queryKey: ["poi", layers.join(","), poiCenter.lat.toFixed(2), poiCenter.lng.toFixed(2)], enabled: layers.length > 0, staleTime: 120000, retry: false,
    queryFn: async () => { const all = await Promise.all(layers.map((cat) => api<any[]>(`/mobility/poi?lat=${poiCenter.lat}&lng=${poiCenter.lng}&category=${cat}&radius=4000`).catch(() => []))); return all.flat(); },
  });
  const poiPins: MapPin[] = (poi.data ?? []).map((p: any, i: number) => ({ id: `poi-${p.category}-${p.id ?? i}`, lat: p.lat, lng: p.lng, title: p.name, color: POI_META[p.category]?.color, icon: POI_META[p.category]?.icon, onPress: () => { setHidden(false); closeAll(); setSel({ lat: p.lat, lng: p.lng }); } }));
  const selName = reverse.data?.name ?? (sel ? `${sel.lat.toFixed(5)}, ${sel.lng.toFixed(5)}` : "");
  const userColor = user?.avatar?.color ?? colors.brandPrimary;
  const chipGroups: GroupChip[] = (groups.data ?? []).map((g: any) => ({ id: g.id, name: g.name, members: g.stats?.members ?? 0, connected: g.stats?.connected ?? 0, alerts: g.stats?.alerts ?? 0 }));
  const tasks = [
    ...(pendingTrips.data ?? []).map((t) => ({ id: `trip-${t.id}`, kind: "trip", label: `Viaje a ${t.destination?.name?.split(",")[0]} (${t.leader_name})`, onPress: () => { closeAll(); setDismissedTrip(null); } })),
    ...(groups.data ?? []).filter((g: any) => (g.my_role === "owner" || g.my_role === "admin") && g.stats?.pending).map((g: any) => ({ id: `inv-${g.id}`, kind: "invite", label: `${g.stats.pending} invitación(es) pendiente(s) en ${g.name}`, onPress: () => { closeAll(); router.push(`/group/${g.id}`); } })),
  ];
  const bannerVisible = locBanner && sharesLocation && loc.perm !== "granted";
  const groupsH = chipGroups.length ? 58 : 0;
  const rightTop = insets.top + 76 + groupsH + (bannerVisible ? 172 : 0) + (tripInvite && !sel ? 104 : 0);
  const railTop = rightTop + 58;
  const sendSos = async () => {
    const list = groups.data ?? [];
    if (!list.length) return toast("Crea un grupo para poder enviar un SOS");
    try {
      await Promise.all(list.map((g: any) => api("/events", { method: "POST", json: { group_id: g.id, kind: "emergency", severity: "critical", message: "SOS: necesito ayuda", ...(mePos ? { lat: mePos.lat, lng: mePos.lng } : {}) } })));
      toast(`SOS enviado a ${list.length === 1 ? list[0].name : `${list.length} grupos`}`, "success"); setSosOpen(false);
    } catch (e: any) { toast(e.message, "error"); }
  };

  return (
    <View style={s.root} testID="map-home">
      <MapCanvas people={people} pins={poiPins} center={focus} selected={sel} onMapPress={onMapPress} onMapLongPress={(c) => { setHidden(false); closeAll(); setSel(c); }} onUserPan={() => { if (!anyOpen) { setHidden(true); setFollowMode("off"); } }}
        followMode={followMode} deviceHeading={deviceHeading} onHeadingChange={setMapHeading}
        traffic={traffic} incidents={traffic ? incidents.data ?? [] : []} onIncidentPress={(i) => { setHidden(false); closeAll(); setIncSel(i); }}
        onPersonPress={(p) => { setHidden(false); closeAll(); if (p.member_id === "me-local") router.push("/profile"); else router.push(`/person/${p.member_id}?group=${group?.id}`); }} />

      {/* Big Google-Maps-style location button (left-center) + compass when the map is rotated */}
      <View style={s.centerWrap} pointerEvents="box-none">
        {Math.abs(mapHeading) > 1 ? (
          <Pressable testID="fab-compass" onPress={resetNorth} style={[s.compassBtn, { backgroundColor: colors.surfaceSecondary }]} accessibilityLabel="Orientar al norte">
            <Ionicons name="compass" size={22} color={colors.error} style={{ transform: [{ rotate: `${-mapHeading}deg` }] }} />
          </Pressable>
        ) : null}
        <Pressable testID="fab-recenter" onPress={onLocate} style={[s.centerBtn, { backgroundColor: colors.surfaceSecondary }]} accessibilityLabel="Ubicación / brújula">
          <Ionicons name={locateIcon as any} size={26} color={followMode === "off" ? colors.onSurface : colors.brandPrimary} />
        </Pressable>
      </View>

      {/* Top bar: user color, photo, name, search, menu */}
      <Animated.View style={[s.top, { paddingTop: insets.top + spacing.sm }, topStyle]} pointerEvents={hidden ? "none" : "box-none"}>
        <View style={[s.bar, { backgroundColor: userColor }]} testID="top-bar">
          <Pressable testID="profile-shortcut" onPress={() => { closeAll(); setUserOpen(true); }} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 }}>
            <UserPhoto userId={user?.id} name={name} color={userColor} size={36} hasPhoto={user?.has_photo} ring />
            <View style={{ flex: 1 }}>
              <T weight="bold" style={{ fontSize: 15, color: colors.onBrandPrimary }} numberOfLines={1} testID="bar-name">{name || "Tú"}</T>
              <T style={{ fontSize: 11, color: colors.onBrandPrimary, opacity: 0.85 }} numberOfLines={1} testID={greet ? "bar-greeting" : "bar-prompt"}>{greet ? "Hola, bienvenido" : group ? group.name : "Sin grupo"}</T>
            </View>
          </Pressable>
          <Pressable testID="search-bar-input" onPress={() => { closeAll(); router.push({ pathname: "/navigate", params: originParams }); }} style={s.barIcon} accessibilityLabel="¿A dónde vamos?"><Ionicons name="search" size={20} color={colors.onBrandPrimary} /></Pressable>
          <Pressable testID="menu-button" onPress={() => { closeAll(); setMainMenu(true); }} style={s.barIcon} accessibilityLabel="Menú"><Ionicons name="menu" size={22} color={colors.onBrandPrimary} /></Pressable>
        </View>
        {chipGroups.length ? <GroupsBar groups={chipGroups} activeId={group?.id} onPress={(id) => { setHidden(false); closeAll(); router.push(`/group/${id}`); }} style={{ marginTop: spacing.sm }} /> : null}
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
        {tripInvite && !sel ? (
          <Animated.View entering={FadeInDown} exiting={FadeOut} style={{ marginTop: spacing.sm }}>
            <Glass style={{ padding: spacing.md }} testID="trip-invite-banner">
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Ionicons name="car-sport" size={18} color={colors.brandPrimary} />
                <T weight="bold" style={{ fontSize: 13, flex: 1 }} numberOfLines={2}>{tripInvite.leader_name} te invita a ir a {tripInvite.destination?.name?.split(",")[0]}</T>
              </View>
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                <Button small testID="trip-join" title="Unirme al viaje" icon="navigate" onPress={joinTrip} />
                <Button small testID="trip-dismiss" title="Ahora no" variant="ghost" onPress={() => setDismissedTrip(tripInvite.id)} />
              </View>
            </Glass>
          </Animated.View>
        ) : null}
      </Animated.View>

      {/* Top-right user card + member rectangles */}
      <Animated.View style={[StyleSheet.absoluteFill, rightStyle]} pointerEvents={hidden ? "none" : "box-none"}>
        <UserCard pos={mePos} tasks={tasks} top={rightTop} sharing={sharesLocation && loc.perm === "granted"} open={userOpen} onOpen={() => { closeAll(); setUserOpen(true); }} onClose={() => setUserOpen(false)} />
        <MemberRail members={otherMembers} top={railTop} bottom={insets.bottom + 92} onPress={(m) => { closeAll(); setMemberSel(m); }} />
      </Animated.View>

      {/* Bottom-left map controls: privacy, traffic, layers (small, out of the way) */}
      <Animated.View style={[s.leftFabs, { bottom: insets.bottom + spacing.lg }, ctrlStyle]} pointerEvents={hidden ? "none" : "box-none"}>
        <Pressable testID="fab-privacy" onPress={() => { const next = !sharing; closeAll(); setSharing(next); }} style={[s.smallFab, { backgroundColor: colors.privacy, borderColor: colors.privacy }]} accessibilityLabel="Privacidad: qué comparto y con quién">
          <Ionicons name="lock-closed" size={18} color={colors.onPrivacy} />
        </Pressable>
        <Pressable testID="fab-traffic" onPress={() => { const on = !traffic; closeAll(); setTraffic(on); setTrafficPanel(on); }} style={[s.smallFab, traffic && s.fabOn]} accessibilityLabel="Tráfico e incidencias">
          <Ionicons name="car" size={18} color={traffic ? colors.onBrandPrimary : colors.onSurface} />
          {traffic && incidents.data?.length ? <View style={s.fabBadge}><T weight="bold" style={{ fontSize: 9, color: colors.onWarning }}>{Math.min(99, incidents.data.length)}</T></View> : null}
        </Pressable>
        <Pressable testID="fab-layers" onPress={() => { const next = !layersOpen; closeAll(); setLayersOpen(next); }} style={[s.smallFab, (layersOpen || layers.length > 0) && s.fabOn]} accessibilityLabel="Capas del mapa">
          <Ionicons name="layers" size={18} color={(layersOpen || layers.length > 0) ? colors.onBrandPrimary : colors.onSurface} />
          {layers.length > 0 ? <View style={[s.fabBadge, { backgroundColor: colors.brandSecondary }]}><T weight="bold" style={{ fontSize: 9, color: colors.onBrandSecondary }}>{layers.length}</T></View> : null}
        </Pressable>
      </Animated.View>

      {/* Layers picker (floating, does not cover the map) */}
      {layersOpen ? (
        <Animated.View entering={FadeInDown.duration(160)} exiting={FadeOut.duration(120)} style={[s.selCard, { left: spacing.md, right: spacing.md, bottom: insets.bottom + spacing.lg + 84 }]} testID="layers-panel">
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
            <Ionicons name="layers" size={18} color={colors.brandPrimary} />
            <T weight="bold" style={{ fontSize: 14, flex: 1 }}>¿Qué quieres ver en el mapa?</T>
            <Pressable testID="layers-close" onPress={() => setLayersOpen(false)} hitSlop={8} style={s.closeBtn}><Ionicons name="close" size={16} color={colors.onSurface} /></Pressable>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {Object.entries(POI_META).map(([key, meta]) => {
              const on = layers.includes(key);
              return (
                <Pressable key={key} testID={`layer-${key}`} onPress={() => setLayers((ls) => (on ? ls.filter((l) => l !== key) : [...ls, key]))}
                  style={[s.layerChip, on && { backgroundColor: meta.color, borderColor: meta.color }]}>
                  <Ionicons name={meta.icon as any} size={14} color={on ? "#FFFFFF" : colors.onSurface} />
                  <T weight="semibold" style={{ fontSize: 12.5, color: on ? "#FFFFFF" : colors.onSurface }}>{meta.label}</T>
                </Pressable>
              );
            })}
          </View>
          {layers.length > 0 ? <T style={{ fontSize: 11, color: colors.muted, marginTop: spacing.sm }}>{poi.isLoading ? "Buscando lugares cercanos…" : `${poi.data?.length ?? 0} lugares cerca (Azure Maps)`}</T> : null}
        </Animated.View>
      ) : null}

      {/* Bottom-center SOS button */}
      <View style={[s.sosWrap, { bottom: insets.bottom + spacing.lg }]} pointerEvents="box-none">
        <Pressable testID="fab-sos" onPress={() => { const next = !sosOpen; closeAll(); setSosOpen(next); }} accessibilityLabel="SOS">
          <LinearGradient colors={[colors.sosStart, colors.sosEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.sosBtn}><T weight="bold" style={{ fontSize: 16, color: colors.onSos, letterSpacing: 1 }}>SOS</T></LinearGradient>
        </Pressable>
      </View>

      {sharing ? <SharingPanel onClose={() => setSharing(false)} bottom={insets.bottom + spacing.lg} /> : null}

      {/* Traffic incidents (Azure) */}
      {trafficPanel && !incSel ? (
        <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOut.duration(120)} style={[s.selCard, { bottom: insets.bottom + spacing.lg + 84, maxHeight: 300 }]} testID="traffic-panel">
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Ionicons name="car" size={18} color={colors.brandPrimary} />
            <T weight="bold" style={{ fontSize: 14, flex: 1 }}>{incidents.isLoading ? "Buscando incidencias…" : incidents.isError ? "Incidencias no disponibles" : `${incidents.data?.length ?? 0} incidencias en la zona`}</T>
            <Pressable testID="traffic-close" onPress={() => setTrafficPanel(false)} hitSlop={8} style={s.closeBtn}><Ionicons name="close" size={16} color={colors.onSurface} /></Pressable>
          </View>
          <T style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>Capa de tráfico en tiempo real activa (Azure Maps). Toca una incidencia para verla.</T>
          <ScrollView style={{ maxHeight: 200, marginTop: spacing.sm }} showsVerticalScrollIndicator={false}>
            {(incidents.data ?? []).slice(0, 12).map((i) => (
              <Pressable key={i.id} testID={`incident-row-${i.id}`} onPress={() => { setFocus({ lat: i.lat, lng: i.lng, key: (focus?.key ?? 0) + 1 }); setIncSel(i); setTrafficPanel(false); }} style={s.incRow}>
                <Ionicons name={incidentIcon(i) as any} size={16} color={i.road_closed ? colors.error : colors.warning} />
                <View style={{ flex: 1 }}><T weight="semibold" style={{ fontSize: 13 }} numberOfLines={1}>{i.title || i.type}</T><T style={{ fontSize: 11, color: colors.muted }} numberOfLines={1}>{INCIDENT_TYPE[i.type ?? ""] ?? i.type}{i.road_closed ? " · vía cortada" : ""}{i.delay_s ? ` · +${Math.round(i.delay_s / 60)} min` : ""}</T></View>
              </Pressable>
            ))}
            {incidents.isSuccess && incidents.data.length === 0 ? <T style={{ fontSize: 12, color: colors.muted }}>Sin incidencias notificadas en esta zona.</T> : null}
          </ScrollView>
        </Animated.View>
      ) : null}
      {incSel ? (
        <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOut.duration(120)} style={[s.selCard, { bottom: insets.bottom + spacing.lg + 84 }]} testID="incident-card">
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Ionicons name={incidentIcon(incSel) as any} size={20} color={incSel.road_closed ? colors.error : colors.warning} />
            <View style={{ flex: 1 }}>
              <T weight="semibold" style={{ fontSize: 14 }} numberOfLines={2}>{incSel.description || incSel.title}</T>
              <T style={{ fontSize: 11, color: colors.muted }}>{INCIDENT_TYPE[incSel.type ?? ""] ?? incSel.type}{incSel.road_closed ? " · vía cortada" : ""}{incSel.delay_s ? ` · retraso ${Math.round(incSel.delay_s / 60)} min` : ""}{mePos ? ` · ${fmtDist(distM(mePos, incSel))} de ti` : ""}</T>
            </View>
            <Pressable testID="incident-close" onPress={() => setIncSel(null)} hitSlop={8} style={s.closeBtn}><Ionicons name="close" size={16} color={colors.onSurface} /></Pressable>
          </View>
        </Animated.View>
      ) : null}

      {/* Selected point (compact, never covers the map) */}
      {sel ? (
        <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOut.duration(120)} style={[s.selCard, { bottom: insets.bottom + spacing.lg + 84 }]} testID="selected-point-card">
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Ionicons name="location" size={18} color={colors.brandPrimary} />
            <View style={{ flex: 1 }}>
              <T weight="semibold" style={{ fontSize: 14 }} numberOfLines={2} testID="selected-point-name">{reverse.isLoading ? "Buscando dirección…" : selName}</T>
              <T style={{ fontSize: 11, color: colors.muted }}>{mePos ? `${fmtDist(distM(mePos, sel))} de ti` : "Toca “Ir” para calcular la ruta"}{weather.data?.temp_c != null ? ` · ${Math.round(weather.data.temp_c)}°C ${weather.data.phrase ?? ""}` : ""}</T>
              {weather.data?.alerts?.length ? <T style={{ fontSize: 11, color: colors.warning }} numberOfLines={1} testID="selected-weather-alert">⚠ {weather.data.alerts[0].title}</T> : null}
            </View>
            <Pressable testID="selected-point-close" onPress={() => setSel(null)} hitSlop={8} style={s.closeBtn}><Ionicons name="close" size={16} color={colors.onSurface} /></Pressable>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
            <Tool testID="sel-go" icon="navigate" label="Ir" primary onPress={() => { router.push({ pathname: "/drive", params: { ...originParams, lat: String(sel.lat), lng: String(sel.lng), place: selName } }); setSel(null); }} />
            <Tool testID="sel-meet" icon="calendar" label="Quedar aquí" onPress={() => { if (!group) return toast("Crea un grupo primero"); router.push({ pathname: "/meeting/new", params: { group: group.id, lat: String(sel.lat), lng: String(sel.lng), place: selName } }); setSel(null); }} />
            <Tool testID="sel-convoy" icon="car-sport" label="Convoy" onPress={() => { if (!group) return toast("Crea un grupo primero"); router.push({ pathname: "/convoy/new", params: { group: group.id, lat: String(sel.lat), lng: String(sel.lng), place: selName } }); setSel(null); }} />
          </View>
        </Animated.View>
      ) : null}

      {sosOpen ? (
        <Animated.View entering={FadeInDown.duration(160)} exiting={FadeOut.duration(120)} style={[s.selCard, { bottom: insets.bottom + spacing.lg + 84, borderColor: colors.error }]} testID="sos-panel">
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Ionicons name="alert-circle" size={22} color={colors.error} />
            <View style={{ flex: 1 }}><T weight="bold" style={{ fontSize: 14 }}>Enviar SOS a {groups.data?.length === 1 ? groups.data[0].name : `tus ${groups.data?.length ?? 0} grupos`}</T><T style={{ fontSize: 11, color: colors.muted }}>Aviso de emergencia con prioridad{mePos ? " y tu posición actual" : ""}. Se registra como evidencia.</T></View>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
            <Button small testID="sos-confirm" title="Enviar SOS" icon="alert" variant="danger" onPress={sendSos} />
            <Button small testID="sos-cancel" title="Cancelar" variant="ghost" onPress={() => setSosOpen(false)} />
          </View>
        </Animated.View>
      ) : null}
      <MainMenu visible={mainMenu} onClose={() => setMainMenu(false)} groups={groups.data ?? []} />
      <MemberToolsSheet member={memberSel} mePos={mePos} groupId={group?.id} onClose={() => setMemberSel(null)} onFocus={(m) => setFocus({ lat: m.lat!, lng: m.lng!, key: (focus?.key ?? 0) + 1 })} />

      {!group && groups.isSuccess && !sel ? (
        <View style={[s.hint, { bottom: insets.bottom + spacing.lg + 84 }]} pointerEvents="box-none">
          <Pressable testID="create-group-cta" onPress={() => router.push("/onboarding/group")} style={s.hintBtn}><Ionicons name="add-circle" size={18} color={colors.onBrandPrimary} /><T weight="semibold" style={{ fontSize: 13, color: colors.onBrandPrimary }}>Crea tu grupo</T></Pressable>
        </View>
      ) : null}
    </View>
  );
}

function Tool({ icon, label, onPress, testID, primary }: { icon: string; label: string; onPress: () => void; testID: string; primary?: boolean }) {
  const s = useStyles(); const { colors } = useTheme();
  const fg = primary ? colors.onBrandPrimary : colors.onSurface;
  return <Pressable testID={testID} onPress={onPress} style={[s.tool, primary && s.toolOn]}><Ionicons name={icon as any} size={15} color={fg} /><T weight="semibold" style={{ fontSize: 12, color: fg }} numberOfLines={1}>{label}</T></Pressable>;
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.mapTint },
  top: { position: "absolute", left: 0, right: 0, paddingHorizontal: spacing.md },
  bar: { flexDirection: "row", alignItems: "center", borderRadius: radius.lg, padding: 6, paddingLeft: 8, gap: 4, shadowColor: c.surfaceInverse, shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  barLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingLeft: spacing.sm, height: 44 },
  barTxt: { fontSize: 15 },
  barIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.18)" },
  sos: { borderWidth: 1.5, borderColor: "rgba(255,255,255,0.85)" },
  avatar: { backgroundColor: c.brandPrimary, width: 36, height: 36, borderRadius: 18, marginRight: 2 },
  badge: { position: "absolute", top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: c.pending, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  leftFabs: { position: "absolute", left: spacing.md, alignItems: "flex-start", gap: spacing.sm },
  centerWrap: { position: "absolute", left: spacing.md, top: 0, bottom: 0, justifyContent: "center" },
  centerBtn: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border, shadowColor: c.surfaceInverse, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 7 },
  compassBtn: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border, marginBottom: spacing.sm, shadowColor: c.surfaceInverse, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  layerChip: { flexDirection: "row", alignItems: "center", gap: 6, height: 38, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border },
  smallFab: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.glassStrong, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center", shadowColor: c.surfaceInverse, shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  fabOn: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  fabBadge: { position: "absolute", top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: c.warning, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  sosWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  sosBtn: { width: 66, height: 66, borderRadius: 33, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.85)", shadowColor: c.error, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  incRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 6, borderBottomWidth: 1, borderColor: c.divider },
  selCard: { position: "absolute", left: spacing.md, right: spacing.md, backgroundColor: c.glassStrong, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.md, shadowColor: c.surfaceInverse, shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  tool: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, height: 36, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border, paddingHorizontal: 6 },
  toolOn: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  hint: { position: "absolute", left: spacing.md, right: spacing.md, alignItems: "flex-start" },
  hintBtn: { flexDirection: "row", alignItems: "center", gap: 6, height: 44, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: c.brandPrimary, shadowColor: c.surfaceInverse, shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  txt: { fontFamily: fonts.regular },
}));
