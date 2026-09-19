"""Quedada (spatial meetings) and Convoy (temporal cohesion). Both use real positions + routing provider; never invent data."""
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from core import Unavailable, current_user, db, now, oid, public_base, serialize
from routers.consent import effective_permissions, is_granted
from routers.entitlements import require
from routers.providers import geocode, route

router = APIRouter(tags=["meetings", "convoy"])
log = logging.getLogger("coordination")

MEETING_STATES = ["invitado", "pendiente", "aceptado", "propone_otra_hora", "propone_otro_lugar", "no_puede_acudir",
                  "preparando_salida", "en_camino", "retrasado", "cerca", "llegado"]


async def _member(user: dict, group_id: str):
    m = await db.members.find_one({"group_id": group_id, "user_id": str(user["_id"]), "status": "active"})
    if not m:
        raise HTTPException(403, "No perteneces a este grupo")
    return m


async def _eta_for(user_id: str, group_id: str, dest: dict) -> dict:
    """Truthful ETA: requires consent (eta + location) and a position and a routing provider."""
    eff = await effective_permissions(user_id)
    if not is_granted(eff, "eta", group_id) or not (is_granted(eff, "exact_location", group_id)):
        return {"state": "not_shared", "label": "ETA no compartida"}
    pos = await db.positions_latest.find_one({"user_id": user_id})
    if not pos:
        return {"state": "no_position", "label": "Ubicación no disponible"}
    try:
        r = await route([(pos["lat"], pos["lng"]), (dest["lat"], dest["lng"])])
    except Exception as e:  # provider failure is a legitimate state
        log.warning("eta route failed: %s", e)
        return {"state": "provider_error", "label": "Sin datos de ruta"}
    dur = r.duration_traffic_s or r.duration_s
    return {"state": "ok", "eta_s": dur, "distance_m": r.distance_m, "traffic": r.duration_traffic_s is not None,
            "provider": r.provider, "position_at": pos["at"].isoformat()}


# ---------------- meetings ----------------
class MeetingCreate(BaseModel):
    group_id: str
    name: str = "Quedada"
    place_query: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    place_name: Optional[str] = None
    when: Optional[datetime] = None
    natural_command: Optional[str] = None


@router.post("/meetings", status_code=201)
async def create_meeting(body: MeetingCreate, request: Request, user=Depends(current_user)):
    await _member(user, body.group_id)
    await require(user, "meetings", "Las quedadas no están incluidas en tu plan.")
    dest = None
    destination_state = "ok"
    if body.lat is not None and body.lng is not None:
        dest = {"lat": body.lat, "lng": body.lng, "name": body.place_name or body.place_query or "Destino"}
    elif body.place_query:
        try:
            res = await geocode(body.place_query)
        except Exception as e:
            log.warning("geocode failed: %s", e)
            res = []
        if res:
            dest = {"lat": res[0].lat, "lng": res[0].lng, "name": res[0].name, "provider": res[0].provider}
        else:
            destination_state = "geocode_failed"
    members = await db.members.find({"group_id": body.group_id, "status": "active", "user_id": {"$ne": None}}).to_list(200)
    uid = str(user["_id"])
    participants = [{"user_id": m["user_id"], "name": m["display_name"], "color": m["color"],
                     "state": "aceptado" if m["user_id"] == uid else "invitado", "updated_at": now()} for m in members]
    doc = {"group_id": body.group_id, "name": body.name.strip() or "Quedada", "organizer_id": uid, "created_at": now(),
           "status": "active", "when": body.when, "destination": dest, "place_query": body.place_query,
           "natural_command": body.natural_command, "participants": participants,
           "destination_state": destination_state if dest else ("none" if not body.place_query else "geocode_failed")}
    res = await db.meetings.insert_one(doc)
    doc["_id"] = res.inserted_id
    doc["deep_link"] = f"{public_base(request)}/meeting/{res.inserted_id}"
    await db.meetings.update_one({"_id": res.inserted_id}, {"$set": {"deep_link": doc["deep_link"]}})
    return serialize(doc)


