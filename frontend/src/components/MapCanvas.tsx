// Native map canvas (react-native-maps). Web uses MapCanvas.web.tsx.
import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

import { PersonAvatar } from "@/src/components/orbs";
import { useTheme } from "@/src/theme";

export type MapPerson = { member_id: string; user_id: string; name: string; color: string; state: string; lat?: number; lng?: number; is_me?: boolean; label?: string; precision?: string; at?: string; status?: string | null };
export type MapPin = { id: string; lat: number; lng: number; title: string; color?: string };
export type LatLng = { lat: number; lng: number };

export type MapCanvasProps = {
  people: MapPerson[]; pins?: MapPin[]; polyline?: [number, number][]; onPersonPress?: (p: MapPerson) => void;
  /** Animates the camera whenever lat/lng/key change (key lets the caller re-center on the same coordinates). */
  center?: LatLng & { key?: number };
  /** Navigator-like zoom by default (~1 km). */
  zoomDelta?: number;
  /** Tap on the map (coordinate is undefined on web, where there is no real map). */
  onMapPress?: (c?: LatLng) => void;
  onMapLongPress?: (c: LatLng) => void;
  /** User dragged the map (native only) → callers typically stop following. */
  onUserPan?: () => void;
  selected?: LatLng | null;
};

const DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#0b1526" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8fa3bf" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b1526" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#071020" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
];
const LIGHT_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#dce4ec" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#475467" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#b9cbe0" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
];

export function MapCanvas({ people, pins = [], polyline, onPersonPress, center, zoomDelta = 0.01, onMapPress, onMapLongPress, onUserPan, selected }: MapCanvasProps) {
  const { scheme, colors } = useTheme();
  const ref = useRef<MapView>(null);
  const located = people.filter((p) => p.state === "shared" && p.lat != null);
  const me = located.find((p) => p.is_me);
  const c = center ?? (me ? { lat: me.lat!, lng: me.lng! } : located[0] ? { lat: located[0].lat!, lng: located[0].lng! } : { lat: 40.4168, lng: -3.7038 });
  useEffect(() => {
    if (center) ref.current?.animateToRegion({ latitude: center.lat, longitude: center.lng, latitudeDelta: zoomDelta, longitudeDelta: zoomDelta }, 600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.lat, center?.lng, center?.key]);
  const coord = (e: any) => ({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude });
  return (
    <View style={{ flex: 1, backgroundColor: colors.mapTint }} testID="map-canvas">
      <MapView ref={ref} style={{ flex: 1 }} customMapStyle={scheme === "dark" ? DARK_STYLE : LIGHT_STYLE} userInterfaceStyle={scheme}
        initialRegion={{ latitude: c.lat, longitude: c.lng, latitudeDelta: center ? zoomDelta : 0.06, longitudeDelta: center ? zoomDelta : 0.06 }}
        showsCompass={false} toolbarEnabled={false} showsMyLocationButton={false}
        onPress={(e) => { if ((e.nativeEvent as any).action === "marker-press") return; onMapPress?.(coord(e)); }}
        onLongPress={(e) => onMapLongPress?.(coord(e))} onPanDrag={onUserPan ? () => onUserPan() : undefined}>
        {located.map((p) => (
          <Marker key={p.member_id} coordinate={{ latitude: p.lat!, longitude: p.lng! }} onPress={() => onPersonPress?.(p)} anchor={{ x: 0.4, y: 0.6 }} testID={`map-person-${p.member_id}`}>
            <PersonAvatar name={p.name} color={p.color} state="shared" size={p.is_me ? 50 : 42} />
          </Marker>
        ))}
        {pins.map((p) => <Marker key={p.id} coordinate={{ latitude: p.lat, longitude: p.lng }} title={p.title} pinColor={p.color ?? colors.brandSecondary} />)}
        {selected ? <Marker coordinate={{ latitude: selected.lat, longitude: selected.lng }} pinColor={colors.brandPrimary} testID="map-selected-pin" /> : null}
        {polyline && polyline.length > 1 ? <Polyline coordinates={polyline.map(([lat, lng]) => ({ latitude: lat, longitude: lng }))} strokeColor={colors.brandSecondary} strokeWidth={4} /> : null}
      </MapView>
    </View>
  );
}
