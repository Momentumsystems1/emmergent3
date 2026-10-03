// QUEDAR (spec Juan 2026-10-03, memory/QUEDADA-SPEC.md):
// pantalla partida en vertical — arriba el mapa, abajo la tarjeta crystal negra «Quedar».
// La tarjeta se esconde mientras el mapa se mueve y vuelve con slide + rebote al parar.
// Tap en el mapa → establecimiento más cercano (o calle y número) → confirmar o afinar.
// Con el sitio definido: nombre a mano, calendario y hora, e invitados con atajos
// Todos / Más cercanos / Manual. Al enviar, los avatares muestran el contador rojo.
import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, unavailableOf } from "@/src/api";
import { useAuth } from "@/src/auth";
import { BlurCard, BLUR_MUTED, BLUR_TEXT } from "@/src/components/BlurCard";
import { MapCanvas } from "@/src/components/MapCanvas";
import { Button, T, toast, showUnavailable } from "@/src/components/ui";
import { fonts, spacing, useTheme } from "@/src/theme";

type Place = { name: string; lat: number; lng: number; kind?: string };
type Step = "place" | "confirm" | "plan";
type WhoMode = "todos" | "cercanos" | "manual";

const DURATIONS = [30, 60, 90, 120];

function haversine(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000, toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Campo fecha+hora: datetime-local nativo en web; texto guiado en nativo. */
function WhenField({ value, onChange, testID }: { value: Date; onChange: (d: Date) => void; testID: string }) {
  if (Platform.OS === "web") {
    const pad = (n: number) => String(n).padStart(2, "0");
    const local = `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
    return React.createElement("input", {
      type: "datetime-local", value: local, "data-testid": testID,
      onChange: (e: any) => { const d = new Date(e.target.value); if (!Number.isNaN(d.getTime())) onChange(d); },
      style: { width: "100%", height: 48, borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.08)", color: BLUR_TEXT, padding: "0 14px", fontSize: 15, fontFamily: fonts.regular, colorScheme: "dark" } as any,
    });
  }
  const [text, setText] = useState("");
  return (
    <TextInput testID={testID} placeholder="AAAA-MM-DD HH:MM" placeholderTextColor={BLUR_MUTED} value={text}
      onChangeText={(v) => { setText(v); const d = new Date(v.replace(" ", "T")); if (!Number.isNaN(d.getTime())) onChange(d); }}
      style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", backgroundColor: "rgba(255,255,255,0.08)", color: BLUR_TEXT, paddingHorizontal: 14, fontFamily: fonts.regular, fontSize: 15 }} />
  );
}

export default function NewMeeting() {
  const { group, mode, lat, lng, place } = useLocalSearchParams<{ group: string; mode?: string; lat?: string; lng?: string; place?: string }>();
  const prefill: Place | null = lat && lng && !Number.isNaN(Number(lat)) ? { name: place ?? `${lat}, ${lng}`, lat: Number(lat), lng: Number(lng) } : null;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>(prefill ? "plan" : "place");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Place | null>(prefill);
  const [name, setName] = useState("Quedada");
  const [when, setWhen] = useState<Date>(() => { const d = new Date(Date.now() + 2 * 3600e3); d.setMinutes(0, 0, 0); return d; });
  const [duration, setDuration] = useState(60);
  const [who, setWho] = useState<WhoMode>("todos");
  const [manualIds, setManualIds] = useState<Set<string>>(new Set());
  const [resolving, setResolving] = useState(false);

  const groupQ = useQuery({ queryKey: ["group", group], enabled: !!group, queryFn: () => api<any>(`/groups/${group}`) });
  const posQ = useQuery({ queryKey: ["positions", group], enabled: !!group, queryFn: () => api<any[]>(`/groups/${group}/positions`) });
  const members = useMemo(() => (groupQ.data?.members ?? []).filter((m: any) => m.status === "active"), [groupQ.data]);

  const searchQ = useQuery({
    queryKey: ["quedada-search", query], enabled: step === "place" && query.trim().length > 2,
    queryFn: () => api<any[]>(`/mobility/autocomplete?q=${encodeURIComponent(query.trim())}`),
  });

  // --- tarjeta que se esconde al mover el mapa y vuelve con rebote ---
  const slide = useRef(new Animated.Value(0)).current;
  const hideCard = (hide: boolean) => {
    if (hide) Animated.timing(slide, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    else Animated.spring(slide, { toValue: 0, friction: 5, tension: 120, useNativeDriver: true }).start(); // vuelta con física
  };

  // Tap en el mapa → establecimiento más cercano (o calle y número)
  const onMapPress = async (c?: { lat: number; lng: number }) => {
    if (!c || step === "plan") return;
    setResolving(true);
    try {
      const [nb, rev] = await Promise.all([
        api<any>(`/mobility/nearby?lat=${c.lat}&lng=${c.lng}`).catch(() => null),
        api<any>(`/mobility/reverse?lat=${c.lat}&lng=${c.lng}`).catch(() => null),
      ]);
      const poi = (nb?.places ?? []).find((x: any) => x.kind !== "address");
      const addr = (nb?.places ?? [])[0];
      const label = poi?.name ?? rev?.short ?? (addr && !/^\s*-?\d/.test(addr.name ?? "") ? addr.name : null);
      if (label) {
        setPicked({ name: label, lat: poi?.lat ?? c.lat, lng: poi?.lng ?? c.lng, kind: poi?.kind ?? "address" });
        setStep("confirm");
      } else {
        setPicked({ name: `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`, lat: c.lat, lng: c.lng });
        setStep("confirm");
      }
    } finally { setResolving(false); }
  };

  const nearest3 = useMemo(() => {
    if (!picked) return [] as string[];
    const withPos = (posQ.data ?? []).filter((p) => p.lat != null && p.lng != null);
    return withPos
      .map((p) => ({ id: p.user_id as string, d: haversine(p.lat!, p.lng!, picked.lat, picked.lng) }))
      .sort((a, b) => a.d - b.d).slice(0, 3).map((x) => x.id);
  }, [picked, posQ.data]);

  const invitees = useMemo(() => {
    const all = members.map((m: any) => m.user_id as string);
    if (who === "todos") return all;
    if (who === "cercanos") return nearest3.length ? nearest3 : all;
    return [...manualIds];
  }, [who, members, nearest3, manualIds]);

  const create = useMutation({
    mutationFn: () => api<any>("/meetings", {
      method: "POST",
      json: {
        group_id: group, name: name.trim(), place_name: picked?.name, lat: picked?.lat, lng: picked?.lng,
        scheduled_at: when.toISOString(), duration_min: duration,
        invitees: who === "todos" ? undefined : invitees,
      },
    }),
    onSuccess: (m) => router.replace(`/meeting/${m.id}`),
    onError: (e) => { const u = unavailableOf(e); if (u) showUnavailable(u); else toast((e as any).message, "error"); },
  });

  if (!group) return <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}><T style={{ color: colors.muted }}>Necesitas un grupo para crear una quedada.</T></View>;

  const people = (posQ.data ?? []).map((p) => ({ ...p, member_id: p.member_id ?? p.user_id }));
  const slideStyle = {
    transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [0, 480] }) }],
    opacity: slide.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="quedada-screen">
      {/* Mitad superior: el mapa de siempre */}
      <View style={{ flex: 1 }}>
        <MapCanvas people={people} selected={picked ? { lat: picked.lat, lng: picked.lng } : null}
          center={picked ? { lat: picked.lat, lng: picked.lng, key: picked.lat + picked.lng } : undefined}
          onMapPress={onMapPress} onMoveChange={(moving) => hideCard(moving)} />
      </View>

      {/* Mitad inferior: tarjeta crystal negra «Quedar» */}
      <Animated.View style={[{ flex: 1 }, slideStyle]} pointerEvents="box-none">
        <BlurCard testID="quedada-card" style={{ flex: 1, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg, gap: spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="calendar" size={18} color={BLUR_TEXT} />
              <T weight="bold" style={{ color: BLUR_TEXT, fontSize: 18, flex: 1 }}>Quedar</T>
              <Pressable testID="quedada-close" onPress={() => router.back()} hitSlop={10}><Ionicons name="close" size={20} color={BLUR_MUTED} /></Pressable>
            </View>

            {step === "place" ? (
              <>
                <T style={{ color: BLUR_MUTED, fontSize: 13 }}>Escribe un restaurante, gasolinera, farmacia, calle… o toca el mapa y te apunto al sitio más cercano.</T>
                <TextInput testID="quedada-search-input" value={query} onChangeText={(v) => { setQuery(v); }}
                  placeholder="¿Dónde quedamos?" placeholderTextColor={BLUR_MUTED} returnKeyType="search"
                  style={{ height: 50, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", backgroundColor: "rgba(255,255,255,0.08)", color: BLUR_TEXT, paddingHorizontal: 14, fontFamily: fonts.regular, fontSize: 15 }} />
                {searchQ.isFetching ? <T style={{ color: BLUR_MUTED, fontSize: 12 }}>Buscando…</T> : null}
                {(searchQ.data ?? []).slice(0, 4).map((r, i) => (
                  <Pressable key={i} testID={`quedada-result-${i}`} onPress={() => { setPicked({ name: r.name, lat: r.lat, lng: r.lng }); setStep("confirm"); }}
                    style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.10)" }}>
                    <T style={{ color: BLUR_TEXT, fontSize: 14 }} numberOfLines={2}>{r.name}</T>
                  </Pressable>
                ))}
                {resolving ? <T style={{ color: BLUR_MUTED, fontSize: 12 }}>Apuntando al sitio…</T> : null}
              </>
            ) : null}

            {step === "confirm" && picked ? (
              <>
                <T style={{ color: BLUR_MUTED, fontSize: 13 }}>Te apunto a:</T>
                <T weight="bold" style={{ color: BLUR_TEXT, fontSize: 16 }} testID="quedada-candidate">{picked.name}</T>
                <T style={{ color: BLUR_MUTED, fontSize: 12 }}>¿Es correcto o quieres afinar?</T>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}><Button testID="quedada-confirm-yes" title="Sí, ese sitio" onPress={() => setStep("plan")} /></View>
                  <View style={{ flex: 1 }}><Button testID="quedada-confirm-edit" title="Afinar" variant="secondary" onPress={() => { setQuery(picked.name); setStep("place"); }} /></View>
                </View>
              </>
            ) : null}

            {step === "plan" && picked ? (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="location" size={13} color={BLUR_MUTED} />
                  <T style={{ color: BLUR_MUTED, fontSize: 12, flex: 1 }} numberOfLines={1}>{picked.name}</T>
                </View>
                <T weight="semibold" style={{ color: BLUR_TEXT }}>Nombre de la quedada</T>
                <TextInput testID="quedada-name" value={name} onChangeText={setName} placeholder="Quedada" placeholderTextColor={BLUR_MUTED}
                  style={{ height: 50, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", backgroundColor: "rgba(255,255,255,0.08)", color: BLUR_TEXT, paddingHorizontal: 14, fontFamily: fonts.regular, fontSize: 15 }} />
                <T weight="semibold" style={{ color: BLUR_TEXT }}>Calendario y hora</T>
                <WhenField testID="quedada-when" value={when} onChange={setWhen} />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {DURATIONS.map((d) => (
                    <Pressable key={d} testID={`quedada-dur-${d}`} onPress={() => setDuration(d)}
                      style={{ paddingHorizontal: 14, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: duration === d ? colors.brandPrimary : "rgba(255,255,255,0.18)", backgroundColor: duration === d ? colors.brandPrimary : "transparent" }}>
                      <T weight="semibold" style={{ fontSize: 13, color: BLUR_TEXT }}>{d} min</T>
                    </Pressable>
                  ))}
                </View>
                <T weight="semibold" style={{ color: BLUR_TEXT }}>¿Quiénes?</T>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {(["todos", "cercanos", "manual"] as WhoMode[]).map((w) => (
                    <Pressable key={w} testID={`quedada-who-${w}`} onPress={() => setWho(w)}
                      style={{ paddingHorizontal: 14, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: who === w ? colors.brandPrimary : "rgba(255,255,255,0.18)", backgroundColor: who === w ? colors.brandPrimary : "transparent" }}>
                      <T weight="semibold" style={{ fontSize: 13, color: BLUR_TEXT }}>{w === "todos" ? "Todos" : w === "cercanos" ? "Más cercanos" : "Manual"}</T>
                    </Pressable>
                  ))}
                </View>
                {who === "manual" ? (
                  <View style={{ gap: 4 }}>
                    {members.filter((m: any) => m.user_id !== user?.id).map((m: any) => {
                      const on = manualIds.has(m.user_id);
                      return (
                        <Pressable key={m.user_id} testID={`quedada-member-${m.user_id}`} onPress={() => setManualIds((prev) => { const n = new Set(prev); if (n.has(m.user_id)) n.delete(m.user_id); else n.add(m.user_id); return n; })}
                          style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}>
                          <Ionicons name={on ? "checkbox" : "square-outline"} size={20} color={on ? colors.brandPrimary : BLUR_MUTED} />
                          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: m.color }} />
                          <T style={{ color: BLUR_TEXT, fontSize: 14 }}>{m.name}</T>
                        </Pressable>
                      );
                    })}
                    {members.length <= 1 ? <T style={{ color: BLUR_MUTED, fontSize: 12 }}>Aún no hay más miembros en el grupo.</T> : null}
                  </View>
                ) : null}
                <Button testID="quedada-create" title="Enviar quedada" onPress={() => create.mutate()} loading={create.isPending}
                  disabled={!name.trim() || (who === "manual" && manualIds.size === 0)} />
                <T style={{ color: BLUR_MUTED, fontSize: 11 }}>Cada invitado verá el aviso en su círculo y la quedada quedará pendiente de su confirmación.</T>
              </>
            ) : null}
          </ScrollView>
        </BlurCard>
      </Animated.View>
    </View>
  );
}
