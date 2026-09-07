"""Trips: an active navigation shared with group members (group mobility). The driver starts navigating first; members are
invited afterwards, join, and their real ETAs (consent + position + routing) are shown. Never invents positions."""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core import current_user, db, now, oid, serialize
from routers.coordination import _eta_for, _member

router = APIRouter(tags=["trips"])
log = logging.getLogger("trips")


class TripCreate(BaseModel):
    group_id: str
    lat: float
    lng: float
    place_name: str = "Destino"
    mode: str = "car"
    stops: list[dict] = []


class InviteBody(BaseModel):
    user_ids: list[str]


class StopsBody(BaseModel):
    stops: list[dict]


async def _trip(trip_id: str, user: dict) -> dict:
    t = await db.trips.find_one({"_id": oid(trip_id)})
    if not t:
        raise HTTPException(404, "Viaje no encontrado")
    await _member(user, t["group_id"])
    return t


@router.post("/trips", status_code=201)
async def create_trip(body: TripCreate, user=Depends(current_user)):
    await _member(user, body.group_id)
    uid = str(user["_id"])
    await db.trips.update_many({"group_id": body.group_id, "leader_id": uid, "status": "active"}, {"$set": {"status": "closed", "closed_at": now()}})
    doc = {"group_id": body.group_id, "leader_id": uid, "destination": {"lat": body.lat, "lng": body.lng, "name": body.place_name},
           "mode": body.mode, "stops": body.stops, "status": "active", "created_at": now(),
           "participants": [{"user_id": uid, "status": "leader", "at": now()}]}
    res = await db.trips.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize(doc)


@router.post("/trips/{trip_id}/invite")
async def invite_to_trip(trip_id: str, body: InviteBody, user=Depends(current_user)):
    t = await _trip(trip_id, user)
    if t["leader_id"] != str(user["_id"]):
        raise HTTPException(403, "Solo quien conduce puede unir miembros")
    present = {p["user_id"] for p in t["participants"]}
    active = {m["user_id"] for m in await db.members.find({"group_id": t["group_id"], "status": "active", "user_id": {"$ne": None}}).to_list(200)}
    new = [u for u in body.user_ids if u in active and u not in present]
    if new:
        await db.trips.update_one({"_id": t["_id"]}, {"$push": {"participants": {"$each": [{"user_id": u, "status": "invited", "at": now()} for u in new]}}})
        prof = user.get("profile") or {}
        await db.events.insert_one({"group_id": t["group_id"], "kind": "trip_invite", "severity": "info", "source": "user", "user_id": str(user["_id"]),
                                    "message": f"{prof.get('name') or 'Un miembro'} te invita a ir a {t['destination']['name']}",
                                    "lat": t["destination"]["lat"], "lng": t["destination"]["lng"], "trip_id": trip_id, "created_at": now(),
                                    "confidence": 1.0, "state": "open", "recipients": new, "escalation": "private_warning",
                                    "trace": [{"at": now(), "action": "created", "by": str(user["_id"])}]})
    return {"invited": new}


@router.post("/trips/{trip_id}/join")
async def join_trip(trip_id: str, user=Depends(current_user)):
    t = await _trip(trip_id, user)
    if t["status"] != "active":
        raise HTTPException(409, "El viaje ya ha finalizado")
    uid = str(user["_id"])
    await db.trips.update_one({"_id": t["_id"]}, {"$pull": {"participants": {"user_id": uid}}})
    await db.trips.update_one({"_id": t["_id"]}, {"$push": {"participants": {"user_id": uid, "status": "joined", "at": now()}}})
    return {"ok": True}


@router.post("/trips/{trip_id}/leave")
async def leave_trip(trip_id: str, user=Depends(current_user)):
    t = await _trip(trip_id, user)
    uid = str(user["_id"])
    await db.trips.update_one({"_id": t["_id"], "participants.user_id": uid}, {"$set": {"participants.$.status": "left", "participants.$.at": now()}})
    return {"ok": True}


@router.patch("/trips/{trip_id}")
async def update_stops(trip_id: str, body: StopsBody, user=Depends(current_user)):
    t = await _trip(trip_id, user)
    if t["leader_id"] != str(user["_id"]):
        raise HTTPException(403, "Solo quien conduce puede cambiar las paradas")
    await db.trips.update_one({"_id": t["_id"]}, {"$set": {"stops": body.stops}})
    return {"ok": True}


@router.post("/trips/{trip_id}/close")
async def close_trip(trip_id: str, user=Depends(current_user)):
    t = await _trip(trip_id, user)
    if t["leader_id"] != str(user["_id"]):
        raise HTTPException(403, "Solo quien conduce puede finalizar el viaje")
    await db.trips.update_one({"_id": t["_id"]}, {"$set": {"status": "closed", "closed_at": now()}})
    return {"ok": True}


@router.get("/trips/pending")
async def pending_trips(user=Depends(current_user)):
    """Active trips where I am invited (not yet joined) — surfaced on the map as a compact banner."""
    uid = str(user["_id"])
    cur = db.trips.find({"status": "active", "participants": {"$elemMatch": {"user_id": uid, "status": "invited"}}}).sort("created_at", -1)
    out = []
    for t in await cur.to_list(10):
        leader = await db.members.find_one({"group_id": t["group_id"], "user_id": t["leader_id"]})
        out.append({**serialize(t), "leader_name": (leader or {}).get("display_name", "Un miembro")})
    return out


@router.get("/trips/{trip_id}")
async def trip_state(trip_id: str, user=Depends(current_user)):
    t = await _trip(trip_id, user)
    names = {m["user_id"]: m for m in await db.members.find({"group_id": t["group_id"], "status": "active"}).to_list(200)}
    parts = []
    for p in t["participants"]:
        m = names.get(p["user_id"], {})
        eta = await _eta_for(p["user_id"], t["group_id"], t["destination"]) if p["status"] in ("leader", "joined") else {"state": p["status"], "label": {"invited": "Invitado", "left": "Ha salido"}.get(p["status"], p["status"])}
        parts.append({"user_id": p["user_id"], "name": m.get("display_name", "Miembro"), "color": m.get("color"), "status": p["status"], "eta": eta})
    return {**serialize(t), "participants": parts, "is_leader": t["leader_id"] == str(user["_id"])}
