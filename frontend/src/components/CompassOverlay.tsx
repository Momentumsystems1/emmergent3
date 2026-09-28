// Vista brújula de una cerca: al pulsar un círculo del mapa se abre este dial.
// En el centro, el radio efectivo (km) que cubre a todos; cada avatar se posiciona
// en el dial según su rumbo y distancia reales desde el centro de la cerca.
// Componente 100% react-native: funciona igual en web y en nativo.
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LatLng, MapCircle, MapPerson } from "@/src/components/mapTypes";
import { UserPhoto } from "@/src/components/UserPhoto";
import { fonts, useTheme } from "@/src/theme";

const SIZE = 300; // diámetro del dial
const R = SIZE / 2 - 26; // radio útil donde se dibujan avatares
const AV = 34; // tamaño de avatar en el dial

// Distancia haversine en metros.
function distM(a: LatLng, b: LatLng): number {
  const R2 = 6371000, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R2 * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Rumbo en grados (0 = Norte, 90 = Este) de a → b.
function bearingDeg(a: LatLng, b: LatLng): number {
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180, la2 = (b.lat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// Formato amable: 850 m / 1,2 km.
function fmtKm(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

export function CompassOverlay({ zone, people, onClose }: { zone: MapCircle; people: MapPerson[]; onClose: () => void }) {
  const { colors } = useTheme();
  const center: LatLng = { lat: zone.lat, lng: zone.lng };
  const inside = people.filter((p) => p.lat != null && p.lng != null);
  const maxD = inside.reduce((m, p) => Math.max(m, distM(center, { lat: p.lat!, lng: p.lng! })), 0);
  // Escala del dial: cubre el radio de la cerca Y al miembro más lejano (mínimo 50 m).
  const scale = Math.max(zone.radius_m, maxD, 50);

  return (
    <View style={st.backdrop} testID="compass-overlay">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar brújula" />
      <View style={[st.card, { backgroundColor: colors.card ?? "#1A1D24", borderColor: colors.border ?? "#2A2E37" }]}>
        <Text style={[st.title, { color: colors.onSurface }]} numberOfLines={1}>{zone.title}</Text>
        <View style={st.dialWrap}>
          {/* Anillos de referencia: 100 %, 66 % y 33 % de la escala */}
          {[1, 0.66, 0.33].map((f) => (
            <View key={f} style={[st.ring, { width: R * 2 * f, height: R * 2 * f, borderRadius: R * f, borderColor: f === 1 ? "rgba(52,168,83,0.65)" : "rgba(154,160,166,0.35)" }]} />
          ))}
          {/* Puntos cardinales (N en verde, como el norte de una brújula real) */}
          <Text style={[st.cardinal, { top: 2, color: "#34A853" }]}>N</Text>
          <Text style={[st.cardinal, { bottom: 2, color: colors.muted }]}>S</Text>
          <Text style={[st.cardinal, { right: 4, top: SIZE / 2 - 10, color: colors.muted }]}>E</Text>
          <Text style={[st.cardinal, { left: 4, top: SIZE / 2 - 10, color: colors.muted }]}>O</Text>
          {/* Avatares posicionados por rumbo y distancia */}
          {inside.map((p) => {
            const d = distM(center, { lat: p.lat!, lng: p.lng! });
            const b = (bearingDeg(center, { lat: p.lat!, lng: p.lng! }) * Math.PI) / 180;
            const frac = Math.min(d / scale, 0.96);
            const x = SIZE / 2 + R * frac * Math.sin(b) - AV / 2;
            const y = SIZE / 2 - R * frac * Math.cos(b) - AV / 2;
            return (
              <View key={p.member_id} style={{ position: "absolute", left: x, top: y, width: AV, alignItems: "center" }}>
                <UserPhoto userId={p.user_id} name={p.name} color={p.color || colors.brandPrimary} size={AV} hasPhoto={!!p.photo_url} ring={!!p.is_me} />
                <Text style={[st.avName, { color: colors.onSurface }]} numberOfLines={1}>{p.is_me ? "Tú" : p.name.split(" ")[0]}</Text>
                <Text style={[st.avDist, { color: colors.muted }]}>{fmtKm(d)}</Text>
              </View>
            );
          })}
          {/* Píldora central: radio efectivo que cubre a todos */}
          <View style={[st.pill, { backgroundColor: colors.brandPrimary }]}>
            <Text style={st.pillBig}>{fmtKm(scale)}</Text>
            <Text style={st.pillSmall}>radio del círculo</Text>
          </View>
        </View>
        {inside.length === 0 ? (
          <Text style={[st.empty, { color: colors.muted }]}>Nadie del círculo comparte su posición ahora mismo</Text>
        ) : null}
        <Pressable onPress={onClose} style={[st.close, { borderColor: colors.border ?? "#2A2E37" }]} accessibilityRole="button">
          <Text style={{ color: colors.onSurface, fontFamily: fonts.semibold, fontSize: 14 }}>Cerrar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", zIndex: 40 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, alignItems: "center", width: SIZE + 32 },
  title: { fontFamily: fonts.bold, fontSize: 16, marginBottom: 10 },
  dialWrap: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", borderWidth: 1 },
  cardinal: { position: "absolute", fontFamily: fonts.bold, fontSize: 12 },
  avName: { fontFamily: fonts.semibold, fontSize: 9, marginTop: 1, maxWidth: 56 },
  avDist: { fontFamily: fonts.regular, fontSize: 8 },
  pill: { alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  pillBig: { color: "#fff", fontFamily: fonts.bold, fontSize: 16 },
  pillSmall: { color: "rgba(255,255,255,0.85)", fontFamily: fonts.regular, fontSize: 9 },
  empty: { fontFamily: fonts.regular, fontSize: 12, marginTop: 10, textAlign: "center" },
  close: { marginTop: 12, borderWidth: 1, borderRadius: 10, paddingHorizontal: 22, paddingVertical: 9 },
});
