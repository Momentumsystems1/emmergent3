// Shared map types/helpers used by both the native (MapCanvas.tsx) and web (MapCanvas.web.tsx) renderers.
export type MapPerson = { member_id: string; user_id: string; name: string; color: string; state: string; lat?: number; lng?: number; is_me?: boolean; label?: string; precision?: string; at?: string; status?: string | null };
export type MapPin = { id: string; lat: number; lng: number; title: string; color?: string };
export type LatLng = { lat: number; lng: number };
export type Incident = { id: string; lat: number; lng: number; type?: string; title?: string; description?: string; severity?: number; delay_s?: number; road_closed?: boolean; jam?: boolean };

export const INCIDENT_TYPE: Record<string, string> = { Accident: "Accidente", Congestion: "Retención", Construction: "Obras", DisabledVehicle: "Vehículo averiado", LaneRestriction: "Carril cortado", MassTransit: "Transporte público", Miscellaneous: "Incidencia", OtherNews: "Aviso", PlannedEvent: "Evento", RoadClosure: "Vía cortada", RoadHazard: "Peligro en la vía", Weather: "Meteorología", Jam: "Atasco", Fog: "Niebla", Rain: "Lluvia", Ice: "Hielo", Wind: "Viento", Flooding: "Inundación", BrokenDownVehicle: "Vehículo averiado", RoadWorks: "Obras" };
export const incidentIcon = (i: Incident) => (i.road_closed ? "close-circle" : i.jam ? "car" : /Construction|RoadWorks/i.test(i.type ?? "") ? "construct" : /Accident/i.test(i.type ?? "") ? "warning" : /Weather|Fog|Rain|Ice|Wind|Flood/i.test(i.type ?? "") ? "rainy" : "alert-circle");

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
  /** Azure traffic flow + incident tiles overlay (native). */
  traffic?: boolean;
  incidents?: Incident[];
  onIncidentPress?: (i: Incident) => void;
};
