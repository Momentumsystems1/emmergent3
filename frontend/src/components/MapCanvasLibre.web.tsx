// Renderer web por defecto: MapLibre GL + teselas vectoriales libres (OpenFreeMap / OpenStreetMap).
// Sin claves de API, sin restricciones de referrer, sin consola de Google: el mapa SIEMPRE carga.
// Look tipo navegador (referencia Waze): estilo claro propio, apertura cinematográfica en 3D
// (pitch 60) hacia el usuario, edificios 3D y marcadores HTML con avatar (foto + nombre + calle).
// MapLibre se carga por inyección de script desde CDN (mismo patrón que el loader de Google):
// cero riesgo de bundling en Metro y cero dependencias npm nuevas.
import React, { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

import { api, loadTokens } from "@/src/api";
import { LatLng, MapCanvasProps, MapPerson } from "@/src/components/mapTypes";
import { ensureMcStyles, personHtml, StaticMapCanvas } from "@/src/components/MapCanvas.web";
import { fonts, useTheme } from "@/src/theme";

const ML_VERSION = "5.6.0";
const ML_JS = `https://cdn.jsdelivr.net/npm/maplibre-gl@${ML_VERSION}/dist/maplibre-gl.js`;
const ML_CSS = `https://cdn.jsdelivr.net/npm/maplibre-gl@${ML_VERSION}/dist/maplibre-gl.css`;
// Estilo propio "MY CLUSTER Claro" (servido desde nuestra web): base OpenMapTiles/OSM
// con colores claros tipo navegador, nombres de calle y números de portal. Si no
// respondiera, cae al estilo claro público de OpenFreeMap (mismo schema y glifos).
const STYLE_URL = "https://momentumsystems1.github.io/styles/cluster-light.json";
const STYLE_FALLBACK_URL = "https://tiles.openfreemap.org/styles/positron";
const FOLLOW_ZOOM = 18.5; // zoom alto de seguimiento (hito: avatar centrado y cercano)
const PITCH_3D = 60; // perspectiva 3D tipo navegador
const FALLBACK_CENTER = { lat: 40.4168, lng: -3.7038 }; // Puerta del Sol
// Modo conducción: zoom se interpola con la velocidad y la cámara mira hacia el rumbo.
const DRIVE_ZOOM = 15.2; // zoom a velocidad alta (más horizonte)
const DRIVE_SPEED_MAX = 100; // km/h a los que se alcanza DRIVE_ZOOM
const DRIVE_SPEED_MIN = 10; // por debajo no se considera conducción
const DRIVE_LOOKAHEAD_Y = 120; // px de ventaja hacia delante (el avatar queda bajo el centro)
// Anclaje inteligente del toque: POI con nombre o proyección sobre la calle más cercana.
const SNAP_PX = 26; // radio de búsqueda de establecimientos alrededor del toque
const SNAP_ROAD_MAX_M = 60; // distancia máxima para anclar a una calle

// Proyección equirectangular local (metros) suficiente para distancias de anclaje.
function toMeters(lat: number, lng: number, ref: LatLng): [number, number] {
  const cosLat = Math.cos((ref.lat * Math.PI) / 180);
  return [(lng - ref.lng) * 111320 * cosLat, (lat - ref.lat) * 110540];
}
function fromMeters(x: number, y: number, ref: LatLng): LatLng {
  const cosLat = Math.cos((ref.lat * Math.PI) / 180);
  return { lat: ref.lat + y / 110540, lng: ref.lng + x / (111320 * cosLat) };
}

/** Ancla un toque al lugar más lógico: establecimiento con nombre cercano o punto sobre la calle más próxima. */
function snapToLogicalPlace(map: any, e: any): LatLng {
  const tap: LatLng = { lat: e.lngLat.lat, lng: e.lngLat.lng };
  try {
    const bbox: [[number, number], [number, number]] = [
      [e.point.x - SNAP_PX, e.point.y - SNAP_PX],
      [e.point.x + SNAP_PX, e.point.y + SNAP_PX],
    ];
    const feats: any[] = map.queryRenderedFeatures(bbox).filter((f: any) => f.sourceLayer);
    // 1) Establecimiento (feature puntual con nombre) más cercano al toque.
    let bestPoi: { d: number; lat: number; lng: number } | null = null;
    for (const f of feats) {
      if (f.geometry?.type !== "Point" || !f.properties?.name) continue;
      const [lng, lat] = f.geometry.coordinates;
      const p = map.project([lng, lat]);
      const d = Math.hypot(p.x - e.point.x, p.y - e.point.y);
      if (!bestPoi || d < bestPoi.d) bestPoi = { d, lat, lng };
    }
    if (bestPoi) return { lat: bestPoi.lat, lng: bestPoi.lng };
    // 2) Proyección sobre el segmento de calle más cercano (el toque es el origen local).
    let bestRoad: { d: number; x: number; y: number } | null = null;
    for (const f of feats) {
      const g = f.geometry;
      if (g?.type !== "LineString" && g?.type !== "MultiLineString") continue;
      const lines = g.type === "LineString" ? [g.coordinates] : g.coordinates;
      for (const line of lines) {
        for (let i = 0; i < line.length - 1; i++) {
          const [ax, ay] = toMeters(line[i][1], line[i][0], tap);
          const [bx, by] = toMeters(line[i + 1][1], line[i + 1][0], tap);
          const dx = bx - ax, dy = by - ay;
          const len2 = dx * dx + dy * dy;
          const t = len2 > 0 ? Math.max(0, Math.min(1, (-ax * dx - ay * dy) / len2)) : 0;
          const px = ax + t * dx, py = ay + t * dy;
          const d = Math.hypot(px, py);
          if (!bestRoad || d < bestRoad.d) bestRoad = { d, x: px, y: py };
        }
      }
    }
    if (bestRoad && bestRoad.d <= SNAP_ROAD_MAX_M) {
      return fromMeters(bestRoad.x, bestRoad.y, tap);
    }
  } catch { /* sin capas vectoriales aún: se devuelve el toque tal cual */ }
  return tap;
}

/** Estilos del cono de visión (modo conducción): triángulo translúcido sobre el avatar propio. */
let coneStylesDone = false;
function ensureConeStyles() {
  if (coneStylesDone || typeof document === "undefined") return;
  coneStylesDone = true;
  const st = document.createElement("style");
  st.textContent = `.mc-cone-wrap{position:relative}.mc-cone{position:absolute;left:50%;top:-26px;transform:translateX(-50%);width:0;height:0;border-left:15px solid transparent;border-right:15px solid transparent;border-bottom:38px solid rgba(26,115,232,.38);pointer-events:none}`;
  document.head.appendChild(st);
}

declare global { interface Window { maplibregl?: any; __mcMlPromise?: Promise<any> } }

function loadMapLibre(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (window.__mcMlPromise) return window.__mcMlPromise;
  window.__mcMlPromise = new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = ML_CSS;
    document.head.appendChild(link);
    const s = document.createElement("script");
    s.src = ML_JS;
    s.async = true;
    s.onload = () => (window.maplibregl ? resolve(window.maplibregl) : reject(new Error("maplibre not present")));
    s.onerror = () => reject(new Error("maplibre script error"));
    document.head.appendChild(s);
  });
  return window.__mcMlPromise;
}

