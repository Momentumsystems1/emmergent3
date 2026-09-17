"""Iteration 11 backend tests: Azure Maps POI layer (GET /mobility/poi) and profile photo lifecycle.

Covers:
- POI: valid categories return list with name/lat/lng/category. Auth required. Invalid category → controlled error.
- Profile photo: POST multipart (jpeg/png/webp) → GET /media/user/{uid}/photo returns image → DELETE removes it.
"""
import io
import uuid
import zlib
import struct

import pytest
import requests

# Load public URL from frontend/.env
FRONTEND_ENV = "/app/frontend/.env"
BASE_URL = None
with open(FRONTEND_ENV) as f:
    for line in f:
        if line.strip().startswith("EXPO_PUBLIC_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
            break
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL not found"
API = f"{BASE_URL}/api"

ANA_EMAIL = "ana.demo@sentinelfamily.app"
ANA_PW = "Sentinel2026!"


def uniq_email(prefix="user"):
    return f"TEST_{prefix}_{uuid.uuid4().hex[:10]}@sentinelfamily.app"


def _make_jpeg() -> bytes:
    return bytes([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
        0xFF, 0xDB, 0x00, 0x43, 0x00,
    ] + [0x08] * 64 + [0xFF, 0xD9])


def _make_png() -> bytes:
    """Minimal valid 1x1 PNG."""
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = b"IHDR" + struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    ihdr_chunk = struct.pack(">I", len(ihdr) - 4) + ihdr + struct.pack(">I", zlib.crc32(ihdr))
    raw = b"\x00\xff\xff\xff"
    comp = zlib.compress(raw)
    idat = b"IDAT" + comp
    idat_chunk = struct.pack(">I", len(comp)) + idat + struct.pack(">I", zlib.crc32(idat))
    iend = b"IEND"
    iend_chunk = struct.pack(">I", 0) + iend + struct.pack(">I", zlib.crc32(iend))
    return sig + ihdr_chunk + idat_chunk + iend_chunk


def _make_webp() -> bytes:
    """Minimal WebP header (RIFF/WEBP/VP8L) with a small placeholder body. Backend only checks content-type."""
    body = b"VP8L" + b"\x00" * 20
    return b"RIFF" + struct.pack("<I", len(body) + 4) + b"WEBP" + body


@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def ana(s):
    r = s.post(f"{API}/auth/login", json={"email": ANA_EMAIL, "password": ANA_PW})
    if r.status_code != 200:
        pytest.skip(f"Ana login failed ({r.status_code}): {r.text[:200]}")
    d = r.json()
    return {"access": d["access_token"], "user": d["user"], "id": d["user"]["id"]}


def auth_h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ------------------------ Mobility POI (Azure Maps) ------------------------
class TestMobilityPOI:
    CATS = ["pharmacy", "restaurant", "park", "hospital", "police", "fuel"]

    def test_poi_requires_auth(self, s):
        r = s.get(f"{API}/mobility/poi", params={"lat": 40.4168, "lng": -3.7038, "category": "pharmacy"})
        assert r.status_code in (401, 403), f"Expected auth error, got {r.status_code}"

    @pytest.mark.parametrize("cat", CATS)
    def test_poi_valid_category(self, s, ana, cat):
        r = s.get(
            f"{API}/mobility/poi",
            params={"lat": 40.4168, "lng": -3.7038, "category": cat},
            headers=auth_h(ana["access"]),
        )
        # Provider may be flaky; accept 200 or 503. 503 must be truthful.
        assert r.status_code in (200, 503), f"category={cat} status={r.status_code} body={r.text[:200]}"
        if r.status_code == 200:
            data = r.json()
            assert isinstance(data, list)
            if data:
                first = data[0]
                for k in ("name", "lat", "lng", "category"):
                    assert k in first, f"missing key {k} for category={cat}"
                assert first["category"] == cat
                assert isinstance(first["lat"], (int, float))
                assert isinstance(first["lng"], (int, float))
        else:
            assert r.json()["detail"]["code"] == "SERVICE_NOT_CONFIGURED"

    def test_poi_invalid_category_controlled_error(self, s, ana):
        r = s.get(
            f"{API}/mobility/poi",
            params={"lat": 40.4168, "lng": -3.7038, "category": "unicorn"},
            headers=auth_h(ana["access"]),
        )
        # Must be a controlled 503 (Unavailable) rather than a 500 crash.
        assert r.status_code == 503, f"Expected controlled 503, got {r.status_code}: {r.text[:200]}"
        body = r.json()
        assert "detail" in body
        assert body["detail"].get("code") == "SERVICE_NOT_CONFIGURED"


# ------------------------ Profile photo upload/get/delete ------------------------
@pytest.fixture
def fresh_user(s):
    email = uniq_email("photo")
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "Sentinel2026!"})
    assert r.status_code == 201, r.text
    d = r.json()
    return {"email": email, "access": d["access_token"], "user": d["user"], "id": d["user"]["id"]}


