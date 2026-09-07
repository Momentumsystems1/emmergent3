"""Profile + avatar, live positions (consent-gated), unified events (alert engine)."""
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core import current_user, db, now, oid, serialize
from routers.auth import public_user
from routers.consent import effective_permissions, is_granted

router = APIRouter(tags=["profile", "location", "events"])


class ProfileBody(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    surname: Optional[str] = None
    language: str = "es"


class AvatarBody(BaseModel):
    color: str
    symbol: str = "pin"  # pin | shield | car | star | heart
    outline: str = "solid"


@router.put("/profile")
async def set_profile(body: ProfileBody, user=Depends(current_user)):
    await db.users.update_one({"_id": user["_id"]}, {"$set": {
        "profile": {"name": body.name.strip(), "surname": (body.surname or "").strip() or None},
        "language": body.language, "onboarding.step": "group"}})
    await db.members.update_many({"user_id": str(user["_id"])}, {"$set": {"display_name": body.name.strip()}})
    return public_user(await db.users.find_one({"_id": user["_id"]}))


@router.put("/profile/avatar")
async def set_avatar(body: AvatarBody, user=Depends(current_user)):
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"avatar": body.model_dump()}})
    await db.members.update_many({"user_id": str(user["_id"])}, {"$set": {"color": body.color}})
    return public_user(await db.users.find_one({"_id": user["_id"]}))


class StepBody(BaseModel):
    step: str


@router.put("/profile/onboarding-step")
async def set_step(body: StepBody, user=Depends(current_user)):
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"onboarding.step": body.step,
                                                             "onboarding.completed": body.step == "done"}})
    return {"ok": True}


# ---------------- positions ----------------
class PositionBody(BaseModel):
    lat: float
    lng: float
    accuracy: Optional[float] = None
    speed: Optional[float] = None
    heading: Optional[float] = None
    mobility_mode: Optional[str] = None  # car | transit | bike | walk | unknown
    status: Optional[str] = None  # moving | stopped | arrived


@router.post("/location")
async def post_location(body: PositionBody, user=Depends(current_user)):
    uid = str(user["_id"])
    eff = await effective_permissions(uid)
    shares = any(v["effective"] and v["key"] in ("exact_location", "approx_location") for v in eff.values())
    if not shares:
        raise HTTPException(403, {"code": "LOCATION_NOT_SHARED",
                                  "reason": "No has activado compartir ubicación. Actívalo en tu Tarjeta de Privacidad."})
    rec = {**body.model_dump(), "user_id": uid, "at": now()}
    await db.positions.insert_one(dict(rec))
    await db.positions_latest.update_one({"user_id": uid}, {"$set": rec}, upsert=True)
    return {"ok": True, "at": rec["at"].isoformat()}


def _approx(lat: float, lng: float):
    return round(lat, 2), round(lng, 2)


@router.get("/groups/{group_id}/positions")
async def group_positions(group_id: str, user=Depends(current_user)):
    viewer = str(user["_id"])
    if not await db.members.find_one({"group_id": group_id, "user_id": viewer, "status": "active"}):
        raise HTTPException(403, "No perteneces a este grupo")
    members = await db.members.find({"group_id": group_id, "status": "active", "user_id": {"$ne": None}}).to_list(200)
    out = []
    for m in members:
        eff = await effective_permissions(m["user_id"])
        exact = is_granted(eff, "exact_location", group_id)
        approx = is_granted(eff, "approx_location", group_id)
        base = {"member_id": str(m["_id"]), "user_id": m["user_id"], "name": m["display_name"], "color": m["color"], "has_photo": bool(m.get("has_photo")),
                "role": m["role"], "is_me": m["user_id"] == viewer}
        pos = await db.positions_latest.find_one({"user_id": m["user_id"]})
        if not (exact or approx):
            out.append({**base, "state": "not_shared", "label": "Ubicación no compartida"})
        elif not pos:
            out.append({**base, "state": "permission_pending", "label": "Permiso de ubicación pendiente"})
        else:
            lat, lng = (pos["lat"], pos["lng"]) if exact else _approx(pos["lat"], pos["lng"])
            out.append({**base, "state": "shared", "precision": "exact" if exact else "approx", "lat": lat, "lng": lng,
                        "at": pos["at"].isoformat(), "mobility_mode": pos.get("mobility_mode"),
                        "status": pos.get("status") if is_granted(eff, "status", group_id) else None,
                        "speed": pos.get("speed") if exact else None})
    return out


# ---------------- unified events ----------------
class EventBody(BaseModel):
    group_id: str
    kind: str  # checkin | incident | v16 | emergency | help_request
    severity: str = "info"  # info | warning | risk | critical
    message: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    target_user_id: Optional[str] = None
    mobility_mode: Optional[str] = None


@router.post("/events", status_code=201)
async def create_event(body: EventBody, user=Depends(current_user)):
    uid = str(user["_id"])
    if not await db.members.find_one({"group_id": body.group_id, "user_id": uid, "status": "active"}):
        raise HTTPException(403, "No perteneces a este grupo")
    if body.kind == "v16":
        raise HTTPException(503, {"code": "SERVICE_NOT_CONFIGURED", "title": "SERVICIO NO CONFIGURADO",
                                  "reason": "No existe integración con el fabricante de la baliza V16."})
    recipients = [m["user_id"] for m in await db.members.find(
        {"group_id": body.group_id, "status": "active", "user_id": {"$nin": [None, uid]}}).to_list(200)]
    ev = {**body.model_dump(), "source": "user", "user_id": uid, "created_at": now(), "confidence": 1.0,
          "state": "open", "recipients": recipients, "escalation": "private_warning" if body.kind != "emergency" else "emergency",
          "trace": [{"at": now(), "action": "created", "by": uid}]}
    res = await db.events.insert_one(ev)
    ev["_id"] = res.inserted_id
    return serialize(ev)


@router.get("/groups/{group_id}/events")
async def list_events(group_id: str, user=Depends(current_user)):
    if not await db.members.find_one({"group_id": group_id, "user_id": str(user["_id"]), "status": "active"}):
        raise HTTPException(403, "No perteneces a este grupo")
    cur = db.events.find({"group_id": group_id}).sort("created_at", -1)
    return [serialize(e) for e in await cur.to_list(100)]


class EventAction(BaseModel):
    action: str  # respond_ok | acknowledge | escalate | resolve
    note: Optional[str] = None


@router.post("/events/{event_id}/action")
async def event_action(event_id: str, body: EventAction, user=Depends(current_user)):
    ev = await db.events.find_one({"_id": oid(event_id)})
    if not ev:
        raise HTTPException(404, "Evento no encontrado")
    uid = str(user["_id"])
    state = {"respond_ok": "resolved", "acknowledge": "acknowledged", "escalate": "escalated", "resolve": "resolved"}.get(body.action)
    if not state:
        raise HTTPException(400, "Acción no válida")
    await db.events.update_one({"_id": ev["_id"]}, {"$set": {"state": state},
                                                    "$push": {"trace": {"at": now(), "action": body.action, "by": uid, "note": body.note}}})
    return serialize(await db.events.find_one({"_id": ev["_id"]}))