// Círculo geográfico como polígono de 64 puntos (MapLibre no tiene geometría Circle nativa).
function circleRing(lat: number, lng: number, radiusM: number, n = 64): [number, number][] {
  const pts: [number, number][] = [];
  const cosLat = Math.cos((lat * Math.PI) / 180);
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI;
    pts.push([lng + (radiusM * Math.sin(a)) / (111320 * cosLat), lat + (radiusM * Math.cos(a)) / 110540]);
  }
  return pts;
}

// Edificios 3D: capa fill-extrusion sobre la source-layer "building" del estilo (schema OpenMapTiles).
function add3dBuildings(map: any) {
  try {
    const style = map.getStyle();
    const srcName = Object.keys(style.sources).find((k) => style.sources[k].type === "vector");
    if (!srcName) return;
    const firstSymbol = style.layers.find((l: any) => l.type === "symbol" && l.layout && l.layout["text-field"]);
    map.addLayer(
      {
        id: "mc-3d-buildings",
        type: "fill-extrusion",
        source: srcName,
        "source-layer": "building",
        minzoom: 14.5,
        paint: {
          "fill-extrusion-color": "#d9d5cf",
          "fill-extrusion-height": ["coalesce", ["get", "render_height"], ["get", "height"], 8],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 0.55,
        },
      },
      firstSymbol?.id,
    );
  } catch { /* estilo sin edificios: se queda plano, no pasa nada */ }
}

