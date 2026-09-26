// NUEVA / EDITAR CERCA — flujo visual sobre el mapa:
// - Mapa arriba: el círculo crece EN TIEMPO REAL con el deslizador de diámetro y se mueve tocando el mapa.
// - Tarjeta compacta abajo (nunca ocupa toda la ventana): nombre, tipo, diámetro, para quién es, quién recibe el aviso.
// - El administrador decide explícitamente para quién es la cerca y quién recibe la notificación:
//   PROHIBIDO notificar a todo el grupo de forma implícita.
// Escritura en zones/zone_subscriptions vía PostgREST (RLS exige owner/admin del grupo).
import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { MapCanvas } from "@/src/components/MapCanvas";
import { Button, Chip, Header, T, toast } from "@/src/components/ui";
import { createZone, fetchZoneSubscriptions, fetchZones, replaceZoneSubscriptions, updateZone, ZONE_KIND, Zone } from "@/src/zones";
import { fetchGroups, fetchGroupMembers } from "@/src/groups";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

// Diámetro (la app habla de diámetro al usuario; el círculo se guarda por radio).
const DIAM_MIN = 100, DIAM_MAX = 2000, DIAM_STEP = 25;
const fmtM = (m: number) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(2).replace(/\.?0+$/, "")} km`);

// Deslizador sin dependencias: PanResponder nativo de React, mismo comportamiento en web y APK.
function Slider({ value, min, max, step, onChange, testID }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; testID: string }) {
  const { colors } = useTheme();
  const wRef = useRef(0);
  const fromX = (x: number) => {
    if (!wRef.current) return value;
    const ratio = Math.max(0, Math.min(1, x / wRef.current));
    const raw = min + ratio * (max - min);
    return Math.round(raw / step) * step;
  };
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return (
    <View testID={testID} style={sld.trackWrap}
      onLayout={(e) => { wRef.current = e.nativeEvent.layout.width; }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => onChange(fromX(e.nativeEvent.locationX))}
      onResponderMove={(e) => onChange(fromX(e.nativeEvent.locationX))}
      accessibilityRole="adjustable" accessibilityLabel="Diámetro de la cerca">
      <View style={sld.track}><View style={[sld.fill, { width: `${pct * 100}%`, backgroundColor: colors.brandPrimary }]} /></View>
      <View style={[sld.thumb, { left: `${pct * 100}%`, borderColor: colors.brandPrimary }]} />
    </View>
  );
}
const sld = {
  trackWrap: { height: 40, justifyContent: "center" as const },
  track: { height: 8, borderRadius: 4, backgroundColor: "rgba(120,130,140,0.35)", overflow: "hidden" as const },
  fill: { height: 8, borderRadius: 4 },
  thumb: { position: "absolute" as const, width: 26, height: 26, borderRadius: 13, marginLeft: -13, backgroundColor: "#ffffff", borderWidth: 3, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
};

export default function FenceEditor() {
  const { group, zone: zoneId, lat, lng, place } = useLocalSearchParams<{ group: string; zone?: string; lat?: string; lng?: string; place?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const qc = useQueryClient();

  const editing = !!zoneId;
  const groups = useQuery({ queryKey: ["groups"], queryFn: fetchGroups });
  const grp: any = (groups.data ?? []).find((g: any) => g.id === group) ?? groups.data?.[0];
  const zones = useQuery({ queryKey: ["zones", group], enabled: !!group, queryFn: () => fetchZones(group) });
  const membersQ = useQuery({ queryKey: ["group-members", group], enabled: !!group, queryFn: () => fetchGroupMembers(group) });
  const existing: Zone | undefined = editing ? zones.data?.find((z) => z.id === zoneId) : undefined;
  const subs = useQuery({ queryKey: ["zone-subs", zoneId], enabled: editing && !!zoneId, queryFn: () => fetchZoneSubscriptions(zoneId!) });

  const [name, setName] = useState("");
  const [kind, setKind] = useState<string>("home");
  const [diameter, setDiameter] = useState(500);
  const [picked, setPicked] = useState<{ name: string; lat: number; lng: number } | null>(lat && lng ? { name: place ?? "Punto del mapa", lat: Number(lat), lng: Number(lng) } : null);
  const [watchIds, setWatchIds] = useState<string[]>([]);
  const [notifyIds, setNotifyIds] = useState<string[]>([]);
  const [locating, setLocating] = useState(false);
  const [focus, setFocus] = useState<{ lat: number; lng: number; key: number } | undefined>();
  // Precarga en edición (espera a que lleguen zona + suscripciones)
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (!editing || prefilled || !existing || !membersQ.data) return;
    setName(existing.name);
    setKind(existing.kind);
    setDiameter(Math.max(DIAM_MIN, Math.min(DIAM_MAX, existing.radius_m * 2)));
    setPicked({ name: existing.address_hint ?? "Ubicación de la cerca", lat: existing.lat, lng: existing.lng });
    setWatchIds(existing.watch_user_ids?.length ? [...existing.watch_user_ids] : (membersQ.data ?? []).map((m: any) => m.user_id));
    setPrefilled(true);
  }, [editing, prefilled, existing, membersQ.data]);
  useEffect(() => {
    if (!editing || prefilled || !subs.data) return;
    setNotifyIds(subs.data.map((x) => x.user_id));
  }, [editing, prefilled, subs.data]);
  // Creación: por defecto la cerca vigila a quien la crea (y quien crea recibe el aviso); el admin lo ajusta.
  useEffect(() => {
    if (editing || prefilled) return;
    if (user?.id) { setWatchIds([user.id]); setNotifyIds([user.id]); }
    setPrefilled(true);
  }, [editing, prefilled, user?.id]);

  const members: any[] = membersQ.data ?? [];
  const toggleIn = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { toast("Sin permiso de ubicación", "error"); return; }
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPicked({ name: "Mi ubicación actual", lat: p.coords.latitude, lng: p.coords.longitude });
      setFocus({ lat: p.coords.latitude, lng: p.coords.longitude, key: Date.now() });
    } catch { toast("No pude obtener tu ubicación", "error"); }
    finally { setLocating(false); }
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(), kind,
        lat: picked!.lat, lng: picked!.lng,
        radius_m: Math.round(diameter / 2),
        watch_user_ids: watchIds,
      };
      if (editing) {
        const z = await updateZone(zoneId!, payload);
        await replaceZoneSubscriptions(zoneId!, notifyIds);
        return z;
      }
      const z = await createZone({ group_id: group, ...payload, address_hint: picked!.name !== "Mi ubicación actual" ? picked!.name : null, created_by: user!.id });
      await replaceZoneSubscriptions(z.id, notifyIds);
      return z;
    },
    onSuccess: () => {
      toast(editing ? `Cerca “${name.trim()}” actualizada` : `Cerca “${name.trim()}” activa`, "success");
      qc.invalidateQueries({ queryKey: ["zones", group] });
      qc.invalidateQueries({ queryKey: ["zone-subs", zoneId] });
      router.back();
    },
    onError: (e: any) => toast(e.message || "No se pudo guardar la cerca", "error"),
  });

  const otherCircles = (zones.data ?? []).filter((z) => z.id !== zoneId).map((z) => ({
    id: z.id, lat: z.lat, lng: z.lng, radius_m: z.radius_m, title: z.name, active: z.is_active,
  }));

  return (
    <View style={s.root} testID="fence-new">
      <Header title={editing ? "Editar cerca" : "Nueva cerca"} onBack={() => router.back()} />
      {/* Mapa con el círculo EN VIVO: el deslizador lo hace crecer; tocar el mapa mueve el centro */}
      <View style={{ flex: 1 }} testID="fence-map-wrap">
        <MapCanvas
          people={[]}
          circles={otherCircles}
          draftCircle={picked ? { lat: picked.lat, lng: picked.lng, radius_m: Math.round(diameter / 2) } : null}
          center={focus}
          zoomDelta={0.02}
          onMapPress={(c) => { if (!c) return; setPicked({ name: "Punto elegido en el mapa", lat: c.lat, lng: c.lng }); }}
        />
        {!picked ? (
          <View style={s.mapHint} pointerEvents="none" testID="fence-map-hint">
            <Ionicons name="hand-left" size={14} color={colors.onSurface} />
            <T weight="semibold" style={{ fontSize: 12 }}>Toca el mapa para colocar la cerca o usa tu ubicación</T>
          </View>
        ) : null}
      </View>

      {/* Tarjeta compacta (jamás ocupa toda la ventana) */}
      <View style={[s.card, { paddingBottom: insets.bottom + spacing.md }]} testID="fence-card">
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
          <T style={{ color: colors.muted, fontSize: 12 }}>El aviso de entrada/salida solo llega a las personas que elijas abajo: nunca a todo el grupo.</T>

          <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center", marginTop: spacing.sm }}>
            <TextInput testID="fence-name-input" style={[s.input, { flex: 1 }]} value={name} onChangeText={setName} placeholder="Casa, Cole de Mara, Oficina…" placeholderTextColor={colors.muted} maxLength={40} />
            <Button small testID="fence-my-location" title="Mi ubicación" variant="secondary" icon="locate" loading={locating} onPress={useMyLocation} />
          </View>

          <View style={s.chips}>
            {Object.entries(ZONE_KIND).map(([k, v]) => (
              <Chip key={k} testID={`fence-kind-${k}`} label={v.label} icon={v.icon} active={kind === k} onPress={() => setKind(k)} />
            ))}
          </View>

          <View style={{ marginTop: spacing.sm }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
              <T weight="semibold" style={{ fontSize: 13 }}>Diámetro</T>
              <T weight="bold" style={{ fontSize: 13, color: colors.brandPrimary }} testID="fence-diameter-label">{fmtM(diameter)} · radio {fmtM(Math.round(diameter / 2))}</T>
            </View>
            <Slider testID="fence-diameter-slider" value={diameter} min={DIAM_MIN} max={DIAM_MAX} step={DIAM_STEP} onChange={setDiameter} />
          </View>

          <T weight="semibold" style={{ fontSize: 13, marginTop: spacing.xs }}>¿Para quién es esta cerca?</T>
          <T style={{ color: colors.muted, fontSize: 11.5 }}>Solo las personas marcadas la activan al entrar o salir.</T>
          <View style={s.chips}>
            {members.map((m) => (
              <Chip key={m.user_id} testID={`fence-watch-${m.user_id}`} label={m.display_name ?? "Miembro"} active={watchIds.includes(m.user_id)} onPress={() => toggleIn(watchIds, setWatchIds, m.user_id)} />
            ))}
          </View>

          <T weight="semibold" style={{ fontSize: 13, marginTop: spacing.sm }}>¿Quién recibe el aviso?</T>
          <T style={{ color: colors.muted, fontSize: 11.5 }}>El administrador decide; el grupo jamás recibe un aviso colectivo.</T>
          <View style={s.chips}>
            {members.map((m) => (
              <Chip key={m.user_id} testID={`fence-notify-${m.user_id}`} label={m.display_name ?? "Miembro"} active={notifyIds.includes(m.user_id)} onPress={() => toggleIn(notifyIds, setNotifyIds, m.user_id)} />
            ))}
          </View>

          {picked ? (
            <View style={s.picked} testID="fence-picked">
              <Ionicons name="location" size={16} color={colors.success} />
              <T style={{ fontSize: 12.5, flex: 1 }} numberOfLines={1}>{picked.name}</T>
              <T style={{ fontSize: 11, color: colors.muted }}>toca el mapa para moverla</T>
            </View>
          ) : null}

          <View style={{ marginTop: spacing.md }}>
            <Button testID="fence-create-button" title={editing ? "Guardar cambios" : "Crear cerca"} icon="radio-button-on" loading={save.isPending} disabled={!picked || !name.trim()} onPress={() => save.mutate()} />
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  card: { backgroundColor: c.surfaceSecondary, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingTop: spacing.sm, maxHeight: "58%", borderWidth: 1, borderColor: c.hairline },
  mapHint: { position: "absolute", top: spacing.md, alignSelf: "center", flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: c.glassStrong, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: c.hairline },
  input: { minHeight: 48, borderRadius: radius.md, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.md, fontFamily: fonts.regular, fontSize: 15, color: c.onSurface },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.sm },
  picked: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: c.successSoft, borderWidth: 1, borderColor: c.success, marginTop: spacing.sm },
}));
