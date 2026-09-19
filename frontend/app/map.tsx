// ============================================================
// MAP — HOME. Live circle map on Google Maps (web).
// - Top pill: identity + group shortcut + menu.
// - Live positions: Supabase locations table + realtime subscription; upload only with consent + device permission.
// - Long-press (right-click on web) saves a place; saved places render as pins.
// - SOS sends a real alert_events row to every group. No simulated features: what is not built is not shown.
// ============================================================
import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { LatLng, MapCanvas, MapPerson, MapPin } from "@/src/components/MapCanvas";
import { Button, Glass, T, toast } from "@/src/components/ui";
import { useLocationSharing } from "@/src/hooks/useLocationSharing";
import { addSavedPlace, getGroupMembers, getMyGroups, getPositions, getSavedPlaces, getShareLocation, sendSos, setShareLocation, subscribePositions } from "@/src/sb";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const ago = (iso?: string) => {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "ahora";
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  return `hace ${Math.round(s / 3600)} h`;
};

export default function MapHome() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const [greet, setGreet] = useState(true);
  const [menu, setMenu] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const [locBanner, setLocBanner] = useState(false);
  const [sel, setSel] = useState<LatLng | null>(null);
  const [myPos, setMyPos] = useState<LatLng | null>(null);
  const [focus, setFocus] = useState<(LatLng & { key: number }) | undefined>();
  const [shareOn, setShareOn] = useState(true);

  const groups = useQuery({ queryKey: ["groups"], queryFn: getMyGroups, refetchInterval: 30000 });
  const group = groups.data?.[0];
  const members = useQuery({ queryKey: ["members", group?.id], enabled: !!group, queryFn: () => getGroupMembers(group!.id) });
  const positions = useQuery({ queryKey: ["positions", group?.id], enabled: !!group, refetchInterval: 15000, queryFn: () => getPositions(group!.id) });
  const places = useQuery({ queryKey: ["places"], queryFn: getSavedPlaces });

  useEffect(() => { getShareLocation().then(setShareOn); }, []);
  const loc = useLocationSharing(shareOn && !!group, group?.id);

  // Realtime: any locations change in the group → refetch positions.
  useEffect(() => {
    if (!group) return;
    const ch = subscribePositions(group.id, () => qc.invalidateQueries({ queryKey: ["positions", group.id] }));
    return () => { ch.unsubscribe(); };
  }, [group?.id, qc]);

  useEffect(() => { const t = setTimeout(() => setGreet(false), 4000); return () => clearTimeout(t); }, []);
  useEffect(() => { if (shareOn && loc.perm !== "granted" && loc.perm !== "unknown") setLocBanner(true); }, [shareOn, loc.perm]);
  useEffect(() => { if (loc.lastSentAt) qc.invalidateQueries({ queryKey: ["positions"] }); }, [loc.lastSentAt, qc]);
  // Device position (stays on the device unless sharing is on) → centering.
  useEffect(() => {
    if (loc.perm !== "granted") return;
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then((p) => setMyPos({ lat: p.coords.latitude, lng: p.coords.longitude })).catch(() => null);
  }, [loc.perm]);

  const name = user?.profile?.name ?? "";
  const userColor = user?.avatar?.color ?? colors.brandPrimary;
  const pos = positions.data ?? [];
  const memList = members.data ?? [];
  const myServed = pos.find((p) => p.user_id === user?.id);
  const mePos: LatLng | null = shareOn && myServed ? { lat: myServed.lat, lng: myServed.lng } : myPos;

  const people: MapPerson[] = memList.map((m) => {
    const p = pos.find((pp) => pp.user_id === m.user_id);
    const isMe = m.user_id === user?.id;
    const shared = !!p && (!isMe || shareOn);
    return {
      member_id: m.user_id, user_id: m.user_id, name: isMe ? `${m.name} (tú)` : m.name, color: m.color,
      state: shared ? "shared" : "not_shared", lat: shared ? p!.lat : undefined, lng: shared ? p!.lng : undefined,
      is_me: isMe, label: shared ? ago(p!.updated_at) : "Sin ubicación",
    };
  }).filter((p) => p.lat != null || !p.is_me || !mePos);
  // If I share nothing but have a device fix, show me locally (device-only, honest: not uploaded).
  if (mePos && !people.some((p) => p.is_me)) {
    people.push({ member_id: "me-local", user_id: user?.id ?? "me", name: name || "Tú", color: userColor, state: "shared", lat: mePos.lat, lng: mePos.lng, is_me: true, label: "solo en este dispositivo" });
  }
  const pins: MapPin[] = (places.data ?? []).map((p) => ({ id: String(p.id), lat: p.lat, lng: p.lng, title: p.label, color: "#F59E0B" }));

  // First fix → center once; afterwards only the recenter FAB moves the camera.
  useEffect(() => { if (mePos && !focus) setFocus({ lat: mePos.lat, lng: mePos.lng, key: 1 }); }, [mePos?.lat, mePos?.lng, focus]);

  const closeAll = () => { setSel(null); setMenu(false); setSosOpen(false); };
  const anyOpen = !!sel || menu || sosOpen || (locBanner && loc.perm !== "granted");
  const onMapPress = (c?: LatLng) => { if (anyOpen) { closeAll(); setLocBanner(false); return; } if (c) setSel(c); };
  const recenter = () => {
    closeAll();
    if (!mePos) { toast(loc.perm === "granted" ? "Obteniendo tu ubicación…" : "Permite la ubicación para centrarte"); if (loc.perm !== "granted") setLocBanner(true); return; }
    setFocus({ ...mePos, key: (focus?.key ?? 0) + 1 });
  };

  const toggleShare = async () => {
    const next = !shareOn;
    setShareOn(next);
    await setShareLocation(next);
    toast(next ? "Compartiendo tu ubicación con tu grupo" : "Has dejado de compartir tu ubicación", next ? "success" : "info");
    if (next && loc.perm !== "granted") setLocBanner(true);
    qc.invalidateQueries({ queryKey: ["positions"] });
  };

  const saveSel = async () => {
    if (!sel) return;
    let label = "Lugar guardado";
    if (Platform.OS === "web" && typeof window !== "undefined") label = window.prompt("Nombre del lugar", label)?.trim() || label;
    try { await addSavedPlace({ label, lat: sel.lat, lng: sel.lng }); qc.invalidateQueries({ queryKey: ["places"] }); toast(`“${label}” guardado`, "success"); setSel(null); }
    catch (e: any) { toast(e?.message ?? "No se pudo guardar el lugar", "error"); }
  };

  const doSos = async () => {
    const list = groups.data ?? [];
    if (!list.length) return toast("Crea un grupo para poder enviar un SOS");
    try {
      await sendSos(list.map((g) => g.id), mePos);
      toast(`SOS enviado a ${list.length === 1 ? list[0].name : `${list.length} grupos`}`, "success");
      setSosOpen(false);
    } catch (e: any) { toast(e?.message ?? "No se pudo enviar el SOS", "error"); }
  };

  const doSignOut = async () => { await signOut(); router.replace("/welcome"); };

  return (
    <View style={s.root} testID="map-home">
      <MapCanvas people={people} pins={pins} center={focus} selected={sel}
        onMapPress={onMapPress} onMapLongPress={(c) => { closeAll(); setSel(c); }}
        onPersonPress={(p) => { closeAll(); if (p.lat != null && p.lng != null) setFocus({ lat: p.lat, lng: p.lng, key: (focus?.key ?? 0) + 1 }); }} />

      {/* Top bar */}
      <View style={[s.top, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <View style={s.bar} testID="top-bar">
          <Pressable testID="profile-shortcut" onPress={() => { closeAll(); router.push("/profile"); }} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 }}>
            <View style={[s.avatar, { backgroundColor: userColor }]}><T weight="bold" style={{ color: "#FFFFFF", fontSize: 15 }}>{(name[0] ?? "T").toUpperCase()}</T></View>
            <View style={{ flex: 1 }}>
              <T weight="bold" style={{ fontSize: 15, letterSpacing: -0.2 }} numberOfLines={1} testID="bar-name">{name || "Tú"}</T>
              <T style={{ fontSize: 11.5, color: colors.muted }} numberOfLines={1}>{greet ? "Hola, bienvenido" : group ? group.name : "Sin grupo"}</T>
            </View>
          </Pressable>
          {group ? <Pressable testID="group-shortcut" onPress={() => { closeAll(); router.push(`/group/${group.id}`); }} style={s.barIcon} accessibilityLabel="Mi grupo"><Ionicons name="people" size={19} color={colors.onSurface} /></Pressable> : null}
          <Pressable testID="menu-button" onPress={() => { const n = !menu; closeAll(); setMenu(n); }} style={s.barIcon} accessibilityLabel="Menú"><Ionicons name="menu" size={21} color={colors.onSurface} /></Pressable>
        </View>
        {locBanner && shareOn && loc.perm !== "granted" ? (
          <Animated.View entering={FadeInDown} exiting={FadeOut} style={{ marginTop: spacing.sm + 56 }}>
            <Glass style={{ padding: spacing.md }} testID="location-permission-banner">
              <T weight="bold" style={{ fontSize: 13 }}>Permiso de ubicación del dispositivo</T>
              <T style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>Compartes tu ubicación con tu grupo; My Cluster necesita el permiso del sistema (solo con la app abierta).</T>
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                {loc.perm === "blocked" ? <Button small testID="location-open-settings" title="Abrir ajustes" onPress={loc.openSettings} /> : <Button small testID="location-request" title="Permitir" onPress={async () => { const ok = await loc.request(); if (!ok) toast("Sin permiso, tu grupo verá “Ubicación no compartida”"); }} />}
                <Button small testID="location-later" title="Ahora no" variant="ghost" onPress={() => setLocBanner(false)} />
              </View>
            </Glass>
          </Animated.View>
        ) : null}
      </View>

      {/* Right-side member rail */}
      <View style={[s.rail, { top: insets.top + 140, bottom: insets.bottom + 92 }]} pointerEvents="box-none">
        {people.filter((p) => !p.is_me).map((p) => (
          <Pressable key={p.member_id} testID={`rail-${p.member_id}`} onPress={() => { closeAll(); if (p.lat != null) setFocus({ lat: p.lat!, lng: p.lng!, key: (focus?.key ?? 0) + 1 }); else toast(`${p.name}: ubicación no compartida`); }} style={s.railItem}>
            <View style={[s.railDot, { backgroundColor: p.state === "shared" ? p.color : colors.pending }]}><T weight="bold" style={{ color: "#FFFFFF", fontSize: 12 }}>{p.name[0]?.toUpperCase()}</T></View>
            <T style={{ fontSize: 10, color: colors.onSurface }} numberOfLines={1}>{p.name.split(" ")[0]}</T>
          </Pressable>
        ))}
      </View>

      {/* Bottom-left controls: privacy (share toggle) + recenter */}
      <View style={[s.leftFabs, { bottom: insets.bottom + spacing.lg }]} pointerEvents="box-none">
        <Pressable testID="fab-privacy" onPress={toggleShare} style={[s.smallFab, { backgroundColor: shareOn ? colors.successSoft : colors.violetSoft, borderColor: "transparent" }]} accessibilityLabel="Compartir ubicación: activar o pausar">
          <Ionicons name={shareOn ? "lock-open" : "lock-closed"} size={18} color={shareOn ? colors.onSuccessSoft : colors.onVioletSoft} />
        </Pressable>
        <Pressable testID="fab-recenter" onPress={recenter} style={s.smallFab} accessibilityLabel="Centrar en mi ubicación"><Ionicons name="locate" size={18} color={mePos ? colors.brandPrimary : colors.muted} /></Pressable>
      </View>

      {/* Bottom-center SOS */}
      <View style={[s.sosWrap, { bottom: insets.bottom + spacing.lg }]} pointerEvents="box-none">
        <Pressable testID="fab-sos" onPress={() => { const n = !sosOpen; closeAll(); setSosOpen(n); }} accessibilityLabel="SOS">
          <LinearGradient colors={[colors.sosStart, colors.sosEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.sosBtn}><T weight="bold" style={{ fontSize: 16, color: colors.onSos, letterSpacing: 1 }}>SOS</T></LinearGradient>
        </Pressable>
      </View>

      {/* Selected point */}
      {sel ? (
        <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOut.duration(120)} style={[s.selCard, { bottom: insets.bottom + spacing.lg + 84 }]} testID="selected-point-card">
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Ionicons name="location" size={18} color={colors.brandPrimary} />
            <View style={{ flex: 1 }}>
              <T weight="semibold" style={{ fontSize: 14 }} numberOfLines={1} testID="selected-point-name">Punto seleccionado</T>
              <T style={{ fontSize: 11, color: colors.muted }}>{sel.lat.toFixed(5)}, {sel.lng.toFixed(5)}</T>
            </View>
            <Pressable testID="selected-point-close" onPress={() => setSel(null)} hitSlop={8} style={s.closeBtn}><Ionicons name="close" size={16} color={colors.onSurface} /></Pressable>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
            <Button small testID="sel-save" title="Guardar lugar" icon="bookmark" onPress={saveSel} />
            <Button small testID="sel-cancel" title="Quitar" variant="ghost" onPress={() => setSel(null)} />
          </View>
        </Animated.View>
      ) : null}

      {/* SOS confirm */}
      {sosOpen ? (
        <Animated.View entering={FadeInDown.duration(160)} exiting={FadeOut.duration(120)} style={[s.selCard, { bottom: insets.bottom + spacing.lg + 84, borderColor: colors.error }]} testID="sos-panel">
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Ionicons name="alert-circle" size={22} color={colors.error} />
            <View style={{ flex: 1 }}><T weight="bold" style={{ fontSize: 14 }}>Enviar SOS a {groups.data?.length === 1 ? groups.data[0].name : `tus ${groups.data?.length ?? 0} grupos`}</T><T style={{ fontSize: 11, color: colors.muted }}>Aviso de emergencia{mePos ? " con tu posición actual" : ""}. Queda registrado.</T></View>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
            <Button small testID="sos-confirm" title="Enviar SOS" icon="alert" variant="danger" onPress={doSos} />
            <Button small testID="sos-cancel" title="Cancelar" variant="ghost" onPress={() => setSosOpen(false)} />
          </View>
        </Animated.View>
      ) : null}

      {/* Menu */}
      {menu ? (
        <Animated.View entering={FadeInDown.duration(160)} exiting={FadeOut.duration(120)} style={[s.menuCard, { top: insets.top + spacing.sm + 60 }]} testID="main-menu">
          {[
            { icon: "person", label: "Perfil", onPress: () => { setMenu(false); router.push("/profile"); } },
            { icon: "shield-checkmark", label: "Privacidad", onPress: () => { setMenu(false); router.push("/privacy"); } },
            ...(group ? [{ icon: "people", label: `Grupo: ${group.name}`, onPress: () => { setMenu(false); router.push(`/group/${group.id}`); } }] : []),
            { icon: "log-out", label: "Cerrar sesión", onPress: doSignOut },
          ].map((it) => (
            <Pressable key={it.label} testID={`menu-${it.icon}`} onPress={it.onPress} style={s.menuRow}>
              <Ionicons name={it.icon as any} size={18} color={colors.onSurface} />
              <T weight="semibold" style={{ fontSize: 14 }} numberOfLines={1}>{it.label}</T>
            </Pressable>
          ))}
        </Animated.View>
      ) : null}

      {!group && groups.isSuccess && !sel ? (
        <View style={[s.hint, { bottom: insets.bottom + spacing.lg + 84 }]} pointerEvents="box-none">
          <Pressable testID="create-group-cta" onPress={() => router.push("/onboarding/group")} style={s.hintBtn}><Ionicons name="add-circle" size={18} color={colors.onBrandPrimary} /><T weight="semibold" style={{ fontSize: 13, color: colors.onBrandPrimary }}>Crea tu grupo</T></Pressable>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.mapTint },
  top: { position: "absolute", left: 0, right: 0, paddingHorizontal: spacing.md },
  bar: { flexDirection: "row", alignItems: "center", borderRadius: radius.pill, padding: 6, paddingLeft: 8, gap: 6, backgroundColor: c.glassStrong, borderWidth: 1, borderColor: c.hairline, shadowColor: c.surfaceInverse, shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  barIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: c.surfaceTertiary },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  rail: { position: "absolute", right: spacing.md, alignItems: "center", gap: spacing.sm },
  railItem: { alignItems: "center", gap: 2, maxWidth: 56 },
  railDot: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.85)" },
  leftFabs: { position: "absolute", left: spacing.md, alignItems: "flex-start", gap: spacing.sm },
  smallFab: { width: 46, height: 46, borderRadius: 23, backgroundColor: c.glassStrong, borderWidth: 1, borderColor: c.hairline, alignItems: "center", justifyContent: "center", shadowColor: c.surfaceInverse, shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  sosWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  sosBtn: { width: 66, height: 66, borderRadius: 33, alignItems: "center", justifyContent: "center", borderWidth: 2.5, borderColor: "rgba(255,255,255,0.9)", shadowColor: c.error, shadowOpacity: 0.55, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 8 },
  selCard: { position: "absolute", left: spacing.md, right: spacing.md, backgroundColor: c.glassStrong, borderRadius: radius.lg, borderWidth: 1, borderColor: c.hairline, padding: spacing.md + 2, shadowColor: c.surfaceInverse, shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  menuCard: { position: "absolute", right: spacing.md, backgroundColor: c.glassStrong, borderRadius: radius.lg, borderWidth: 1, borderColor: c.hairline, padding: spacing.sm, minWidth: 220, shadowColor: c.surfaceInverse, shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 10, paddingHorizontal: spacing.sm, borderRadius: radius.md },
  hint: { position: "absolute", left: spacing.md, right: spacing.md, alignItems: "flex-start" },
  hintBtn: { flexDirection: "row", alignItems: "center", gap: 6, height: 46, paddingHorizontal: 18, borderRadius: radius.pill, backgroundColor: c.brandPrimary, shadowColor: c.brandPrimary, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
}));
