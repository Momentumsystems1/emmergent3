"""Groups, members, invitations (prepared → dispatched → accepted/declined/expired/cancelled)."""
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from core import Unavailable, current_user, db, now, oid, public_base, serialize
from routers.consent import effective_permissions, is_granted
from routers.entitlements import require, user_entitlements

router = APIRouter(tags=["groups"])

PALETTE = ["#22D3EE", "#60A5FA", "#34D399", "#A78BFA", "#FBBF24", "#FB7185", "#F97316"]
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no I/O/0/1: readable over the phone


async def _new_code() -> str:
    """Short human-typable join code, unique among live invitations."""
    while True:
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))
        if not await db.invitations.find_one({"code": code, "status": {"$in": ["prepared", "dispatched", "open"]}}):
            return code


class GroupCreate(BaseModel):
    name: str = "Grupo 1"


class GroupUpdate(BaseModel):
    name: str


class InviteCreate(BaseModel):
    name: str
    membership: str  # fixed | temporary
    channel: str  # whatsapp | sms
    expires_at: Optional[datetime] = None
    duration_hours: Optional[int] = None
    responsible_adult_required: bool = False
    permissions: list[str] = []
    phone: Optional[str] = None  # from the device contacts picker → wa.me/<phone>


async def _group_for(user: dict, group_id: str, admin: bool = False) -> dict:
    g = await db.groups.find_one({"_id": oid(group_id), "deleted_at": None})
    if not g:
        raise HTTPException(404, "Grupo no encontrado")
    m = await db.members.find_one({"group_id": group_id, "user_id": str(user["_id"]), "status": {"$ne": "removed"}})
    if not m:
        raise HTTPException(403, "No perteneces a este grupo")
    if admin and m["role"] not in ("owner", "admin"):
        raise HTTPException(403, "Requiere permisos de administrador del grupo")
    return g


async def _expire_temporaries(group_id: str):
    await db.members.update_many(
        {"group_id": group_id, "membership": "temporary", "status": {"$in": ["pending", "active"]},
         "expires_at": {"$lt": now()}},
        {"$set": {"status": "expired", "expired_at": now()}})
    await db.invitations.update_many(
        {"group_id": group_id, "status": {"$in": ["prepared", "dispatched"]}, "expires_at": {"$lt": now()}},
        {"$set": {"status": "expired"}})


async def group_view(g: dict, viewer_id: str) -> dict:
    gid = str(g["_id"])
    await _expire_temporaries(gid)
    members = [serialize(m) for m in await db.members.find({"group_id": gid, "status": {"$ne": "removed"}}).to_list(200)]
    invitations = {str(i["_id"]): serialize(i) for i in await db.invitations.find({"group_id": gid}).to_list(200)}
    for m in members:
        inv = invitations.get(m.get("invitation_id") or "")
        if inv:
            m["invitation"] = {k: inv.get(k) for k in ("status", "channel", "created_at", "dispatched_at", "link", "token", "id")}
        if m.get("user_id"):
            eff = await effective_permissions(m["user_id"])
            m["shares_location"] = is_granted(eff, "exact_location", gid) or is_granted(eff, "approx_location", gid)
            pos = await db.positions_latest.find_one({"user_id": m["user_id"]})
            m["location_state"] = ("shared" if (m["shares_location"] and pos) else
                                   "not_shared" if not m["shares_location"] else "permission_pending")
        else:
            m["shares_location"] = False
            m["location_state"] = "pending_invitation"
    active_meeting = await db.meetings.find_one({"group_id": gid, "status": "active"})
    active_convoy = await db.convoys.find_one({"group_id": gid, "status": "active"})
    alerts = await db.events.count_documents({"group_id": gid, "state": {"$in": ["open", "escalated"]}})
    return {**serialize(g), "members": members,
            "stats": {"members": sum(1 for m in members if m["status"] == "active"),
                      "connected": sum(1 for m in members if m.get("location_state") == "shared"),
                      "pending": sum(1 for m in members if m["status"] == "pending"),
                      "alerts": alerts, "meeting": bool(active_meeting), "convoy": bool(active_convoy)},
            "my_role": next((m["role"] for m in members if m.get("user_id") == viewer_id), None)}


@router.get("/groups")
async def my_groups(user=Depends(current_user)):
    uid = str(user["_id"])
    ms = await db.members.find({"user_id": uid, "status": {"$in": ["active", "pending"]}}).to_list(100)
    out = []
    for m in ms:
        g = await db.groups.find_one({"_id": ObjectId(m["group_id"]), "deleted_at": None})
        if g:
            out.append(await group_view(g, uid))
    return out


