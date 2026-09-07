"""Iteration 3 tests: reverse geocoding, multi-use group invite link, trips, nav-route.

Uses the public EXPO_PUBLIC_BACKEND_URL. Reuses helpers from backend_test.py conventions.
"""
import os
import uuid
import time
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


def uniq_email(prefix="user"):
    return f"TEST_{prefix}_{uuid.uuid4().hex[:10]}@sentinelfamily.app"


def auth_h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def ana(s):
    """Login as Ana (existing owner of 'Grupo 1', onboarding done)."""
    r = s.post(f"{API}/auth/login", json={"email": "ana.demo@sentinelfamily.app", "password": "Sentinel2026!"})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def ana_group(s, ana):
    r = s.get(f"{API}/groups", headers=auth_h(ana["access_token"]))
    assert r.status_code == 200
    groups = r.json()
    assert len(groups) >= 1, "Ana must own at least one group"
    return groups[0]


# ---------------- reverse geocoding ----------------
class TestReverseGeocoding:
    def test_reverse_madrid_center(self, s, ana):
        r = s.get(f"{API}/mobility/reverse", params={"lat": 40.4168, "lng": -3.7038},
                  headers=auth_h(ana["access_token"]))
        assert r.status_code == 200, r.text
        d = r.json()
        assert "Madrid" in (d.get("name") or "") or (d.get("municipality") or "").lower() == "madrid"

    def test_reverse_nan_lat_unavailable(self, s, ana):
        r = s.get(f"{API}/mobility/reverse", params={"lat": "NaN", "lng": -3.7038},
                  headers=auth_h(ana["access_token"]))
        # NaN gets parsed by FastAPI → 503 (Unavailable) OR 4xx (validation)
        assert r.status_code in (400, 422, 503), r.text


# ---------------- multi-use invite link ----------------
class TestInviteLink:
    def test_create_returns_multi_true(self, s, ana, ana_group):
        gid = ana_group["id"]
        r = s.post(f"{API}/groups/{gid}/invite-link", headers=auth_h(ana["access_token"]))
        assert r.status_code in (200, 201), r.text
        d = r.json()
        assert d.get("multi") is True
        assert d.get("status") == "open"
        assert "/invite/" in d.get("link", "")
        assert d.get("token")

    def test_second_call_returns_same_token(self, s, ana, ana_group):
        gid = ana_group["id"]
        r1 = s.post(f"{API}/groups/{gid}/invite-link", headers=auth_h(ana["access_token"]))
        r2 = s.post(f"{API}/groups/{gid}/invite-link", headers=auth_h(ana["access_token"]))
        assert r1.status_code in (200, 201) and r2.status_code in (200, 201)
        d1, d2 = r1.json(), r2.json()
        assert d1["id"] == d2["id"]
        assert d1["token"] == d2["token"]

    def test_by_token_open_no_auth(self, s, ana, ana_group):
        gid = ana_group["id"]
        r = s.post(f"{API}/groups/{gid}/invite-link", headers=auth_h(ana["access_token"]))
        token = r.json()["token"]
        r2 = requests.get(f"{API}/invitations/by-token/{token}")
        assert r2.status_code == 200, r2.text
        assert r2.json()["status"] == "open"

    def test_respond_accept_new_user_becomes_member_and_second_respond_idempotent(self, s, ana, ana_group):
        gid = ana_group["id"]
        r = s.post(f"{API}/groups/{gid}/invite-link", headers=auth_h(ana["access_token"]))
        token = r.json()["token"]

        # Register a new user
        email = uniq_email("guest")
        rr = s.post(f"{API}/auth/register", json={"email": email, "password": "Sentinel2026!"})
        assert rr.status_code == 201, rr.text
        gtok = rr.json()["access_token"]

        # First respond → accepted
        rr = s.post(f"{API}/invitations/by-token/{token}/respond",
                    headers=auth_h(gtok), json={"accept": True})
        assert rr.status_code == 200, rr.text
        j = rr.json()
        assert j["status"] == "accepted"
        assert j.get("group_id") == gid

        # New user should appear as an active member
        rg = s.get(f"{API}/groups/{gid}", headers=auth_h(ana["access_token"]))
        assert rg.status_code == 200
        members = rg.json()["members"]
        new_user_id = rr.json().get("group_id") and None  # placeholder
        r_me = s.get(f"{API}/auth/me", headers=auth_h(gtok))
        my_uid = r_me.json()["id"]
        assert any(m.get("user_id") == my_uid and m["status"] == "active" for m in members), \
            "New user not in active members"

        # Second respond → already_member:true
        rr2 = s.post(f"{API}/invitations/by-token/{token}/respond",
                     headers=auth_h(gtok), json={"accept": True})
        assert rr2.status_code == 200, rr2.text
        assert rr2.json().get("already_member") is True

    def test_revoke_link_then_respond_409(self, s, ana, ana_group):
        gid = ana_group["id"]
        r = s.post(f"{API}/groups/{gid}/invite-link", headers=auth_h(ana["access_token"]))
        token = r.json()["token"]

        rv = s.post(f"{API}/groups/{gid}/invite-link/revoke", headers=auth_h(ana["access_token"]))
        assert rv.status_code == 200, rv.text

        # by-token status must no longer be 'open'
        rbt = requests.get(f"{API}/invitations/by-token/{token}")
        assert rbt.status_code == 200
        assert rbt.json()["status"] != "open"

        # New user respond after revoke → 409
        email = uniq_email("late")
        rr = s.post(f"{API}/auth/register", json={"email": email, "password": "Sentinel2026!"})
        gtok = rr.json()["access_token"]
        rr2 = s.post(f"{API}/invitations/by-token/{token}/respond",
                     headers=auth_h(gtok), json={"accept": True})
        assert rr2.status_code == 409, rr2.text


