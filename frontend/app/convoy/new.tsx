// NUEVO CONVOY — nombre + destino; el creador es el líder (RLS: miembro activo del grupo).
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Button, Header, T, toast } from "@/src/components/ui";
import { createConvoy } from "@/src/convoys";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function NewConvoy() {
  const { group, lat, lng, place } = useLocalSearchParams<{ group: string; lat?: string; lng?: string; place?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [name, setName] = useState("Convoy");
  const [query, setQuery] = useState(place ?? "");
  const [searchQ, setSearchQ] = useState("");
  const [picked, setPicked] = useState<{ name: string; lat: number; lng: number } | null>(lat && lng ? { name: place ?? "Destino", lat: Number(lat), lng: Number(lng) } : null);
  const results = useQuery({ queryKey: ["geocode", searchQ], enabled: searchQ.length > 2, queryFn: () => api<any[]>(`/mobility/geocode?q=${encodeURIComponent(searchQ)}`) });
  const create = useMutation({
    mutationFn: () => createConvoy({ group_id: group, leader_id: user!.id, name: name.trim(), dest_name: picked!.name, dest_lat: picked!.lat, dest_lng: picked!.lng }),
    onSuccess: (c) => router.replace(`/convoy/${c.id}`),
    onError: (e: any) => toast(e.message || "No se pudo crear el convoy", "error"),
  });
  return (
    <View style={s.root} testID="convoy-new">
      <Header title="Convoy / Seguidme" onBack={() => router.back()} />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }} bottomOffset={24}>
        <T style={{ color: colors.muted, fontSize: 13 }}>Tú serás el líder. La cohesión se mide por la distancia entre vehículos, nunca por instrucciones de acelerar.</T>
        <TextInput testID="convoy-name-input" style={s.input} value={name} onChangeText={setName} placeholder="Nombre del convoy" placeholderTextColor={colors.muted} maxLength={40} />
        <T weight="semibold">Destino</T>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <TextInput testID="convoy-place-input" style={s.input} value={query} onChangeText={(v) => { setQuery(v); setPicked(null); }} onSubmitEditing={() => setSearchQ(query)} placeholder="Busca un destino" placeholderTextColor={colors.muted} returnKeyType="search" />
          </View>
          <Button small testID="convoy-place-search" title="Buscar" variant="secondary" icon="search" onPress={() => setSearchQ(query)} />
        </View>
        {(results.data ?? []).map((r, i) => <Pressable key={i} testID={`convoy-geocode-${i}`} onPress={() => { setPicked(r); setQuery(r.name); }} style={[s.result, picked?.name === r.name && { borderColor: colors.brandPrimary }]}><T style={{ fontSize: 13 }} numberOfLines={2}>{r.name}</T></Pressable>)}
        {picked ? <T style={{ fontSize: 12, color: colors.success }} testID="convoy-destination-picked">Destino: {picked.name}</T> : null}
        <View style={{ marginTop: spacing.md }}><Button testID="convoy-create-button" title="Iniciar convoy" onPress={() => create.mutate()} loading={create.isPending} disabled={!picked || !name.trim()} /></View>
      </KeyboardAwareScrollView>
    </View>
  );
}
const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  input: { minHeight: 52, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.lg, fontFamily: fonts.regular, fontSize: 15, color: c.onSurface },
  result: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceTertiary },
}));
