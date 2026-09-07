import hashlib
import secrets
from datetime import timedelta

import bcrypt
import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from core import ACCESS_MINUTES, ALGO, JWT_SECRET, REFRESH_DAYS, current_user, db, now, serialize

router = APIRouter(prefix="/auth", tags=["auth"])


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    language: str = "es"
    platform: str = "unknown"
    app_version: str = "1.0.0"


class RefreshBody(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


def _hash_pw(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def _check_pw(p: str, h: str) -> bool:
    return bcrypt.checkpw(p.encode(), h.encode())


def _thash(t: str) -> str:
    return hashlib.sha256(t.encode()).hexdigest()


def _access(uid: str) -> str:
    exp = now() + timedelta(minutes=ACCESS_MINUTES)
    return jwt.encode({"sub": uid, "type": "access", "exp": exp}, JWT_SECRET, algorithm=ALGO)


async def _issue(user: dict) -> TokenResponse:
    raw = secrets.token_urlsafe(48)
    uid = str(user["_id"])
    await db.sessions.insert_one({
        "user_id": uid, "token_hash": _thash(raw), "expires_at": now() + timedelta(days=REFRESH_DAYS),
        "revoked": False, "created_at": now(),
    })
    return TokenResponse(access_token=_access(uid), refresh_token=raw, expires_in=ACCESS_MINUTES * 60,
                         user=public_user(user))


def public_user(user: dict) -> dict:
    u = serialize(user)
    u.pop("password_hash", None)
    return u


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(c: Credentials):
    doc = {
        "email": c.email.lower(), "password_hash": _hash_pw(c.password), "created_at": now(), "deleted_at": None,
        "language": c.language, "plan": "free", "account_role": "owner",
        "delegated_permissions": [], "onboarding": {"completed": False, "step": "consent"},
        "profile": None, "avatar": {"color": "#22D3EE", "symbol": "pin", "outline": "solid"},
    }
    try:
        res = await db.users.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(409, "Este email ya está registrado")
    doc["_id"] = res.inserted_id
    return await _issue(doc)


@router.post("/login", response_model=TokenResponse)
async def login(c: Credentials):
    user = await db.users.find_one({"email": c.email.lower(), "deleted_at": None})
    if not user or not user.get("password_hash") or not _check_pw(c.password, user["password_hash"]):
        raise HTTPException(401, "Email o contraseña incorrectos" if not user or user.get("password_hash") else "Esta cuenta usa Google. Entra con Google.")
    return await _issue(user)


class SessionBody(BaseModel):
    session_id: str


@router.post("/session", response_model=TokenResponse)
async def google_session(body: SessionBody):
    """Emergent-managed Google sign-in: exchange the one-time session_id (exactly once, server-side) for the Google profile,
    upsert the user by email and issue the app's own JWT pair so every other endpoint keeps working unchanged."""
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data", headers={"X-Session-ID": body.session_id})
    except httpx.HTTPError:
        raise HTTPException(401, "No se pudo validar la sesión de Google")
    if r.status_code != 200:
        raise HTTPException(401, "Sesión de Google no válida o expirada")
    d = r.json()
    email = (d.get("email") or "").lower()
    if not email:
        raise HTTPException(401, "Google no devolvió un email")
    google = {"name": d.get("name"), "picture": d.get("picture"), "linked_at": now()}
    user = await db.users.find_one({"email": email, "deleted_at": None})
    if user:
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"google": google}})
        user["google"] = google
    else:
        doc = {"email": email, "password_hash": None, "auth_provider": "google", "google": google, "created_at": now(), "deleted_at": None,
               "language": "es", "plan": "free", "account_role": "owner", "delegated_permissions": [],
               "onboarding": {"completed": False, "step": "consent"}, "profile": None,
               "avatar": {"color": "#22D3EE", "symbol": "pin", "outline": "solid"}}
        try:
            res = await db.users.insert_one(doc)
            doc["_id"] = res.inserted_id
        except DuplicateKeyError:
            doc = await db.users.find_one({"email": email, "deleted_at": None})
            if not doc:
                raise HTTPException(409, "Esta cuenta fue eliminada. Contacta con soporte para reactivarla.")
        user = doc
    if d.get("session_token"):
        await db.user_sessions.insert_one({"session_token": d["session_token"], "user_id": str(user["_id"]), "created_at": now(),
                                           "expires_at": now() + timedelta(days=7)})
    return await _issue(user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshBody):
    old = await db.sessions.find_one_and_update(
        {"token_hash": _thash(body.refresh_token), "revoked": False, "expires_at": {"$gt": now()}},
        {"$set": {"revoked": True, "revoked_at": now()}}, return_document=ReturnDocument.BEFORE)
    if not old:
        raise HTTPException(401, "Sesión expirada")
    from bson import ObjectId
    user = await db.users.find_one({"_id": ObjectId(old["user_id"]), "deleted_at": None})
    if not user:
        raise HTTPException(401, "Sesión expirada")
    return await _issue(user)


@router.post("/logout", status_code=204)
async def logout(body: RefreshBody):
    await db.sessions.update_one({"token_hash": _thash(body.refresh_token)},
                                 {"$set": {"revoked": True, "revoked_at": now()}})


@router.get("/me")
async def me(user=Depends(current_user)):
    return public_user(user)


@router.get("/sessions")
async def sessions(user=Depends(current_user)):
    cur = db.sessions.find({"user_id": str(user["_id"]), "revoked": False, "expires_at": {"$gt": now()}},
                           {"token_hash": 0}).sort("created_at", -1)
    return [serialize(s) for s in await cur.to_list(50)]
