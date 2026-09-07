"""Iteration 6 backend tests: profile photo (Emergent Object Storage), DELETE /groups, register→onboarding.step, SOS event, positions has_photo."""
import io
import os
import uuid
import struct
import zlib

import pytest
import requests

# Public URL from frontend/.env
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


def _make_jpeg(w=8, h=8) -> bytes:
    """Return a minimal, valid JPEG (SOI ... EOI). Contents don't need to decode correctly for backend validation:
    the backend only checks the reported content-type. We still send real JPEG bytes just in case."""
    return bytes([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
        0xFF, 0xDB, 0x00, 0x43, 0x00,
    ] + [0x08] * 64 + [0xFF, 0xD9])


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    return sess


@pytest.fixture(scope="session")
def ana(s):
    """Log into Ana. If her password was changed by a prior run this will fail and downstream tests will skip."""
    r = s.post(f"{API}/auth/login", json={"email": ANA_EMAIL, "password": ANA_PW})
    if r.status_code != 200:
        pytest.skip(f"Ana login failed ({r.status_code}): {r.text[:200]}")
    d = r.json()
    return {"access": d["access_token"], "user": d["user"], "id": d["user"]["id"]}


@pytest.fixture(scope="session")
def ana_group_id(s, ana):
    """Return Ana's first group id (do not modify)."""
    r = s.get(f"{API}/groups", headers={"Authorization": f"Bearer {ana['access']}"})
    assert r.status_code == 200
    groups = r.json()
    assert len(groups) >= 1, "Ana should have at least one group"
    return groups[0]["id"]


# ------------------ REGISTER → onboarding.step == 'profile' ------------------
class TestRegisterOnboarding:
    def test_register_step_is_profile(self, s):
        email = uniq_email("newu")
        r = s.post(f"{API}/auth/register", json={"email": email, "password": "Sentinel2026!"})
        assert r.status_code == 201, r.text
        u = r.json()["user"]
        onb = u.get("onboarding") or {}
        assert onb.get("step") == "profile", f"expected step=profile, got {onb}"
        assert onb.get("completed") is False


# ------------------ SOS EVENT ------------------
class TestSosEvent:
    def test_sos_event_created(self, s, ana, ana_group_id):
        h = {"Authorization": f"Bearer {ana['access']}"}
        r = s.post(f"{API}/events", headers=h, json={
            "group_id": ana_group_id, "kind": "emergency", "severity": "critical",
            "message": "SOS: necesito ayuda", "lat": 40.4, "lng": -3.7,
        })
        assert r.status_code in (200, 201), r.text
        ev = r.json()
        assert ev.get("kind") == "emergency"
        assert ev.get("severity") == "critical"


# ------------------ POSITIONS include has_photo ------------------
class TestPositionsHasPhoto:
    def test_positions_include_has_photo(self, s, ana, ana_group_id):
        h = {"Authorization": f"Bearer {ana['access']}"}
        r = s.get(f"{API}/groups/{ana_group_id}/positions", headers=h)
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list) and len(items) >= 1
        for p in items:
            assert "has_photo" in p, f"missing has_photo key in position: {p}"
            assert isinstance(p["has_photo"], bool)


# ------------------ DELETE /api/groups/{id} ------------------
class TestGroupDelete:
    def test_delete_group_lifecycle(self, s):
        # Throwaway user B
        email = uniq_email("delgrp")
        r = s.post(f"{API}/auth/register", json={"email": email, "password": "Sentinel2026!"})
        assert r.status_code == 201
        tok = r.json()["access_token"]
        h = {"Authorization": f"Bearer {tok}"}
        # Give B a profile (create_group doesn't require profile but keeps things clean)
        s.put(f"{API}/profile", headers={**h, "Content-Type": "application/json"}, json={"name": "Beto"})
        # Create group
        r = s.post(f"{API}/groups", headers={**h, "Content-Type": "application/json"}, json={"name": "TEST_TempGroup"})
        assert r.status_code == 201, r.text
        gid = r.json()["id"]
        # Delete it
        r = s.delete(f"{API}/groups/{gid}", headers=h)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True
        # GET /groups no longer lists it
        r = s.get(f"{API}/groups", headers=h)
        assert r.status_code == 200
        assert not any(g["id"] == gid for g in r.json())
        # Delete again → 404
        r = s.delete(f"{API}/groups/{gid}", headers=h)
        assert r.status_code == 404, r.text


# ------------------ PROFILE PHOTO ------------------
class TestProfilePhoto:
    def test_upload_get_delete_and_permissions(self, s, ana):
        h = {"Authorization": f"Bearer {ana['access']}"}
        # 1. Wrong content-type -> 415
        files = {"file": ("hello.txt", io.BytesIO(b"hi"), "text/plain")}
        r = s.post(f"{API}/profile/photo", headers=h, files=files)
        assert r.status_code == 415, r.text

        # 2. Upload valid JPEG
        jpeg = _make_jpeg()
        files = {"file": ("photo.jpg", io.BytesIO(jpeg), "image/jpeg")}
        r = s.post(f"{API}/profile/photo", headers=h, files=files)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True and body.get("has_photo") is True

        # 3. /auth/me shows has_photo=true
        r = s.get(f"{API}/auth/me", headers=h)
        assert r.status_code == 200
        assert r.json().get("has_photo") is True

        my_id = ana["id"]
        photo_url = f"{API}/media/user/{my_id}/photo"

        # 4. With bearer header
        r = s.get(photo_url, headers=h)
        assert r.status_code == 200, r.text
        assert r.headers.get("Content-Type", "").startswith("image/jpeg")

        # 5. With ?token= and no header
        r = requests.get(photo_url, params={"token": ana["access"]})
        assert r.status_code == 200, r.text
        assert r.headers.get("Content-Type", "").startswith("image/jpeg")

        # 6. Without any token → 401
        r = requests.get(photo_url)
        assert r.status_code == 401, r.text

        # 7. Different user not sharing a group → 403
        email_b = uniq_email("photoB")
        rr = s.post(f"{API}/auth/register", json={"email": email_b, "password": "Sentinel2026!"})
        assert rr.status_code == 201
        tok_b = rr.json()["access_token"]
        r = requests.get(photo_url, headers={"Authorization": f"Bearer {tok_b}"})
        assert r.status_code == 403, r.text

        # 8. DELETE cleanup → then GET → 404
        r = s.delete(f"{API}/profile/photo", headers=h)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True
        r = s.get(photo_url, headers=h)
        assert r.status_code == 404, r.text
        # /auth/me has_photo=false
        r = s.get(f"{API}/auth/me", headers=h)
        assert r.json().get("has_photo") is False
