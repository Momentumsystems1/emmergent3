"""Spoken navigation instructions via OpenAI TTS (Emergent). Generated audio is cached in Mongo and served by URL
(never as a data: URI, which breaks on Expo/React Native)."""
import hashlib
import os
import re

from bson import Binary
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from core import current_user, db, now

router = APIRouter(tags=["tts"])

EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
MODEL = "tts-1"          # fast/cheap, right choice for real-time turn-by-turn
DEFAULT_VOICE = "nova"


def clean_for_tts(text: str) -> str:
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"`{1,3}[^`]*`{1,3}", "", text)
    text = re.sub(r"[*_#>~|]", "", text)
    return re.sub(r"\s+", " ", text).strip()


class TTSBody(BaseModel):
    text: str = Field(min_length=1, max_length=600)
    voice: str = DEFAULT_VOICE
    speed: float = 1.0


def _key(text: str, voice: str, speed: float) -> str:
    return hashlib.sha256(f"{text}|{voice}|{speed}|{MODEL}|mp3".encode()).hexdigest()


@router.post("/tts")
async def make_tts(body: TTSBody, user=Depends(current_user)):
    if not EMERGENT_KEY:
        raise HTTPException(503, "La voz de navegación no está configurada")
    text = clean_for_tts(body.text)
    if not text:
        raise HTTPException(400, "Texto vacío")
    voice = body.voice or DEFAULT_VOICE
    speed = max(0.5, min(body.speed or 1.0, 2.0))
    key = _key(text, voice, speed)
    if not await db.tts_cache.find_one({"_id": key}, {"_id": 1}):
        from emergentintegrations.llm.openai import OpenAITextToSpeech
        tts = OpenAITextToSpeech(api_key=EMERGENT_KEY)
        try:
            audio = await tts.generate_speech(text=text, model=MODEL, voice=voice, speed=speed, response_format="mp3")
        except Exception:
            raise HTTPException(502, "No se pudo generar la voz")
        await db.tts_cache.update_one({"_id": key}, {"$set": {"audio": Binary(audio), "at": now()}}, upsert=True)
    return {"key": key, "url": f"/tts/{key}.mp3"}


@router.get("/tts/{key}.mp3")
async def get_tts(key: str):
    doc = await db.tts_cache.find_one({"_id": key})
    if not doc:
        raise HTTPException(404, "Audio no encontrado")
    return Response(content=bytes(doc["audio"]), media_type="audio/mpeg",
                    headers={"Cache-Control": "public, max-age=31536000"})
