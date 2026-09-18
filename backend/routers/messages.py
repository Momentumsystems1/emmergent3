"""Short direct messages to one or several group members + a cross-group inbox and unread counter."""
from typing import List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core import current_user, db, now, oid, serialize

router = APIRouter(tags=["messages"])


class MessageBody(BaseModel):
    recipient_ids: List[str] = []          # empty => every other active member
    text: str = Field(min_length=1, max_length=500)


async def _member(group_id: str, uid: str):
    return await db.members.find_one({"group_id": group_id, "user_id": uid, "status": "active"})


@router.post("/groups/{group_id}/messages", status_code=201)
async def send_message(group_id: str, body: MessageBody, user=Depends(current_user)):
    uid = str(user["_id"])
    me = await _member(group_id, uid)
    if not me:
        raise HTTPException(403, "No perteneces a este grupo")
    actives = await db.members.find({"group_id": group_id, "status": "active", "user_id": {"$ne": None}}).to_list(200)
    valid = {m["user_id"] for m in actives if m["user_id"] != uid}
    recips = [r for r in body.recipient_ids if r in valid] if body.recipient_ids else list(valid)
    if not recips:
        raise HTTPException(400, "No hay destinatarios disponibles")
    doc = {"group_id": group_id, "sender_id": uid, "sender_name": me.get("display_name") or "Miembro",
           "sender_color": me.get("color"), "recipient_ids": recips, "text": body.text.strip(),
           "created_at": now(), "read_by": [uid]}
    res = await db.messages.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize(doc)


@router.get("/groups/{group_id}/messages")
async def list_messages(group_id: str, user=Depends(current_user)):
    uid = str(user["_id"])
    if not await _member(group_id, uid):
        raise HTTPException(403, "No perteneces a este grupo")
    cur = db.messages.find({"group_id": group_id, "$or": [{"sender_id": uid}, {"recipient_ids": uid}]}).sort("created_at", -1)
    msgs = [serialize(m) for m in await cur.to_list(100)]
    return list(reversed(msgs))


@router.get("/messages/inbox")
async def inbox(user=Depends(current_user)):
    uid = str(user["_id"])
    cur = db.messages.find({"recipient_ids": uid}).sort("created_at", -1)
    out = []
    for m in await cur.to_list(50):
        sd = serialize(m)
        try:
            g = await db.groups.find_one({"_id": ObjectId(m["group_id"])}, {"name": 1})
        except Exception:
            g = None
        sd["group_name"] = g["name"] if g else ""
        sd["read"] = uid in m.get("read_by", [])
        out.append(sd)
    return out


@router.get("/messages/unread")
async def unread(user=Depends(current_user)):
    uid = str(user["_id"])
    n = await db.messages.count_documents({"recipient_ids": uid, "read_by": {"$ne": uid}})
    return {"count": n}


@router.post("/messages/{mid}/read")
async def mark_read(mid: str, user=Depends(current_user)):
    uid = str(user["_id"])
    await db.messages.update_one({"_id": oid(mid)}, {"$addToSet": {"read_by": uid}})
    return {"ok": True}


@router.post("/groups/{group_id}/messages/read_all")
async def read_all(group_id: str, user=Depends(current_user)):
    uid = str(user["_id"])
    await db.messages.update_many({"group_id": group_id, "recipient_ids": uid}, {"$addToSet": {"read_by": uid}})
    return {"ok": True}