// Caché de geocodificación inversa (calle de cada avatar), igual que en el renderer de Google.
const streetCache = new Map<string, { t: number; s: string }>();
const STREET_TTL = 10 * 60 * 1000;
const streetKey = (p: MapPerson) => `${p.member_id}:${(p.lat ?? 0).toFixed(4)}:${(p.lng ?? 0).toFixed(4)}`;

export function MapLibreCanvas(props: MapCanvasProps) {
  const {
    people, pins = [], polyline, circles = [], draftCircle,
    onPersonPress, center, onMapPress, onMapLongPress, onCirclePress, drive, onUserPan, onMoveChange,
    selected, incidents = [], onIncidentPress,
  } = props;
  const { colors, scheme } = useTheme();
  const hostRef = useRef<View>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef(new Map<string, any>());
  const labelMarkersRef = useRef(new Map<string, any>());
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [streets, setStreets] = useState<Record<string, string>>({});
  const pulsePhase = useRef(0);
  const located = people.filter((p) => p.lat != null && p.lng != null);

  // Refresco de handlers: el boot corre una sola vez, pero los handlers deben ver siempre el render actual.
  const handlersRef = useRef({ onMapPress, onMapLongPress, onCirclePress, onUserPan, onMoveChange, circles });
  handlersRef.current = { onMapPress, onMapLongPress, onCirclePress, onUserPan, onMoveChange, circles };

  // ---- boot (una vez) ----
  useEffect(() => {
    let dead = false;
    let lpTimer: any = null;
    let lpAt = 0; // instante de la última pulsación larga (ratón: el clic llega al instante)
    let lpPending = false; // una pulsación larga ya se ejecutó: el clic de cierre se consume
    let touchUntil = 0; // tras un touchend, Chrome dispara mousedown/click de compatibilidad ~0,7 s después: se ignoran
    loadMapLibre()
      .then(async (ml) => {
        if (dead || !hostRef.current) return;
        ensureMcStyles();
        loadTokens().then((t) => !dead && setToken(t?.access_token ?? null)).catch(() => {});
        const c = center ?? FALLBACK_CENTER;
        // Estilo propio con respaldo: si el JSON hospedado no responde, se usa el claro público.
        const style: any = await fetch(STYLE_URL)
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error("style http"))))
          .catch(() => STYLE_FALLBACK_URL);
        if (dead || !hostRef.current) return;
        const map = new ml.Map({
          container: hostRef.current as any,
          style,
          center: [c.lng, c.lat],
          zoom: center ? 13.5 : 11,
          pitch: 0,
          bearing: 0,
          maxPitch: 85,
          attributionControl: { compact: true },
        });
        map.addControl(new ml.NavigationControl({ visualizePitch: true, showCompass: true }), "bottom-left");
        map.on("load", () => {
          if (dead) return;
          add3dBuildings(map);
          mapRef.current = map;
          setReady(true);
          // Apertura "tipo Waze": la cámara baja en 3D hasta el avatar.
          if (center) {
            setTimeout(() => {
              if (dead || !mapRef.current) return;
              map.flyTo({ center: [c.lng, c.lat], zoom: FOLLOW_ZOOM, pitch: PITCH_3D, bearing: 0, duration: 2600, essential: true });
            }, 350);
          }
        });
        map.on("click", (e: any) => {
          // Tras una pulsación larga, el clic de cierre se consume: con ratón llega al instante;
          // con el dedo es el clic de compatibilidad que Chrome manda tras el touchend.
          if (lpPending && (Date.now() - lpAt < 2500 || Date.now() < touchUntil)) { lpPending = false; return; }
          const h = handlersRef.current;
          // 1) ¿Toque sobre una cerca? → vista brújula del círculo (y no se planta pin).
          try {
            if (mapRef.current?.getLayer("mc-circles-fill")) {
              const hit = map.queryRenderedFeatures(e.point, { layers: ["mc-circles-fill"] });
              const c = hit?.length ? h.circles.find((x) => x.id === (hit[0].properties as any)?.id) : undefined;
              if (c && h.onCirclePress) { h.onCirclePress(c); return; }
            }
          } catch { /* capa aún no lista: sigue el flujo normal */ }
          // 2) Toque normal: se ancla al lugar más lógico (establecimiento o calle).
          h.onMapPress?.(snapToLogicalPlace(map, e));
        });
        map.on("dragstart", () => handlersRef.current.onUserPan?.());
        map.on("movestart", () => handlersRef.current.onMoveChange?.(true));
        map.on("moveend", () => handlersRef.current.onMoveChange?.(false));
        // Pulsación larga con ratón Y con el dedo (touchstart): sin esto, en el móvil no existía.
        const startLp = (e: any) => { clearTimeout(lpTimer); lpTimer = setTimeout(() => { lpPending = true; lpAt = Date.now(); handlersRef.current.onMapLongPress?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }); }, 550); };
        map.on("mousedown", (e: any) => { if (Date.now() < touchUntil) return; startLp(e); });
        map.on("touchstart", (e: any) => { if (e.points?.length > 1) { clearTimeout(lpTimer); return; } startLp(e); });
        map.on("touchend", () => { touchUntil = Date.now() + 1500; });
        ["mouseup", "dragstart", "touchend", "touchcancel"].forEach((ev) => map.on(ev, () => clearTimeout(lpTimer)));
        map.on("error", () => { /* errores puntuales de tesela: MapLibre reintenta solo */ });
      })
      .catch(() => setFailed(true));
    return () => {
      dead = true;
      clearTimeout(lpTimer);
      markersRef.current.forEach((m) => m.remove?.());
      markersRef.current.clear();
      labelMarkersRef.current.forEach((m) => m.remove?.());
      labelMarkersRef.current.clear();
      mapRef.current?.remove?.();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- cámara de seguimiento: zoom alto + pitch 3D; en conducción, rumbo y zoom por velocidad ----
  useEffect(() => {
    if (!ready || !center || !mapRef.current) return;
    const spd = drive?.speedKmh ?? null;
    const driving = drive != null && spd != null && spd > DRIVE_SPEED_MIN;
    if (driving) {
      // A más velocidad, más lejos (más horizonte); el rumbo gira el mapa (heading-up).
      const f = Math.min(1, Math.max(0, (spd! - 0) / DRIVE_SPEED_MAX));
      const zoom = FOLLOW_ZOOM + (DRIVE_ZOOM - FOLLOW_ZOOM) * f;
      const opts: any = { center: [center.lng, center.lat], zoom, pitch: PITCH_3D, duration: 900, offset: [0, DRIVE_LOOKAHEAD_Y] };
      if (drive!.heading != null) opts.bearing = drive!.heading;
      mapRef.current.easeTo(opts);
    } else {
      mapRef.current.easeTo({ center: [center.lng, center.lat], zoom: FOLLOW_ZOOM, pitch: PITCH_3D, duration: 900, offset: [0, 0] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, center?.lat, center?.lng, center?.key, drive?.speedKmh, drive?.heading]);

  // ---- calle de cada persona (geocodificación inversa con caché) ----
  useEffect(() => {
    if (!ready) return;
    const now = Date.now();
    for (const p of located) {
      if (p.lat == null || p.lng == null) continue;
      const k = streetKey(p);
      const hit = streetCache.get(k);
      if (hit && now - hit.t < STREET_TTL) {
        if (streets[p.member_id] !== hit.s) setStreets((prev) => ({ ...prev, [p.member_id]: hit.s }));
        continue;
      }
      api<{ short?: string }>(`/mobility/reverse?lat=${p.lat}&lng=${p.lng}`)
        .then((r) => {
          const s = r?.short;
          if (!s) return;
          streetCache.set(k, { t: Date.now(), s });
          setStreets((prev) => (prev[p.member_id] === s ? prev : { ...prev, [p.member_id]: s }));
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, JSON.stringify(located.map((p) => [p.member_id, p.lat, p.lng]))]);

  // ---- marcadores HTML: personas (avatar foto+nombre+calle), pins, incidencias, selección ----
  useEffect(() => {
    if (!ready || !mapRef.current || !window.maplibregl) return;
    const ml = window.maplibregl;
    const map = mapRef.current;
    const alive = new Set<string>();
    ensureConeStyles();

    const upsertHtml = (id: string, lng: number, lat: number, html: string, key: string, onClick?: () => void) => {
      alive.add(id);
      let m = markersRef.current.get(id);
      if (m && m.__mcKey === key) { m.setLngLat([lng, lat]); return; }
      if (m) { m.remove(); markersRef.current.delete(id); }
      ensureMcStyles();
      const wrap = document.createElement("div");
      wrap.innerHTML = html;
      const el = wrap.firstElementChild as HTMLElement;
      if (scheme === "dark") el.classList.add("mc-dark");
      if (onClick) el.addEventListener("click", (ev) => { ev.stopPropagation(); onClick(); });
      m = new ml.Marker({ element: el, anchor: "bottom" }).setLngLat([lng, lat]).addTo(map);
      m.__mcKey = key;
      markersRef.current.set(id, m);
    };

    located.forEach((p) => {
      const { html, key } = personHtml(p, streets[p.member_id], token);
      // En conducción, mi avatar lleva un cono de visión (el mapa gira al rumbo → el cono siempre apunta "arriba").
      const drivingMe = p.is_me && drive?.heading != null && (drive?.speedKmh ?? 0) > DRIVE_SPEED_MIN;
      const finalHtml = drivingMe ? `<div class="mc-cone-wrap"><div class="mc-cone"></div>${html}</div>` : html;
      upsertHtml(`person-${p.member_id}`, p.lng!, p.lat!, finalHtml, `${key}|${scheme}|${drivingMe ? "drv" : ""}`, () => onPersonPress?.(p));
    });
    pins.forEach((p) => {
      const col = /^#[0-9a-fA-F]{6}$/.test(p.color ?? "") ? p.color! : "#EA4335";
      const html = `<div style="display:flex;flex-direction:column;align-items:center"><div style="width:14px;height:14px;border-radius:50%;background:${col};border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.4)"></div><div style="margin-top:3px;background:rgba(20,22,26,.9);color:#E8EAED;font:600 10px sans-serif;padding:2px 6px;border-radius:6px">${p.title ?? ""}</div></div>`;
      upsertHtml(`pin-${p.id}`, p.lng, p.lat, html, `${p.id}|${p.title}|${col}`);
    });
    incidents.forEach((i) => {
      const col = i.road_closed ? "#D93025" : "#F9AB00";
      const html = `<div style="width:22px;height:22px;border-radius:50%;background:${col};border:2px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font:700 13px sans-serif;box-shadow:0 1px 6px rgba(0,0,0,.4)">!</div>`;
      upsertHtml(`inc-${i.id}`, i.lng, i.lat, html, `${i.id}|${col}`, () => onIncidentPress?.(i));
    });
    if (selected) {
      const html = `<div style="width:16px;height:16px;border-radius:50%;background:#1A73E8;border:3px solid #fff;box-shadow:0 0 0 5px rgba(26,115,232,.25)"></div>`;
      upsertHtml("selected", selected.lng, selected.lat, html, "sel");
    }
    markersRef.current.forEach((m, id) => { if (!alive.has(id)) { m.remove(); markersRef.current.delete(id); } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token, scheme, drive?.speedKmh, drive?.heading, JSON.stringify(streets), JSON.stringify(located.map((p) => [p.member_id, p.lat, p.lng, p.color, p.name, p.photo_url])), JSON.stringify(pins.map((p) => [p.id, p.lat, p.lng, p.title])), JSON.stringify(incidents.map((i) => [i.id, i.lat, i.lng])), selected?.lat, selected?.lng]);

  // ---- cercas: polígonos GeoJSON translúcidos + etiqueta con nombre ----
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const fc = {
      type: "FeatureCollection",
      features: circles.map((c) => ({
        type: "Feature",
        properties: {
          id: c.id, title: c.title, occupied: c.occupied ? 1 : 0,
          stroke: c.active === false ? "#9AA0A6" : c.occupied ? "#34A853" : colors.brandPrimary,
        },
        geometry: { type: "Polygon", coordinates: [circleRing(c.lat, c.lng, c.radius_m)] },
      })),
    };
    const src = map.getSource("mc-circles");
    if (src) {
      src.setData(fc);
    } else {
      map.addSource("mc-circles", { type: "geojson", data: fc });
      map.addLayer({ id: "mc-circles-fill", type: "fill", source: "mc-circles", paint: { "fill-color": ["get", "stroke"], "fill-opacity": ["case", ["==", ["get", "occupied"], 1], 0.16, 0.08] } });
      map.addLayer({ id: "mc-circles-line", type: "line", source: "mc-circles", paint: { "line-color": ["get", "stroke"], "line-width": 2, "line-opacity": 0.9 } });
    }
    // etiquetas con el nombre de la cerca (marcador HTML, mismo patrón que el renderer de Google)
    if (window.maplibregl) {
      const ml = window.maplibregl;
      const alive = new Set<string>();
      circles.forEach((c) => {
        const id = `label-${c.id}`;
        alive.add(id);
        const stroke = c.active === false ? "#9AA0A6" : c.occupied ? "#34A853" : colors.brandPrimary;
        let m = labelMarkersRef.current.get(id);
        if (!m) {
          const el = document.createElement("div");
          el.style.cssText = `pointer-events:none;font:700 11px sans-serif;color:${stroke};text-shadow:0 1px 3px rgba(255,255,255,.95),0 0 6px rgba(255,255,255,.9);white-space:nowrap`;
          el.textContent = c.title;
          m = new ml.Marker({ element: el, anchor: "bottom" }).setLngLat([c.lng, c.lat]).addTo(map);
          labelMarkersRef.current.set(id, m);
        } else {
          m.setLngLat([c.lng, c.lat]);
          (m.getElement() as HTMLElement).style.color = stroke;
          m.getElement().textContent = c.title;
        }
      });
      labelMarkersRef.current.forEach((m, id) => { if (!alive.has(id)) { m.remove(); labelMarkersRef.current.delete(id); } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, JSON.stringify(circles.map((c) => [c.id, c.lat, c.lng, c.radius_m, c.active, c.occupied, c.title]))]);

  // ---- pulso en cercas ocupadas (respeta reduced-motion) ----
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
    const t = setInterval(() => {
      pulsePhase.current = (pulsePhase.current + 1) % 4;
      const up = pulsePhase.current < 2;
      const anyOccupied = circles.some((c) => c.occupied);
      if (!anyOccupied || !mapRef.current?.getLayer("mc-circles-line")) return;
      mapRef.current.setPaintProperty("mc-circles-line", "line-width", up ? 3 : 2);
      mapRef.current.setPaintProperty("mc-circles-fill", "fill-opacity", up ? 0.2 : 0.1);
    }, 650);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, JSON.stringify(circles.map((c) => [c.id, c.occupied]))]);

  // ---- círculo borrador (creación de cerca con deslizador en vivo) ----
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const has = !!draftCircle;
    const fc = {
      type: "FeatureCollection",
      features: has
        ? [{ type: "Feature", properties: { color: draftCircle!.color ?? "#1A73E8" }, geometry: { type: "Polygon", coordinates: [circleRing(draftCircle!.lat, draftCircle!.lng, draftCircle!.radius_m)] } }]
        : [],
    };
    const src = map.getSource("mc-draft");
    if (src) {
      src.setData(fc);
    } else if (has) {
      map.addSource("mc-draft", { type: "geojson", data: fc });
      map.addLayer({ id: "mc-draft-fill", type: "fill", source: "mc-draft", paint: { "fill-color": ["get", "color"], "fill-opacity": 0.14 } });
      map.addLayer({ id: "mc-draft-line", type: "line", source: "mc-draft", paint: { "line-color": ["get", "color"], "line-width": 2.5, "line-opacity": 0.95 } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, draftCircle?.lat, draftCircle?.lng, draftCircle?.radius_m, draftCircle?.color]);

  // ---- ruta (polyline) ----
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const fc = {
      type: "FeatureCollection",
      features: polyline && polyline.length > 1
        ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: polyline.map(([lat, lng]) => [lng, lat]) } }]
        : [],
    };
    const src = map.getSource("mc-route");
    if (src) {
      src.setData(fc);
    } else if (polyline && polyline.length > 1) {
      map.addSource("mc-route", { type: "geojson", data: fc });
      map.addLayer({ id: "mc-route-line", type: "line", source: "mc-route", paint: { "line-color": colors.brandPrimary, "line-width": 5, "line-opacity": 0.9 } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, JSON.stringify(polyline ?? [])]);

  if (failed) {
    // Respaldo de último nivel: imagen estática servida por nuestro backend (siempre funciona).
    return <StaticMapCanvas {...props} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#eef1f5", overflow: "hidden" }} testID="map-canvas-libre">
      <View ref={hostRef} style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }} />
      {!ready ? (
        <View style={{ position: "absolute", left: 0, right: 0, top: "48%", alignItems: "center" }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: "#6b7280" }}>Cargando mapa…</Text>
        </View>
      ) : null}
    </View>
  );
}
