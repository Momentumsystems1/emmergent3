// Quedada creation: natural command or place search (real geocoding). Supports navigate mode for Navegación tools.
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, unavailableOf } from "@/src/api";
import { Button, Header, showUnavailable, T, toast } from "@/src/components/ui";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function NewMeeting() {
  const { group, mode, lat, lng, place } = useLocalSearchParams<{ group: string; mode?: string; lat?: string; lng?: string; place?: string }>();
  const prefill = lat && lng && !Number.isNaN(Number(lat)) ? { name: place ?? `${lat}, ${lng}`, lat: Number(lat), lng: Number(lng) } : null;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const [name, setName] = useState(mode === "navigate" ? "Destino" : "Quedada");
  const [query, setQuery] = useState(prefill?.name ?? "");
  const [command, setCommand] = useState("");
  const [picked, setPicked] = useState<{ name: string; lat: number; lng: number } | null>(prefill);
  const [searchQ, setSearchQ] = useState("");
  const results = useQuery({ queryKey: ["geocode", searchQ], enabled: searchQ.length > 2, queryFn: () => api<any[]>(`/mobility/geocode?q=${encodeURIComponent(searchQ)}`) });
  const providers = useQuery({ queryKey: ["system-status"], queryFn: () => api<any>("/system/status") });

  const parseCommand = () => {
    // Deterministic intent parsing (no LLM configured): "quedar a cenar en <lugar> a mi grupo <grupo>"
    const m = command.match(/(?:en|at)\s+(.+?)(?:\s+(?:a|con)\s+mi\s+grupo|\s*$)/i);
    if (m?.[1]) { setSearchQ(m[1].trim()); setQuery(m[1].trim()); }
    const act = command.match(/(cenar|comer|desayunar|tomar algo|ver|quedar)/i);
    if (act) setName(act[1].charAt(0).toUpperCase() + act[1].slice(1));
    if (!m) toast("No he reconocido el lugar. Escríbelo en el buscador.");
  };

  const create = useMutation({
    mutationFn: () => api<any>("/meetings", { method: "POST", json: { group_id: group, name, place_query: picked ? undefined : query || undefined, lat: picked?.lat, lng: picked?.lng, place_name: picked?.name, natural_command: command || undefined } }),
    onSuccess: (m) => router.replace(`/meeting/${m.id}`),
    onError: (e) => { const u = unavailableOf(e); if (u) showUnavailable(u); else toast((e as any).message, "error"); },
  });

  if (!group) return <View style={s.root}><Header title="Quedar" /><T style={{ padding: spacing.xl, color: colors.muted }}>Necesitas un grupo para crear una quedada.</T></View>;
  const geo = providers.data?.providers?.geocoding;
  return (
    <View style={s.root} testID="meeting-new">
      <Header title={mode === "navigate" ? "Navegar" : "Quedar"} />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }} bottomOffset={24}>
        <T style={{ color: colors.muted, fontSize: 13 }}>Acción natural de MY CLUSTER</T>
        <TextInput testID="meeting-command-input" style={s.input} placeholder="Ej.: Envía una petición para quedar a cenar en El Rincón de Aragón a mi grupo Amigos" placeholderTextColor={colors.muted} value={command} onChangeText={setCommand} multiline onSubmitEditing={parseCommand} />
        <Button small testID="meeting-command-parse" title="Interpretar" variant="secondary" icon="sparkles" onPress={parseCommand} />
        <T weight="semibold" style={{ marginTop: spacing.sm }}>Nombre</T>
        <TextInput testID="meeting-name-input" style={s.input} value={name} onChangeText={setName} placeholder="Quedada" placeholderTextColor={colors.muted} />
        <T weight="semibold">Lugar</T>
        <TextInput testID="meeting-place-input" style={s.input} value={query} onChangeText={(v) => { setQuery(v); setPicked(null); }} onSubmitEditing={() => setSearchQ(query)} placeholder="Busca un lugar o dirección" placeholderTextColor={colors.muted} returnKeyType="search" />
        <Button small testID="meeting-place-search" title="Buscar" variant="secondary" icon="search" onPress={() => setSearchQ(query)} />
        {geo ? <T style={{ fontSize: 11, color: colors.muted }}>Geocodificación: {geo.provider}{geo.note ? ` · ${geo.note}` : ""}</T> : null}
        {results.isLoading ? <T style={{ color: colors.muted }}>Buscando…</T> : null}
        {results.isError ? <T style={{ color: colors.error }}>El servicio de geocodificación no respondió.</T> : null}
        {(results.data ?? []).map((r, i) => (
          <Pressable key={i} testID={`geocode-result-${i}`} onPress={() => { setPicked(r); setQuery(r.name); }} style={[s.result, picked?.name === r.name && { borderColor: colors.brandPrimary }]}>
            <T style={{ fontSize: 13 }} numberOfLines={2}>{r.name}</T>
          </Pressable>
        ))}
        <View style={{ marginTop: spacing.lg }}>
          <Button testID="meeting-create-button" title={mode === "navigate" ? "Crear destino compartido" : "Crear Quedada"} onPress={() => create.mutate()} loading={create.isPending} disabled={!name.trim()} />
          <T style={{ fontSize: 12, color: colors.muted, marginTop: spacing.sm }}>Las invitaciones se preparan para tu grupo; el ETA de cada persona solo se calcula si comparte ubicación y ETA.</T>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  input: { minHeight: 52, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.lg, paddingVertical: 12, fontFamily: fonts.regular, fontSize: 15, color: c.onSurface },
  result: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceTertiary },
}));