@router.get("/meetings/{meeting_id}")
async def get_meeting(meeting_id: str, user=Depends(current_user)):
    m = await db.meetings.find_one({"_id": oid(meeting_id)})
    if not m:
        raise HTTPException(404, "Quedada no encontrada")
    await _member(user, m["group_id"])
    out = serialize(m)
    if m.get("destination"):
        for p in out["participants"]:
            p["eta"] = await _eta_for(p["user_id"], m["group_id"], m["destination"])
    else:
        for p in out["participants"]:
            p["eta"] = {"state": "no_destination", "label": "Sin destino definido"}
    out["is_organizer"] = m["organizer_id"] == str(user["_id"])
    return out


class MeetingRespond(BaseModel):
    state: str
    note: Optional[str] = None


@router.post("/meetings/{meeting_id}/respond")
async def respond_meeting(meeting_id: str, body: MeetingRespond, user=Depends(current_user)):
    if body.state not in MEETING_STATES:
        raise HTTPException(400, "Estado no válido")
    m = await db.meetings.find_one({"_id": oid(meeting_id)})
    if not m:
        raise HTTPException(404, "Quedada no encontrada")
    uid = str(user["_id"])
    await db.meetings.update_one({"_id": m["_id"], "participants.user_id": uid},
                                 {"$set": {"participants.$.state": body.state, "participants.$.note": body.note,
                                           "participants.$.updated_at": now()}})
    return await get_meeting(meeting_id, user)


@router.post("/meetings/{meeting_id}/close")
async def close_meeting(meeting_id: str, user=Depends(current_user)):
    m = await db.meetings.find_one({"_id": oid(meeting_id)})
    if not m or m["organizer_id"] != str(user["_id"]):
        raise HTTPException(403, "Solo el organizador puede cerrar la quedada")
    await db.meetings.update_one({"_id": m["_id"]}, {"$set": {"status": "closed", "closed_at": now()}})
    return {"ok": True}


@router.get("/groups/{group_id}/meetings")
async def group_meetings(group_id: str, user=Depends(current_user)):
    await _member(user, group_id)
    cur = db.meetings.find({"group_id": group_id}).sort("created_at", -1)
    return [serialize(m) for m in await cur.to_list(50)]


# ---------------- convoy ----------------
class ConvoyCreate(BaseModel):
    group_id: str
    name: str = "Convoy"
    lat: float
    lng: float
    place_name: str = "Destino"
    copilot_id: Optional[str] = None
    tail_id: Optional[str] = None


@router.post("/convoys", status_code=201)
async def create_convoy(body: ConvoyCreate, user=Depends(current_user)):
    await _member(user, body.group_id)
    await require(user, "convoy", "El modo Convoy no está incluido en tu plan.")
    uid = str(user["_id"])
    doc = {"group_id": body.group_id, "name": body.name.strip() or "Convoy", "leader_id": uid, "copilot_id": body.copilot_id,
           "tail_id": body.tail_id, "destination": {"lat": body.lat, "lng": body.lng, "name": body.place_name},
           "status": "active", "created_at": now(), "vehicles": [{"user_id": uid, "joined_at": now(), "seats_free": None}]}
    res = await db.convoys.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize(doc)


class JoinBody(BaseModel):
    seats_free: Optional[int] = None


@router.post("/convoys/{convoy_id}/join")
async def join_convoy(convoy_id: str, body: JoinBody, user=Depends(current_user)):
    c = await db.convoys.find_one({"_id": oid(convoy_id), "status": "active"})
    if not c:
        raise HTTPException(404, "Convoy no encontrado")
    await _member(user, c["group_id"])
    uid = str(user["_id"])
    await db.convoys.update_one({"_id": c["_id"]}, {"$pull": {"vehicles": {"user_id": uid}}})
    await db.convoys.update_one({"_id": c["_id"]}, {"$push": {"vehicles": {"user_id": uid, "joined_at": now(),
                                                                             "seats_free": body.seats_free}}})
    return {"ok": True}


