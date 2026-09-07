// Native map canvas (react-native-maps). Web uses MapCanvas.web.tsx.
import Ionicons from "@react-native-vector-icons/ionicons";
import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import MapView, { Marker, Polyline, UrlTile } from "react-native-maps";

import { BASE } from "@/src/api";
import { PersonAvatar } from "@/src/components/orbs";
import { useTheme } from "@/src/theme";

import { incidentIcon, MapCanvasProps } from "@/src/components/mapTypes";

export * from "@/src/components/mapTypes";

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

export function MapCanvas({ people, pins = [], polyline, onPersonPress, center, zoomDelta = 0.01, onMapPress, onMapLongPress, onUserPan, selected, traffic, incidents = [], onIncidentPress }: MapCanvasProps) {
  const { scheme, colors } = useTheme();
  const ref = useRef<MapView>(null);
  const tiles = `${BASE}/mobility/tiles`;
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
        {/* Azure Maps base (road / dark) + optional traffic-flow layer, proxied by the backend; incidents are markers */}
        <UrlTile urlTemplate={`${tiles}/${scheme === "dark" ? "dark" : "road"}/{z}/{x}/{y}.png`} maximumZ={20} zIndex={-1} />
        {traffic ? <UrlTile urlTemplate={`${tiles}/traffic/{z}/{x}/{y}.png`} maximumZ={20} zIndex={1} /> : null}
        {incidents.map((i) => (
          <Marker key={i.id} coordinate={{ latitude: i.lat, longitude: i.lng }} onPress={() => onIncidentPress?.(i)} anchor={{ x: 0.5, y: 0.5 }} testID={`map-incident-${i.id}`}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: i.road_closed ? colors.error : colors.warning, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.glassStrong }}>
              <Ionicons name={incidentIcon(i) as any} size={14} color={i.road_closed ? colors.onError : colors.onWarning} />
            </View>
          </Marker>
        ))}
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