@router.post("/groups", status_code=201)
async def create_group(body: GroupCreate, user=Depends(current_user)):
    uid = str(user["_id"])
    ent = await require(user, "canCreateGroups", "Tu cuenta no tiene permiso para crear grupos.")
    owned = await db.groups.count_documents({"owner_id": uid, "deleted_at": None})
    if owned >= ent["maxGroups"]:
        raise Unavailable("plan", f"Tu plan permite {ent['maxGroups']} grupo(s).", "maxGroups")
    g = {"name": body.name.strip() or "Grupo 1", "owner_id": uid, "created_at": now(), "deleted_at": None,
         "state": "forming"}
    res = await db.groups.insert_one(g)
    gid = str(res.inserted_id)
    prof = user.get("profile") or {}
    await db.members.insert_one({
        "group_id": gid, "user_id": uid, "display_name": prof.get("name") or user["email"].split("@")[0],
        "role": "owner", "membership": "fixed", "status": "active", "color": user.get("avatar", {}).get("color", PALETTE[0]),
        "joined_at": now(), "invitation_id": None, "expires_at": None,
    })
    g["_id"] = res.inserted_id
    return await group_view(g, uid)


@router.get("/groups/{group_id}")
async def get_group(group_id: str, user=Depends(current_user)):
    g = await _group_for(user, group_id)
    return await group_view(g, str(user["_id"]))


@router.patch("/groups/{group_id}")
async def rename_group(group_id: str, body: GroupUpdate, user=Depends(current_user)):
    await _group_for(user, group_id, admin=True)
    await db.groups.update_one({"_id": oid(group_id)}, {"$set": {"name": body.name.strip() or "Grupo 1"}})
    return await group_view(await db.groups.find_one({"_id": oid(group_id)}), str(user["_id"]))


@router.delete("/groups/{group_id}")
async def delete_group(group_id: str, user=Depends(current_user)):
    """Owner-only soft delete; members lose access immediately, evidence is kept."""
    g = await _group_for(user, group_id, admin=True)
    if g["owner_id"] != str(user["_id"]):
        raise HTTPException(403, "Solo el propietario puede borrar el grupo")
    await db.groups.update_one({"_id": oid(group_id)}, {"$set": {"deleted_at": now()}})
    await db.members.update_many({"group_id": group_id}, {"$set": {"status": "removed", "removed_at": now()}})
    await db.invitations.update_many({"group_id": group_id, "status": {"$in": ["prepared", "dispatched", "open"]}}, {"$set": {"status": "cancelled", "cancelled_at": now()}})
    return {"ok": True}


@router.post("/groups/{group_id}/formed")
async def mark_formed(group_id: str, user=Depends(current_user)):
    await _group_for(user, group_id, admin=True)
    await db.groups.update_one({"_id": oid(group_id)}, {"$set": {"state": "formed", "formed_at": now()}})
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"onboarding.completed": True, "onboarding.step": "done"}})
    return {"ok": True}


@router.post("/groups/{group_id}/invitations", status_code=201)
async def invite(group_id: str, body: InviteCreate, request: Request, user=Depends(current_user)):
    g = await _group_for(user, group_id, admin=True)
    ent = (await user_entitlements(user))["entitlements"]
    if body.membership not in ("fixed", "temporary") or body.channel not in ("whatsapp", "sms"):
        raise HTTPException(400, "Parámetros no válidos")
    count = await db.members.count_documents({"group_id": group_id, "membership": body.membership,
                                              "status": {"$in": ["pending", "active"]}})
    cap = ent["maxPermanentMembers"] if body.membership == "fixed" else ent["maxTemporaryGuests"]
    if count >= cap:
        raise Unavailable("plan", f"Tu plan permite {cap} {'miembros fijos' if body.membership == 'fixed' else 'invitados temporales'}.",
                          "maxPermanentMembers" if body.membership == "fixed" else "maxTemporaryGuests")
    expires = body.expires_at
    if body.membership == "temporary":
        if not expires and body.duration_hours:
            expires = now() + timedelta(hours=body.duration_hours)
        if not expires:
            raise HTTPException(400, "Un invitado temporal requiere fecha de expiración o duración")
    token = secrets.token_urlsafe(24)
    code = await _new_code()
    inv = {"group_id": group_id, "group_name": g["name"], "name": body.name.strip(), "membership": body.membership,
           "channel": body.channel, "token": token, "code": code, "status": "prepared", "invited_by": str(user["_id"]),
           "created_at": now(), "dispatched_at": None, "expires_at": expires,
           "responsible_adult_required": body.responsible_adult_required, "permissions": body.permissions, "phone": body.phone,
           "link": f"{public_base(request)}/invite/{token}"}
    ires = await db.invitations.insert_one(inv)
    used = await db.members.count_documents({"group_id": group_id})
    member = {"group_id": group_id, "user_id": None, "display_name": inv["name"], "role":
              "temporary_guest" if body.membership == "temporary" else "adult_member", "membership": body.membership,
              "status": "pending", "color": PALETTE[used % len(PALETTE)], "joined_at": None,
              "invitation_id": str(ires.inserted_id), "expires_at": expires}
    mres = await db.members.insert_one(member)
    inv["_id"] = ires.inserted_id
    member["_id"] = mres.inserted_id
    return {"invitation": serialize(inv), "member": serialize(member)}