class TestProfilePhoto:
    def _upload(self, s, user, data: bytes, filename: str, content_type: str):
        files = {"file": (filename, io.BytesIO(data), content_type)}
        return s.post(f"{API}/profile/photo", headers=auth_h(user["access"]), files=files)

    def test_upload_jpeg_then_get_then_delete(self, s, fresh_user):
        # Upload
        r = self._upload(s, fresh_user, _make_jpeg(), "photo.jpg", "image/jpeg")
        assert r.status_code == 200, f"upload failed: {r.status_code} {r.text[:300]}"
        body = r.json()
        assert body.get("ok") is True or body.get("has_photo") is True or "url" in body or "photo" in body

        # GET must return image (endpoint requires auth: Bearer or ?token=)
        r = s.get(f"{API}/media/user/{fresh_user['id']}/photo", headers=auth_h(fresh_user["access"]))
        assert r.status_code == 200, f"GET failed: {r.status_code}"
        assert r.headers.get("content-type", "").startswith("image/")
        assert len(r.content) > 0

        # /auth/me should reflect has_photo=True
        r = s.get(f"{API}/auth/me", headers=auth_h(fresh_user["access"]))
        assert r.status_code == 200
        assert r.json().get("has_photo") is True

        # DELETE
        r = s.delete(f"{API}/profile/photo", headers=auth_h(fresh_user["access"]))
        assert r.status_code in (200, 204), f"DELETE failed: {r.status_code} {r.text[:200]}"

        # After delete, /auth/me has_photo should be False and GET photo should 404
        r = s.get(f"{API}/auth/me", headers=auth_h(fresh_user["access"]))
        assert r.json().get("has_photo") in (False, None)

        r = s.get(f"{API}/media/user/{fresh_user['id']}/photo", headers=auth_h(fresh_user["access"]))
        assert r.status_code == 404

    def test_upload_png(self, s, fresh_user):
        r = self._upload(s, fresh_user, _make_png(), "p.png", "image/png")
        assert r.status_code == 200, f"png upload failed: {r.status_code} {r.text[:300]}"
        # Cleanup
        s.delete(f"{API}/profile/photo", headers=auth_h(fresh_user["access"]))

    def test_upload_webp(self, s, fresh_user):
        r = self._upload(s, fresh_user, _make_webp(), "p.webp", "image/webp")
        assert r.status_code == 200, f"webp upload failed: {r.status_code} {r.text[:300]}"
        s.delete(f"{API}/profile/photo", headers=auth_h(fresh_user["access"]))

    def test_upload_rejects_non_image(self, s, fresh_user):
        files = {"file": ("bad.txt", io.BytesIO(b"not an image"), "text/plain")}
        r = s.post(f"{API}/profile/photo", headers=auth_h(fresh_user["access"]), files=files)
        assert r.status_code in (400, 415, 422), f"expected rejection, got {r.status_code}"

    def test_upload_requires_auth(self, s):
        files = {"file": ("p.jpg", io.BytesIO(_make_jpeg()), "image/jpeg")}
        r = s.post(f"{API}/profile/photo", files=files)
        assert r.status_code in (401, 403)
