"""Iteration 5 — Emergent-managed Google sign-in (POST /api/auth/session) + auth regression.

Covers:
  - POST /api/auth/session with bogus session_id → 401 (Spanish detail)
  - POST /api/auth/session missing body field → 422
  - POST /api/auth/session with wrong field name (`session_token`) → 422
  - Regression on existing email/password flow (ana.demo, /me, /refresh)
  - Register of a throwaway user still works
  - Backend health OK (GET /api/)
"""
import os
import uuid

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
ANA_PWD = "Sentinel2026!"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def auth_h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------------- health ----------------
class TestHealth:
    def test_api_root_ok(self, s):
        r = s.get(f"{API}/")
        assert r.status_code == 200, r.text
        # Sentinel returns a small JSON payload — just make sure it's a dict
        j = r.json()
        assert isinstance(j, dict)


# ---------------- /auth/session validation ----------------
class TestGoogleSession:
    def test_bogus_session_id_401_spanish(self, s):
        r = s.post(f"{API}/auth/session", json={"session_id": "bogus-session"})
        assert r.status_code == 401, r.text
        detail = r.json().get("detail", "")
        # Spanish detail expected (from routers/auth.py)
        assert isinstance(detail, str)
        assert (
            "Google" in detail
            or "sesi" in detail.lower()
            or "expirada" in detail.lower()
        ), detail

    def test_missing_body_field_422(self, s):
        r = s.post(f"{API}/auth/session", json={})
        assert r.status_code == 422, r.text

    def test_wrong_field_name_422(self, s):
        # `session_token` is not what the model expects; must be `session_id`.
        r = s.post(f"{API}/auth/session", json={"session_token": "x"})
        assert r.status_code == 422, r.text

    def test_empty_string_session_id_401(self, s):
        # Empty string is a valid string per Pydantic but should still fail Emergent's lookup → 401.
        r = s.post(f"{API}/auth/session", json={"session_id": ""})
        assert r.status_code in (401, 422), r.text


# ---------------- existing auth regression ----------------
class TestExistingAuthRegression:
    def test_ana_login_returns_tokens_and_user(self, s):
        r = s.post(f"{API}/auth/login", json={"email": ANA_EMAIL, "password": ANA_PWD})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["token_type"] == "bearer"
        assert d["access_token"] and d["refresh_token"]
        assert d["user"]["email"].lower() == ANA_EMAIL
        # Password hash never leaks
        assert "password_hash" not in d["user"]

    def test_me_with_bearer_returns_ana(self, s):
        r = s.post(f"{API}/auth/login", json={"email": ANA_EMAIL, "password": ANA_PWD})
        tok = r.json()["access_token"]
        me = s.get(f"{API}/auth/me", headers=auth_h(tok))
        assert me.status_code == 200
        assert me.json()["email"].lower() == ANA_EMAIL

    def test_refresh_rotates_and_old_dies(self, s):
        r = s.post(f"{API}/auth/login", json={"email": ANA_EMAIL, "password": ANA_PWD})
        old = r.json()["refresh_token"]
        r2 = s.post(f"{API}/auth/refresh", json={"refresh_token": old})
        assert r2.status_code == 200
        assert r2.json()["refresh_token"] != old
        r3 = s.post(f"{API}/auth/refresh", json={"refresh_token": old})
        assert r3.status_code == 401

    def test_register_throwaway_google_named_user(self, s):
        # Simulates the human tester registering `tester+google<rand>@sentinelfamily.app` with password
        email = f"TEST_tester_google_{uuid.uuid4().hex[:8]}@sentinelfamily.app"
        r = s.post(f"{API}/auth/register", json={"email": email, "password": "Sentinel2026!"})
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["user"]["email"].lower() == email.lower()
        assert d["access_token"] and d["refresh_token"]

    def test_login_wrong_password_returns_generic_401(self, s):
        r = s.post(f"{API}/auth/login", json={"email": ANA_EMAIL, "password": "not-the-right-one"})
        assert r.status_code == 401
        detail = r.json().get("detail", "")
        # Password-user with wrong pwd → generic message, NOT "Esta cuenta usa Google"
        assert "Google" not in detail