@router.post("/groups/{group_id}/invite-link")
async def group_invite_link(group_id: str, request: Request, user=Depends(current_user)):
    """Multi-use group link + short join code (share it in a WhatsApp/WeChat chat or group; everyone who taps the link
    or types the code joins as a fixed member, plan cap checked at acceptance). One open link per group."""
    g = await _group_for(user, group_id, admin=True)
    inv = await db.invitations.find_one({"group_id": group_id, "multi": True, "status": "open"})
    base = public_base(request)
    if not inv:
        token = secrets.token_urlsafe(24)
        inv = {"group_id": group_id, "group_name": g["name"], "name": "", "membership": "fixed", "channel": "link", "token": token,
               "code": await _new_code(), "status": "open", "multi": True, "invited_by": str(user["_id"]), "created_at": now(),
               "dispatched_at": None, "expires_at": None, "uses": [], "link": f"{base}/invite/{token}"}
        res = await db.invitations.insert_one(inv)
        inv["_id"] = res.inserted_id
    else:
        # Links created before a domain change (or before codes existed) are refreshed in place.
        patch = {"link": f"{base}/invite/{inv['token']}", "group_name": g["name"]}
        if not inv.get("code"):
            patch["code"] = await _new_code()
        await db.invitations.update_one({"_id": inv["_id"]}, {"$set": patch})
        inv.update(patch)
    return serialize(inv)


@router.post("/groups/{group_id}/invite-link/revoke")
async def revoke_invite_link(group_id: str, user=Depends(current_user)):
    await _group_for(user, group_id, admin=True)
    await db.invitations.update_many({"group_id": group_id, "multi": True, "status": "open"}, {"$set": {"status": "cancelled", "cancelled_at": now()}})
    return {"ok": True}


@router.post("/invitations/{inv_id}/dispatched")
async def dispatched(inv_id: str, user=Depends(current_user)):
    """Called after the OS share/deep-link flow was actually opened. Truthful state: 'dispatched' (launched), not 'delivered'."""
    inv = await db.invitations.find_one({"_id": oid(inv_id)})
    if not inv:
        raise HTTPException(404, "Invitación no encontrada")
    await _group_for(user, inv["group_id"], admin=True)
    if inv["status"] == "prepared":
        await db.invitations.update_one({"_id": inv["_id"]}, {"$set": {"status": "dispatched", "dispatched_at": now()}})
    return serialize(await db.invitations.find_one({"_id": inv["_id"]}))


@router.post("/invitations/{inv_id}/cancel")
async def cancel_invitation(inv_id: str, user=Depends(current_user)):
    inv = await db.invitations.find_one({"_id": oid(inv_id)})
    if not inv:
        raise HTTPException(404, "Invitación no encontrada")
    await _group_for(user, inv["group_id"], admin=True)
    await db.invitations.update_one({"_id": inv["_id"]}, {"$set": {"status": "cancelled", "cancelled_at": now()}})
    await db.members.update_one({"invitation_id": inv_id}, {"$set": {"status": "removed", "removed_at": now()}})
    return {"ok": True}


@router.post("/invitations/{inv_id}/resend")
async def resend_invitation(inv_id: str, user=Depends(current_user)):
    inv = await db.invitations.find_one({"_id": oid(inv_id)})
    if not inv or inv["status"] in ("accepted", "cancelled"):
        raise HTTPException(400, "La invitación no puede reenviarse")
    await _group_for(user, inv["group_id"], admin=True)
    await db.invitations.update_one({"_id": inv["_id"]}, {"$set": {"status": "prepared", "resent_at": now()},
                                                          "$inc": {"resend_count": 1}})
    return serialize(await db.invitations.find_one({"_id": inv["_id"]}))


@router.get("/invitations/by-token/{token}")
async def invitation_by_token(token: str):
    inv = await db.invitations.find_one({"token": token})
    if not inv:
        raise HTTPException(404, "Invitación no encontrada")
    exp = inv.get("expires_at")
    if exp and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp and exp < now() and inv["status"] != "accepted":
        await db.invitations.update_one({"_id": inv["_id"]}, {"$set": {"status": "expired"}})
        inv["status"] = "expired"
    out = serialize(inv)
    out.pop("token", None)
    return out