# ---------------- contacts invitation (phone) ----------------
class TestContactInvitation:
    def test_create_contact_invitation_echoes_phone(self, s, ana, ana_group):
        gid = ana_group["id"]
        r = s.post(f"{API}/groups/{gid}/invitations", headers=auth_h(ana["access_token"]),
                   json={"name": "Test Contacto", "membership": "fixed",
                         "channel": "whatsapp", "phone": "+34600000000"})
        # 201 with phone echoed OR 503 PLAN_UNAVAILABLE (plan cap) — both acceptable
        if r.status_code == 503 or r.status_code == 402:
            code = (r.json().get("detail") or {}).get("code")
            assert code in ("PLAN_UNAVAILABLE", "SERVICE_NOT_CONFIGURED"), r.text
            pytest.skip(f"Plan cap hit: {r.json()}")
        assert r.status_code == 201, r.text
        d = r.json()
        inv = d.get("invitation", d)
        assert inv.get("phone") == "+34600000000", inv


# ---------------- trips ----------------
@pytest.fixture(scope="module")
def guest_user(s):
    email = uniq_email("trip_guest")
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "Sentinel2026!"})
    assert r.status_code == 201
    return r.json()


@pytest.fixture(scope="module")
def guest_in_group(s, ana, ana_group, guest_user):
    """Ensure guest_user is a member of Ana's group (via invite link)."""
    gid = ana_group["id"]
    r = s.post(f"{API}/groups/{gid}/invite-link", headers=auth_h(ana["access_token"]))
    if r.status_code not in (200, 201):
        # Maybe revoked earlier — recreate
        r = s.post(f"{API}/groups/{gid}/invite-link", headers=auth_h(ana["access_token"]))
    if r.status_code not in (200, 201):
        pytest.skip("Cannot create invite link for trip guest fixture")
    token = r.json()["token"]
    # If link was revoked earlier by another test, the response may say status != open. Recreate by revoke+refresh may not work.
    if r.json().get("status") != "open":
        # Try to force a new open one (delete revoked ones manually is not possible without DB access). Skip.
        pytest.skip("Invite link is revoked; cannot join guest to group in this run")
    rr = s.post(f"{API}/invitations/by-token/{token}/respond",
                headers=auth_h(guest_user["access_token"]), json={"accept": True})
    assert rr.status_code == 200, rr.text
    r_me = s.get(f"{API}/auth/me", headers=auth_h(guest_user["access_token"]))
    return {"user_id": r_me.json()["id"], "access": guest_user["access_token"]}


class TestTrips:
    def test_full_trip_flow(self, s, ana, ana_group, guest_in_group):
        gid = ana_group["id"]
        ah = auth_h(ana["access_token"])
        gh = auth_h(guest_in_group["access"])

        # Create trip as Ana
        r = s.post(f"{API}/trips", headers=ah,
                   json={"group_id": gid, "lat": 40.42, "lng": -3.70, "place_name": "Test"})
        assert r.status_code == 201, r.text
        trip = r.json()
        tid = trip["id"]
        parts = trip["participants"]
        assert len(parts) == 1
        assert parts[0]["status"] == "leader"

        # Invite guest
        r = s.post(f"{API}/trips/{tid}/invite", headers=ah,
                   json={"user_ids": [guest_in_group["user_id"]]})
        assert r.status_code == 200, r.text
        assert guest_in_group["user_id"] in r.json()["invited"]

        # Guest lists pending trips
        r = s.get(f"{API}/trips/pending", headers=gh)
        assert r.status_code == 200
        pend = r.json()
        assert any(t["id"] == tid for t in pend), pend
        the = next(t for t in pend if t["id"] == tid)
        assert the.get("leader_name")  # not empty

        # Join
        r = s.post(f"{API}/trips/{tid}/join", headers=gh)
        assert r.status_code == 200, r.text

        # Get trip
        r = s.get(f"{API}/trips/{tid}", headers=gh)
        assert r.status_code == 200, r.text
        d = r.json()
        statuses = sorted(p["status"] for p in d["participants"])
        assert "leader" in statuses and "joined" in statuses
        for p in d["participants"]:
            assert isinstance(p.get("eta"), dict)
            assert "state" in p["eta"]

        # PATCH stops — leader ok, non-leader 403
        r = s.patch(f"{API}/trips/{tid}", headers=ah, json={"stops": [{"lat": 40.43, "lng": -3.71, "name": "Parada"}]})
        assert r.status_code == 200, r.text
        r = s.patch(f"{API}/trips/{tid}", headers=gh, json={"stops": []})
        assert r.status_code == 403, r.text

        # Close by non-leader 403, by leader 200
        r = s.post(f"{API}/trips/{tid}/close", headers=gh)
        assert r.status_code == 403, r.text
        r = s.post(f"{API}/trips/{tid}/close", headers=ah)
        assert r.status_code == 200, r.text


# ---------------- nav-route regression ----------------
class TestNavRoute:
    def test_nav_route_still_returns_steps_and_geometry(self, s, ana):
        r = s.post(f"{API}/mobility/nav-route", headers=auth_h(ana["access_token"]),
                   json={"points": [[40.45, -3.69], [40.4168, -3.7038]], "mode": "car"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d.get("steps"), list) and len(d["steps"]) >= 1
        s0 = d["steps"][0]
        assert "lat" in s0 and "lng" in s0
        assert isinstance(d.get("geometry"), list) and len(d["geometry"]) > 5
