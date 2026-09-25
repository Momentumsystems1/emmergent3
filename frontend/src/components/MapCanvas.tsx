// Native map canvas (react-native-maps). Web uses MapCanvas.web.tsx.
import Ionicons from "@react-native-vector-icons/ionicons";
import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import MapView, { Circle, Marker, Polyline, UrlTile } from "react-native-maps";

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

export function MapCanvas({ people, pins = [], polyline, circles = [], draftCircle, onPersonPress, center, zoomDelta = 0.01, onMapPress, onMapLongPress, onUserPan, selected, traffic, incidents = [], onIncidentPress, pitch3d = 50 }: MapCanvasProps) {
  const { scheme, colors } = useTheme();
  const ref = useRef<MapView>(null);
  const tiles = `${BASE}/mobility/tiles`;
  const located = people.filter((p) => p.state === "shared" && p.lat != null);
  const me = located.find((p) => p.is_me);
  const c = center ?? (me ? { lat: me.lat!, lng: me.lng! } : located[0] ? { lat: located[0].lat!, lng: located[0].lng! } : { lat: 40.4168, lng: -3.7038 });
  // 3D perspective: pitched camera + buildings; the "me" marker is flat (anchored to the ground) so it rotates/scales with
  // the map's perspective and zoom instead of floating as a screen-space billboard.
  useEffect(() => {
    if (center) ref.current?.animateCamera({ center: { latitude: center.lat, longitude: center.lng }, pitch: pitch3d, zoom: Math.log2(360 / zoomDelta), heading: 0 }, { duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.lat, center?.lng, center?.key]);
  const coord = (e: any) => ({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude });
  return (
    <View style={{ flex: 1, backgroundColor: colors.mapTint }} testID="map-canvas">
      <MapView ref={ref} style={{ flex: 1 }} customMapStyle={scheme === "dark" ? DARK_STYLE : LIGHT_STYLE} userInterfaceStyle={scheme}
        initialCamera={{ center: { latitude: c.lat, longitude: c.lng }, pitch: pitch3d, heading: 0, zoom: Math.log2(360 / (center ? zoomDelta : 0.06)), altitude: 1200 }}
        showsBuildings pitchEnabled rotateEnabled showsCompass={false} toolbarEnabled={false} showsMyLocationButton={false}
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
          <Marker key={p.member_id} coordinate={{ latitude: p.lat!, longitude: p.lng! }} onPress={() => onPersonPress?.(p)} anchor={p.is_me ? { x: 0.5, y: 0.5 } : { x: 0.4, y: 0.6 }} flat={!!p.is_me} testID={`map-person-${p.member_id}`}>
            {p.is_me ? (
              <View style={{ width: 64, height: 64, alignItems: "center", justifyContent: "center" }}>
                <View style={{ position: "absolute", width: 64, height: 64, borderRadius: 32, backgroundColor: p.color, opacity: 0.18 }} />
                <View style={{ position: "absolute", width: 40, height: 40, borderRadius: 20, backgroundColor: p.color, opacity: 0.35 }} />
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: p.color, borderWidth: 3, borderColor: colors.glassStrong, shadowColor: colors.surfaceInverse, shadowOpacity: 0.4, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4 }} />
              </View>
            ) : <PersonAvatar name={p.name} color={p.color} state="shared" size={42} />}
          </Marker>
        ))}
        {pins.map((p) => <Marker key={p.id} coordinate={{ latitude: p.lat, longitude: p.lng }} title={p.title} pinColor={p.color ?? colors.brandSecondary} />)}
        {/* Cercas del grupo: círculo translúcido + borde; el borrador de cerca en edición va encima en azul */}
        {circles.map((z) => (
          <Circle key={z.id} center={{ latitude: z.lat, longitude: z.lng }} radius={z.radius_m}
            strokeColor={z.active === false ? "rgba(120,130,140,0.7)" : (z.occupied ? "rgba(22,163,74,0.9)" : "rgba(225,29,72,0.85)")}
            fillColor={z.active === false ? "rgba(120,130,140,0.08)" : (z.occupied ? "rgba(22,163,74,0.10)" : "rgba(225,29,72,0.10)")}
            strokeWidth={2} testID={`map-zone-${z.id}`} />
        ))}
        {draftCircle ? (
          <Circle center={{ latitude: draftCircle.lat, longitude: draftCircle.lng }} radius={draftCircle.radius_m}
            strokeColor={draftCircle.color ?? "#1A73E8"} fillColor="rgba(26,115,232,0.14)" strokeWidth={2.5}
            testID="map-draft-circle" />
        ) : null}
        {selected ? <Marker coordinate={{ latitude: selected.lat, longitude: selected.lng }} pinColor={colors.brandPrimary} testID="map-selected-pin" /> : null}
        {polyline && polyline.length > 1 ? <Polyline coordinates={polyline.map(([lat, lng]) => ({ latitude: lat, longitude: lng }))} strokeColor={colors.brandSecondary} strokeWidth={4} /> : null}
      </MapView>
    </View>
  );
}