@router.get("/invitations/by-code/{code}")
async def invitation_by_code(code: str):
    """Guests who cannot open a deep link (Expo Go, APK) type this 6-character code instead."""
    inv = await db.invitations.find_one({"code": code.strip().upper(),
                                         "status": {"$in": ["prepared", "dispatched", "open"]}})
    if not inv:
        raise HTTPException(404, "Código no válido o ya utilizado")
    return {"token": inv["token"], "group_name": inv.get("group_name", ""), "status": inv["status"]}


class Respond(BaseModel):
    accept: bool


@router.post("/invitations/by-token/{token}/respond")
async def respond_invitation(token: str, body: Respond, user=Depends(current_user)):
    inv = await db.invitations.find_one({"token": token})
    if not inv:
        raise HTTPException(404, "Invitación no encontrada")
    uid = str(user["_id"])
    if inv.get("multi"):
        if inv["status"] != "open":
            raise HTTPException(409, "Este enlace de grupo ya no está activo")
        if not body.accept:
            return {"status": "declined"}
        existing = await db.members.find_one({"group_id": inv["group_id"], "user_id": uid, "status": "active"})
        if existing:
            return {"status": "accepted", "group_id": inv["group_id"], "already_member": True}
        inviter = await db.users.find_one({"_id": oid(inv["invited_by"])})
        ent = (await user_entitlements(inviter or user))["entitlements"]
        count = await db.members.count_documents({"group_id": inv["group_id"], "membership": "fixed", "status": {"$in": ["pending", "active"]}})
        if count >= ent["maxPermanentMembers"]:
            raise Unavailable("plan", f"El grupo ha alcanzado los {ent['maxPermanentMembers']} miembros fijos de su plan.", "maxPermanentMembers")
        prof = user.get("profile") or {}
        used = await db.members.count_documents({"group_id": inv["group_id"]})
        await db.members.insert_one({"group_id": inv["group_id"], "user_id": uid, "display_name": prof.get("name") or user.get("email", "Miembro"),
                                     "role": "adult_member", "membership": "fixed", "status": "active",
                                     "color": user.get("avatar", {}).get("color") or PALETTE[used % len(PALETTE)], "joined_at": now(),
                                     "invitation_id": str(inv["_id"]), "expires_at": None})
        await db.invitations.update_one({"_id": inv["_id"]}, {"$push": {"uses": {"user_id": uid, "at": now()}}})
        return {"status": "accepted", "group_id": inv["group_id"]}
    if inv["status"] in ("accepted", "cancelled", "expired", "declined"):
        raise HTTPException(409, f"La invitación ya está en estado {inv['status']}")
    if not body.accept:
        await db.invitations.update_one({"_id": inv["_id"]}, {"$set": {"status": "declined", "responded_at": now()}})
        await db.members.update_one({"invitation_id": str(inv["_id"])}, {"$set": {"status": "declined"}})
        return {"status": "declined"}
    await db.invitations.update_one({"_id": inv["_id"]}, {"$set": {"status": "accepted", "responded_at": now(),
                                                                   "accepted_by": uid}})
    prof = user.get("profile") or {}
    await db.members.update_one({"invitation_id": str(inv["_id"])}, {"$set": {
        "user_id": uid, "status": "active", "joined_at": now(),
        "display_name": prof.get("name") or inv["name"], "color": user.get("avatar", {}).get("color") or PALETTE[1]}})
    if inv["membership"] == "temporary" and user.get("account_role") not in ("owner", "admin"):
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"account_role": "temporary_guest"}})
    return {"status": "accepted", "group_id": inv["group_id"]}


@router.delete("/groups/{group_id}/members/{member_id}")
async def remove_member(group_id: str, member_id: str, user=Depends(current_user)):
    await _group_for(user, group_id, admin=True)
    m = await db.members.find_one({"_id": oid(member_id), "group_id": group_id})
    if not m or m["role"] == "owner":
        raise HTTPException(400, "No se puede eliminar este miembro")
    await db.members.update_one({"_id": m["_id"]}, {"$set": {"status": "removed", "removed_at": now()}})
    return {"ok": True}


class RoleBody(BaseModel):
    role: str


@router.patch("/groups/{group_id}/members/{member_id}/role")
async def set_role(group_id: str, member_id: str, body: RoleBody, user=Depends(current_user)):
    await _group_for(user, group_id, admin=True)
    if body.role not in ("admin", "adult_responsible", "adult_member", "protected_minor", "temporary_guest"):
        raise HTTPException(400, "Rol no válido")
    await db.members.update_one({"_id": oid(member_id), "group_id": group_id, "role": {"$ne": "owner"}},
                                {"$set": {"role": body.role}})
    return {"ok": True}
