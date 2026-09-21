// NUEVA CERCA — nombre, tipo, radio y punto (desde el mapa, mi GPS o búsqueda).
// Escribe en zones vía PostgREST (RLS exige owner/admin del grupo; la UI lo anuncia antes).
import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Button, Chip, Header, T, toast } from "@/src/components/ui";
import { createZone, ZONE_KIND } from "@/src/zones";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const RADII = [100, 250, 500, 1000];

export default function NewFence() {
  const { group, lat, lng, place } = useLocalSearchParams<{ group: string; lat?: string; lng?: string; place?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [kind, setKind] = useState<string>("home");
  const [radius, setRadius] = useState(250);
  const [query, setQuery] = useState(place ?? "");
  const [searchQ, setSearchQ] = useState("");
  const [picked, setPicked] = useState<{ name: string; lat: number; lng: number } | null>(lat && lng ? { name: place ?? "Punto del mapa", lat: Number(lat), lng: Number(lng) } : null);
  const [locating, setLocating] = useState(false);

  const results = useQuery({ queryKey: ["geocode", searchQ], enabled: searchQ.length > 2, queryFn: () => api<any[]>(`/mobility/geocode?q=${encodeURIComponent(searchQ)}`) });

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { toast("Sin permiso de ubicación", "error"); return; }
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPicked({ name: "Mi ubicación actual", lat: p.coords.latitude, lng: p.coords.longitude });
      setQuery("Mi ubicación actual");
    } catch { toast("No pude obtener tu ubicación", "error"); }
    finally { setLocating(false); }
  };

  const create = useMutation({
    mutationFn: () => createZone({ group_id: group, name: name.trim(), kind, lat: picked!.lat, lng: picked!.lng, radius_m: radius, address_hint: picked!.name !== "Mi ubicación actual" ? picked!.name : null, created_by: user!.id }),
    onSuccess: () => { toast(`Cerca “${name.trim()}” activa`, "success"); router.back(); },
    onError: (e: any) => toast(e.message || "No se pudo crear la cerca", "error"),
  });

  return (
    <View style={s.root} testID="fence-new">
      <Header title="Nueva cerca" onBack={() => router.back()} />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }} bottomOffset={24}>
        <T style={{ color: colors.muted, fontSize: 13 }}>El grupo recibirá un aviso cuando alguien entre o salga de esta zona.</T>

        <T weight="semibold">Nombre</T>
        <TextInput testID="fence-name-input" style={s.input} value={name} onChangeText={setName} placeholder="Casa, Cole de Mara, Oficina…" placeholderTextColor={colors.muted} maxLength={40} />

        <T weight="semibold">Tipo</T>
        <View style={s.chips}>
          {Object.entries(ZONE_KIND).map(([k, v]) => (
            <Chip key={k} testID={`fence-kind-${k}`} label={v.label} icon={v.icon} active={kind === k} onPress={() => setKind(k)} />
          ))}
        </View>

        <T weight="semibold">Radio</T>
        <View style={s.chips}>
          {RADII.map((r) => (
            <Chip key={r} testID={`fence-radius-${r}`} label={r >= 1000 ? `${r / 1000} km` : `${r} m`} active={radius === r} onPress={() => setRadius(r)} />
          ))}
        </View>

        <T weight="semibold">Ubicación</T>
        {picked ? (
          <View style={s.picked} testID="fence-picked">
            <Ionicons name="location" size={16} color={colors.success} />
            <T style={{ fontSize: 13, flex: 1 }} numberOfLines={2}>{picked.name}</T>
            <Pressable testID="fence-picked-clear" onPress={() => setPicked(null)} hitSlop={8}><Ionicons name="close" size={16} color={colors.muted} /></Pressable>
          </View>
        ) : null}
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <TextInput testID="fence-place-input" style={s.input} value={query} onChangeText={(v) => { setQuery(v); setPicked(null); }} onSubmitEditing={() => setSearchQ(query)} placeholder="Busca una dirección" placeholderTextColor={colors.muted} returnKeyType="search" />
          </View>
          <Button small testID="fence-place-search" title="Buscar" variant="secondary" icon="search" onPress={() => setSearchQ(query)} />
        </View>
        <Button small testID="fence-my-location" title="Usar mi ubicación actual" variant="ghost" icon="locate" loading={locating} onPress={useMyLocation} />
        {(results.data ?? []).map((r, i) => (
          <Pressable key={i} testID={`fence-geocode-${i}`} onPress={() => { setPicked(r); setQuery(r.name); }} style={[s.result, picked?.name === r.name && { borderColor: colors.brandPrimary }]}>
            <T style={{ fontSize: 13 }} numberOfLines={2}>{r.name}</T>
          </Pressable>
        ))}

        <View style={{ marginTop: spacing.md }}>
          <Button testID="fence-create-button" title="Crear cerca" icon="radio-button-on" loading={create.isPending} disabled={!picked || !name.trim()} onPress={() => create.mutate()} />
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  input: { minHeight: 52, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.lg, fontFamily: fonts.regular, fontSize: 15, color: c.onSurface },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  result: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceTertiary },
  picked: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: c.successSoft, borderWidth: 1, borderColor: c.success },
}));
