// Web renderer: REAL interactive Google Map (Maps JavaScript API).
// This file is only bundled for web — plain DOM is intentional.
import React, { useEffect, useRef } from "react";

import { incidentIcon, LatLng, MapCanvasProps, MapPerson } from "@/src/components/mapTypes";

export * from "@/src/components/mapTypes";

const KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? "";

let loaderPromise: Promise<any> | null = null;
function loadGoogle(): Promise<any> {
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    const w = window as any;
    if (w.google?.maps) return resolve(w.google);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${KEY}&language=es&region=ES`;
    s.async = true;
    s.onload = () => resolve((window as any).google);
    s.onerror = () => reject(new Error("No se pudo cargar Google Maps"));
    document.head.appendChild(s);
  });
  return loaderPromise;
}

function personIcon(p: MapPerson): string {
  const initial = (p.name || "?").trim().charAt(0).toUpperCase();
  const color = p.color || "#06AED5";
  const size = p.is_me ? 52 : 44;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 8}" viewBox="0 0 ${size} ${size + 8}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${color}" stroke="white" stroke-width="3"/>
    <text x="50%" y="${size / 2}" dy="6" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="${size / 2.4}" fill="white">${initial}</text>
    <polygon points="${size / 2 - 6},${size - 2} ${size / 2 + 6},${size - 2} ${size / 2},${size + 6}" fill="${color}"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function MapCanvas({ people, pins = [], polyline, onPersonPress, center, zoomDelta = 0.01, onMapPress, onMapLongPress, selected, incidents = [], onIncidentPress }: MapCanvasProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const pinMarkersRef = useRef<any[]>([]);
  const selMarkerRef = useRef<any>(null);
  const lineRef = useRef<any>(null);
  const incMarkersRef = useRef<any[]>([]);
  const readyRef = useRef(false);
  const [, force] = React.useReducer((x) => x + 1, 0);

  // init once
  useEffect(() => {
    let cancelled = false;
    loadGoogle().then((google) => {
      if (cancelled || !ref.current) return;
      const located = people.filter((p) => p.state === "shared" && p.lat != null);
      const start = center ?? (located[0] ? { lat: located[0].lat!, lng: located[0].lng! } : { lat: 40.4168, lng: -3.7038 });
      const map = new google.maps.Map(ref.current, {
        center: { lat: start.lat, lng: start.lng },
        zoom: center ? 15 : 12,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: "greedy",
        clickableIcons: false,
        styles: [
          { featureType: "poi.business", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "simplified" }] },
        ],
      });
      map.addListener("click", (e: any) => onMapPress?.({ lat: e.latLng.lat(), lng: e.latLng.lng() }));
      map.addListener("rightclick", (e: any) => onMapLongPress?.({ lat: e.latLng.lat(), lng: e.latLng.lng() }));
      mapRef.current = map;
      readyRef.current = true;
      force();
    }).catch(() => null);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // camera follow
  useEffect(() => {
    if (!readyRef.current || !mapRef.current || !center) return;
    mapRef.current.panTo({ lat: center.lat, lng: center.lng });
    if (zoomDelta) {
      const z = zoomDelta <= 0.005 ? 16 : zoomDelta <= 0.02 ? 15 : 13;
      mapRef.current.setZoom(z);
    }
  }, [center?.lat, center?.lng, (center as any)?.key]);

  // people markers
  useEffect(() => {
    if (!readyRef.current || !mapRef.current) return;
    const google = (window as any).google;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    people.filter((p) => p.state === "shared" && p.lat != null).forEach((p) => {
      const m = new google.maps.Marker({
        position: { lat: p.lat!, lng: p.lng! },
        map: mapRef.current,
        title: p.name,
        icon: { url: personIcon(p), scaledSize: new google.maps.Size(p.is_me ? 52 : 44, p.is_me ? 60 : 52), anchor: new google.maps.Point(p.is_me ? 26 : 22, p.is_me ? 58 : 50) },
        zIndex: p.is_me ? 10 : 5,
      });
      m.addListener("click", () => onPersonPress?.(p));
      markersRef.current.push(m);
    });
  }, [JSON.stringify(people.map((p) => [p.member_id, p.lat, p.lng, p.name, p.color, p.is_me]))]);

  // pins + selected
  useEffect(() => {
    if (!readyRef.current || !mapRef.current) return;
    const google = (window as any).google;
    pinMarkersRef.current.forEach((m) => m.setMap(null));
    pinMarkersRef.current = pins.map((pin) => new google.maps.Marker({ position: { lat: pin.lat, lng: pin.lng }, map: mapRef.current, title: pin.title }));
    if (selMarkerRef.current) selMarkerRef.current.setMap(null);
    selMarkerRef.current = selected
      ? new google.maps.Marker({ position: { lat: selected.lat, lng: selected.lng }, map: mapRef.current, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#06AED5", fillOpacity: 1, strokeColor: "white", strokeWeight: 2 } })
      : null;
  }, [JSON.stringify(pins), selected?.lat, selected?.lng]);

  // polyline
  useEffect(() => {
    if (!readyRef.current || !mapRef.current) return;
    const google = (window as any).google;
    if (lineRef.current) lineRef.current.setMap(null);
    lineRef.current = polyline && polyline.length > 1
      ? new google.maps.Polyline({ path: polyline.map(([lat, lng]) => ({ lat, lng })), map: mapRef.current, strokeColor: "#06AED5", strokeWeight: 4, strokeOpacity: 0.85 })
      : null;
  }, [JSON.stringify(polyline)]);

  // incidents
  useEffect(() => {
    if (!readyRef.current || !mapRef.current) return;
    const google = (window as any).google;
    incMarkersRef.current.forEach((m) => m.setMap(null));
    incMarkersRef.current = incidents.map((i) => {
      const m = new google.maps.Marker({
        position: { lat: i.lat, lng: i.lng }, map: mapRef.current, title: i.title ?? i.type,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: i.road_closed ? "#EF4444" : "#F59E0B", fillOpacity: 1, strokeColor: "white", strokeWeight: 2 },
      });
      m.addListener("click", () => onIncidentPress?.(i));
      return m;
    });
  }, [JSON.stringify(incidents)]);

  return <div ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} data-testid="map-canvas" />;
}