@router.get("/convoys/{convoy_id}")
async def convoy_state(convoy_id: str, user=Depends(current_user)):
    c = await db.convoys.find_one({"_id": oid(convoy_id)})
    if not c:
        raise HTTPException(404, "Convoy no encontrado")
    await _member(user, c["group_id"])
    names = {m["user_id"]: m for m in await db.members.find({"group_id": c["group_id"], "status": "active"}).to_list(200)}
    vehicles = []
    for v in c["vehicles"]:
        m = names.get(v["user_id"], {})
        eta = await _eta_for(v["user_id"], c["group_id"], c["destination"])
        role = "leader" if v["user_id"] == c["leader_id"] else "copilot" if v["user_id"] == c.get("copilot_id") else \
            "tail" if v["user_id"] == c.get("tail_id") else "vehicle"
        vehicles.append({"user_id": v["user_id"], "name": m.get("display_name", "Miembro"), "color": m.get("color"),
                         "role": role, "seats_free": v.get("seats_free"), "eta": eta})
    etas = [v["eta"]["eta_s"] for v in vehicles if v["eta"]["state"] == "ok"]
    cohesion = None
    if len(etas) >= 2:
        spread = max(etas) - min(etas)  # temporal separation along route, in seconds
        cohesion = {"separation_s": spread, "state": "stable" if spread < 90 else "warning" if spread < 240 else "risk",
                    "label": {"stable": "Cohesión estable", "warning": "Aviso de separación", "risk": "Riesgo de separación"}[
                        "stable" if spread < 90 else "warning" if spread < 240 else "risk"],
                    "advice": None if spread < 90 else "El líder puede reducir el ritmo o esperar en un punto seguro. Nunca aceleres para recuperar el convoy."}
    else:
        cohesion = {"state": "insufficient_data", "label": "Cohesión: datos insuficientes",
                    "reason": "Se necesitan al menos dos vehículos con ubicación y ETA compartidos."}
    fuel = {"state": "unavailable", "label": "Datos de consumo no disponibles"}
    seats = [v["seats_free"] for v in vehicles if v.get("seats_free") is not None]
    regroup = None
    if len(vehicles) >= 3 and seats and sum(seats) >= 4:
        regroup = {"suggestion": f"Hay {sum(seats)} asientos libres en {len(vehicles)} vehículos. Podéis valorar reagruparos.",
                   "parking": {"state": "unavailable", "label": "Sin proveedor de parkings configurado"}}
    return {**serialize(c), "vehicles": vehicles, "cohesion": cohesion, "fuel": fuel, "regroup": regroup,
            "traffic": {"state": "unavailable", "label": "Sin datos de tráfico"} if not any(v["eta"].get("traffic") for v in vehicles) else {"state": "ok"},
            "is_leader": c["leader_id"] == str(user["_id"])}


@router.post("/convoys/{convoy_id}/close")
async def close_convoy(convoy_id: str, user=Depends(current_user)):
    c = await db.convoys.find_one({"_id": oid(convoy_id)})
    if not c or c["leader_id"] != str(user["_id"]):
        raise HTTPException(403, "Solo el líder puede finalizar el convoy")
    await db.convoys.update_one({"_id": c["_id"]}, {"$set": {"status": "closed", "closed_at": now()}})
    return {"ok": True}


@router.get("/groups/{group_id}/convoys")
async def group_convoys(group_id: str, user=Depends(current_user)):
    await _member(user, group_id)
    cur = db.convoys.find({"group_id": group_id}).sort("created_at", -1)
    return [serialize(c) for c in await cur.to_list(50)]
