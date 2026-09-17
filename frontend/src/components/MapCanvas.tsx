// Native map canvas (react-native-maps). Web uses MapCanvas.web.tsx.
import Ionicons from "@react-native-vector-icons/ionicons";
import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import MapView, { Marker, Polyline, UrlTile } from "react-native-maps";

import { BASE } from "@/src/api";
import { UserPhoto } from "@/src/components/UserPhoto";
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

export function MapCanvas({ people, pins = [], polyline, onPersonPress, center, zoomDelta = 0.01, onMapPress, onMapLongPress, onUserPan, selected, traffic, incidents = [], onIncidentPress, pitch3d = 50, followMode = "off", deviceHeading = 0, onHeadingChange }: MapCanvasProps) {
  const { scheme, colors } = useTheme();
  const ref = useRef<MapView>(null);
  const tiles = `${BASE}/mobility/tiles`;
  const located = people.filter((p) => p.state === "shared" && p.lat != null);
  const me = located.find((p) => p.is_me);
  const c = center ?? (me ? { lat: me.lat!, lng: me.lng! } : located[0] ? { lat: located[0].lat!, lng: located[0].lng! } : { lat: 40.4168, lng: -3.7038 });
  const zoom = Math.log2(360 / zoomDelta);
  // 3D perspective: pitched camera + buildings; the "me" marker is flat (anchored to the ground) so it rotates/scales with
  // the map's perspective and zoom instead of floating as a screen-space billboard.
  useEffect(() => {
    if (center) ref.current?.animateCamera({ center: { latitude: center.lat, longitude: center.lng }, pitch: pitch3d, zoom, heading: 0 }, { duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.lat, center?.lng, center?.key]);
  // Compass / heading mode: rotate the camera to follow the phone's heading while keeping the user centered.
  useEffect(() => {
    if (followMode === "heading" && me) ref.current?.animateCamera({ center: { latitude: me.lat!, longitude: me.lng! }, pitch: pitch3d, zoom, heading: deviceHeading }, { duration: 300 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceHeading, followMode, me?.lat, me?.lng]);
  const coord = (e: any) => ({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude });
  const reportHeading = async () => { try { const cam = await ref.current?.getCamera(); onHeadingChange?.(cam?.heading ?? 0); } catch { /* noop */ } };
  return (
    <View style={{ flex: 1, backgroundColor: colors.mapTint }} testID="map-canvas">
      <MapView ref={ref} style={{ flex: 1 }} customMapStyle={scheme === "dark" ? DARK_STYLE : LIGHT_STYLE} userInterfaceStyle={scheme}
        initialCamera={{ center: { latitude: c.lat, longitude: c.lng }, pitch: pitch3d, heading: 0, zoom: Math.log2(360 / (center ? zoomDelta : 0.06)), altitude: 1200 }}
        showsBuildings pitchEnabled rotateEnabled showsCompass={false} toolbarEnabled={false} showsMyLocationButton={false}
        onRegionChangeComplete={onHeadingChange ? reportHeading : undefined}
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
          <Marker key={p.member_id} coordinate={{ latitude: p.lat!, longitude: p.lng! }} onPress={() => onPersonPress?.(p)} anchor={{ x: 0.5, y: p.is_me ? 0.5 : 0.5 }} flat={!!p.is_me} testID={`map-person-${p.member_id}`}>
            {p.is_me ? (
              <View style={{ width: 76, height: 76, alignItems: "center", justifyContent: "center" }}>
                <View style={{ position: "absolute", width: 76, height: 76, borderRadius: 38, backgroundColor: p.color, opacity: 0.16 }} />
                <View style={{ position: "absolute", width: 52, height: 52, borderRadius: 26, backgroundColor: p.color, opacity: 0.3 }} />
                <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: p.color, overflow: "hidden", backgroundColor: colors.surfaceSecondary, shadowColor: colors.surfaceInverse, shadowOpacity: 0.4, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 5 }}>
                  <UserPhoto userId={p.user_id} name={p.name} color={p.color} size={38} hasPhoto={p.has_photo} />
                </View>
              </View>
            ) : (
              <View style={{ alignItems: "center" }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2.5, borderColor: p.state === "shared" ? p.color : colors.pending, overflow: "hidden", backgroundColor: colors.surfaceSecondary, shadowColor: colors.surfaceInverse, shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4 }}>
                  <UserPhoto userId={p.user_id} name={p.name} color={p.state === "shared" ? p.color : colors.pending} size={35} hasPhoto={p.has_photo} />
                </View>
                <View style={{ width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: p.state === "shared" ? p.color : colors.pending, marginTop: -1 }} />
              </View>
            )}
          </Marker>
        ))}
        {pins.map((p) => (
          p.icon
            ? <Marker key={p.id} coordinate={{ latitude: p.lat, longitude: p.lng }} title={p.title} onPress={p.onPress} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} testID={`map-poi-${p.id}`}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: p.color ?? colors.brandSecondary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.glassStrong }}>
                  <Ionicons name={p.icon as any} size={15} color={colors.onBrandSecondary} />
                </View>
              </Marker>
            : <Marker key={p.id} coordinate={{ latitude: p.lat, longitude: p.lng }} title={p.title} pinColor={p.color ?? colors.brandSecondary} />
        ))}
        {selected ? <Marker coordinate={{ latitude: selected.lat, longitude: selected.lng }} pinColor={colors.brandPrimary} testID="map-selected-pin" /> : null}
        {polyline && polyline.length > 1 ? <Polyline coordinates={polyline.map(([lat, lng]) => ({ latitude: lat, longitude: lng }))} strokeColor={colors.brandSecondary} strokeWidth={4} /> : null}
      </MapView>
    </View>
  );
}
