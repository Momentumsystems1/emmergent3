"""Profile photos via Emergent Object Storage. The app never talks to storage: upload and reads go through these routes.
Reads are allowed to the owner and to active co-members of any of their groups (header token or ?token= for <img> on web)."""
import logging
import os
import uuid
from typing import Optional

import jwt
import requests
from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response

from core import ALGO, JWT_SECRET, current_user, db, now

router = APIRouter(tags=["media"])
log = logging.getLogger("media")

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "sentinel-family"
MAX_BYTES = 6 * 1024 * 1024
storage_key: Optional[str] = None


def init_storage() -> str:
    global storage_key
    if storage_key:
        return storage_key
    r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    r.raise_for_status()
    storage_key = r.json()["storage_key"]
    return storage_key


def _put(path: str, data: bytes, content_type: str) -> dict:
    r = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": init_storage(), "Content-Type": content_type}, data=data, timeout=120)
    if r.status_code == 503:  # stale key → re-init once
        global storage_key
        storage_key = None
        r = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": init_storage(), "Content-Type": content_type}, data=data, timeout=120)
    return {"status": r.status_code, "json": r.json() if r.status_code == 200 else None, "text": r.text[:200]}


def _get(path: str) -> tuple[int, bytes, str]:
    r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": init_storage()}, timeout=60)
    return r.status_code, r.content, r.headers.get("Content-Type", "application/octet-stream")


@router.post("/profile/photo")
async def upload_photo(file: UploadFile = File(...), user=Depends(current_user)):
    if not EMERGENT_KEY:
        raise HTTPException(503, "Almacenamiento de fotos no configurado")
    ct = (file.content_type or "").lower()
    if ct not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(415, "Formato no soportado (JPEG, PNG o WebP)")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "La foto supera 6 MB")
    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[ct]
    path = f"{APP_NAME}/uploads/{user['_id']}/{uuid.uuid4().hex}.{ext}"
    try:
        res = await run_in_threadpool(_put, path, data, ct)
    except requests.RequestException as e:
        log.warning("photo upload failed: %s", e)
        raise HTTPException(503, "El almacenamiento no respondió")
    if res["status"] == 402:
        raise HTTPException(402, "Sin créditos de almacenamiento: no se pueden subir fotos ahora")
    if res["status"] != 200:
        raise HTTPException(502, f"Error de almacenamiento ({res['status']})")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"photo": {"path": res["json"]["path"], "content_type": ct, "uploaded_at": now()}}})
    await db.members.update_many({"user_id": str(user["_id"])}, {"$set": {"has_photo": True}})
    return {"ok": True, "has_photo": True}


@router.delete("/profile/photo")
async def delete_photo(user=Depends(current_user)):
    await db.users.update_one({"_id": user["_id"]}, {"$unset": {"photo": ""}})
    await db.members.update_many({"user_id": str(user["_id"])}, {"$set": {"has_photo": False}})
    return {"ok": True}


async def _viewer(request: Request, token: Optional[str]) -> dict:
    raw = token or (request.headers.get("authorization", "").removeprefix("Bearer ").strip() or None)
    if not raw:
        raise HTTPException(401, "Sesión no iniciada")
    try:
        payload = jwt.decode(raw, JWT_SECRET, algorithms=[ALGO])
        if payload.get("type") != "access":
            raise ValueError
        u = await db.users.find_one({"_id": ObjectId(payload["sub"]), "deleted_at": None})
    except Exception:
        raise HTTPException(401, "Sesión no válida o expirada")
    if not u:
        raise HTTPException(401, "Sesión no válida o expirada")
    return u


@router.get("/media/user/{user_id}/photo")
async def user_photo(user_id: str, request: Request, token: Optional[str] = Query(None)):
    viewer = await _viewer(request, token)
    if str(viewer["_id"]) != user_id:
        mine = {m["group_id"] for m in await db.members.find({"user_id": str(viewer["_id"]), "status": "active"}).to_list(200)}
        shared = await db.members.find_one({"user_id": user_id, "status": "active", "group_id": {"$in": list(mine)}}) if mine else None
        if not shared:
            raise HTTPException(403, "No compartes grupo con esta persona")
    owner = await db.users.find_one({"_id": ObjectId(user_id)}, {"photo": 1})
    if not owner or not owner.get("photo"):
        raise HTTPException(404, "Sin foto")
    try:
        status, content, ct = await run_in_threadpool(_get, owner["photo"]["path"])
    except requests.RequestException:
        raise HTTPException(503, "El almacenamiento no respondió")
    if status != 200:
        raise HTTPException(404, "Foto no disponible")
    return Response(content=content, media_type=ct, headers={"Cache-Control": "private, max-age=300"})
