import logging

from fastapi import APIRouter, Depends, FastAPI
from fastapi.exceptions import HTTPException
from fastapi.requests import Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware

from core import Unavailable, client, current_user, db, now
from routers import auth, consent, coordination, entitlements, groups, people, providers, trips, media, tts, messages
from routers.providers import provider_status

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("sentinel")

app = FastAPI(title="Sentinel Family API")
api = APIRouter(prefix="/api")

for r in (auth.router, consent.router, entitlements.router, groups.router, people.router, providers.router,
          coordination.router, trips.router, media.router, tts.router, messages.router):
    api.include_router(r)


@api.get("/")
async def root():
    return {"service": "sentinel-family", "status": "ok", "time": now().isoformat()}


# Camera sharing: session model exists, streaming transport does not (WebRTC/TURN + native build required).
@api.post("/camera/sessions")
async def camera_session(user=Depends(current_user)):
    await db.camera_requests.insert_one({"user_id": str(user["_id"]), "created_at": now(), "status": "blocked_no_transport"})
    raise Unavailable("service", "La transmisión de cámara requiere WebRTC con servidor TURN y una build nativa.", "camera")


@api.post("/road-reality/publish")
async def road_reality_publish(user=Depends(current_user)):
    raise Unavailable("service", "La publicación requiere anonimización de rostros y matrículas; no hay servicio configurado.",
                      "roadReality")


@api.get("/system/status")
async def system_status():
    return {"providers": provider_status(), "time": now().isoformat()}


app.include_router(api)


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "sentinel-family", "time": now().isoformat()}


@app.get("/")
async def app_root():
    return {"service": "sentinel-family", "status": "ok", "time": now().isoformat()}


@app.exception_handler(HTTPException)
async def http_exc(_: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def startup():
    try:
        from fastapi.concurrency import run_in_threadpool
        await run_in_threadpool(media.init_storage)
    except Exception as e:  # storage is optional at boot; routes report truthfully if it stays down
        logging.getLogger("media").warning("object storage init failed: %s", e)
    try:
        await db.users.create_index("email", unique=True)
        await db.sessions.create_index("expires_at", expireAfterSeconds=0)
        await db.sessions.create_index("token_hash")
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
        await db.invitations.create_index("token", unique=True)
        await db.members.create_index([("group_id", 1), ("user_id", 1)])
        await db.positions.create_index([("user_id", 1), ("at", -1)])
        await db.positions_latest.create_index("user_id", unique=True)
        await db.permission_events.create_index([("user_id", 1), ("created_at", 1)])
        await db.messages.create_index([("group_id", 1), ("created_at", 1)])
        await entitlements.seed_plans()
    except Exception as e:  # managed clusters may reject index changes; API must still boot
        logger.warning("startup init partially failed: %s", e)
    logger.info("Sentinel API ready. Providers: %s", {k: v["provider"] for k, v in provider_status().items()})


@app.on_event("shutdown")
async def shutdown():
    client.close()
