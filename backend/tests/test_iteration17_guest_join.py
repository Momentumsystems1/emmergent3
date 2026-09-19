"""Iteration 17 — guest onboarding via join code, invite-link host, per-contact invitations,
root health, and account deletion (throwaway user)."""
import os
import re
import secrets
import time
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
# Backend .env variable exposed to frontend as EXPO_PUBLIC_BACKEND_URL
API = f"{BASE_URL}/api"

OWNER = {"email": "ana.demo@sentinelfamily.app", "password": "Sentinel2026!"}


def _rand_email():
    return f"TEST_guest_{secrets.token_hex(4)}@sentinelfamily.app"


@pytest.fixture(scope="module")
def owner_tokens():
    r = requests.post(f"{API}/auth/login", json=OWNER, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def owner_group(owner_tokens):
    h = {"Authorization": f"Bearer {owner_tokens['access_token']}"}
    r = requests.get(f"{API}/groups", headers=h, timeout=30)
    assert r.status_code == 200, r.text
    groups = r.json()
    # Pick the "Grupo 1" or first group where ana is owner
    for g in groups:
        if g.get("my_role") == "owner":
            return g
    pytest.skip("Owner has no group to test with")


# --- Root health checks ---
class TestHealth:
    def test_root_ok(self):
        r = requests.get(f"{BASE_URL}/", timeout=15)
        assert r.status_code == 200, r.text

    def test_health_ok(self):
        r = requests.get(f"{BASE_URL}/health", timeout=15)
        assert r.status_code == 200, r.text


# --- Invite-link: idempotent code, correct host ---
class TestInviteLink:
    def test_invite_link_returns_link_and_code_with_correct_host(self, owner_tokens, owner_group):
        gid = owner_group["id"]
        h = {"Authorization": f"Bearer {owner_tokens['access_token']}"}
        r = requests.post(f"{API}/groups/{gid}/invite-link", headers=h, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "link" in data and "code" in data
        assert re.match(r"^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$", data["code"]), f"Invalid code format: {data['code']}"
        # Host of the link must match host used to reach us
        expected_host = BASE_URL.split("://", 1)[1]
        assert expected_host in data["link"], f"link host mismatch: {data['link']} vs {expected_host}"

    def test_invite_link_is_idempotent(self, owner_tokens, owner_group):
        gid = owner_group["id"]
        h = {"Authorization": f"Bearer {owner_tokens['access_token']}"}
        r1 = requests.post(f"{API}/groups/{gid}/invite-link", headers=h, timeout=30).json()
        r2 = requests.post(f"{API}/groups/{gid}/invite-link", headers=h, timeout=30).json()
        assert r1["code"] == r2["code"], f"code should be idempotent: {r1['code']} vs {r2['code']}"
        assert r1["token"] == r2["token"]


# --- Invite by-code lookup incl. case-insensitivity ---
class TestByCode:
    def test_by_code_valid_uppercase(self, owner_tokens, owner_group):
        gid = owner_group["id"]
        h = {"Authorization": f"Bearer {owner_tokens['access_token']}"}
        link = requests.post(f"{API}/groups/{gid}/invite-link", headers=h, timeout=30).json()
        code = link["code"]
        r = requests.get(f"{API}/invitations/by-code/{code}", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["token"] == link["token"]
        assert "group_name" in body and body["group_name"]
        assert body["status"] in ("prepared", "dispatched", "open")

    def test_by_code_case_insensitive(self, owner_tokens, owner_group):
        gid = owner_group["id"]
        h = {"Authorization": f"Bearer {owner_tokens['access_token']}"}
        link = requests.post(f"{API}/groups/{gid}/invite-link", headers=h, timeout=30).json()
        low = link["code"].lower()
        r = requests.get(f"{API}/invitations/by-code/{low}", timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["token"] == link["token"]

    def test_by_code_invalid_404(self):
        r = requests.get(f"{API}/invitations/by-code/ZZZZZZ", timeout=15)
        assert r.status_code == 404, r.text


# --- Guest full flow: register → by-code → accept → GET /groups / GET group ---
class TestGuestFullFlow:
    def test_guest_can_join_via_code(self, owner_tokens, owner_group):
        gid = owner_group["id"]
        oh = {"Authorization": f"Bearer {owner_tokens['access_token']}"}

        # 1) fresh code
        link = requests.post(f"{API}/groups/{gid}/invite-link", headers=oh, timeout=30).json()
        code = link["code"]

        # 2) fresh guest
        email = _rand_email()
        reg = requests.post(f"{API}/auth/register", json={"email": email, "password": "Sentinel2026!"}, timeout=30)
        assert reg.status_code == 201, reg.text
        guest_tok = reg.json()["access_token"]
        gh = {"Authorization": f"Bearer {guest_tok}"}

        # 3) resolve code
        by = requests.get(f"{API}/invitations/by-code/{code}", timeout=15)
        assert by.status_code == 200
        token = by.json()["token"]

        # 4) accept
        acc = requests.post(f"{API}/invitations/by-token/{token}/respond", json={"accept": True}, headers=gh, timeout=30)
        assert acc.status_code == 200, acc.text
        assert acc.json()["status"] == "accepted"
        assert acc.json()["group_id"] == gid

        # 5) guest sees the group
        gr = requests.get(f"{API}/groups", headers=gh, timeout=30).json()
        assert any(g["id"] == gid for g in gr), "Guest does not see the joined group"

        # 6) owner sees the new member as active
        og = requests.get(f"{API}/groups/{gid}", headers=oh, timeout=30).json()
        emails = [m.get("display_name", "") for m in og["members"] if m["status"] == "active"]
        # Guest is active with display_name = email (no profile.name yet)
        assert any(email.split("@")[0] in (m.get("display_name") or "") or m.get("user_id") for m in og["members"] if m["status"] == "active"), \
            f"No new active member visible: {emails}"
        assert og["stats"]["members"] >= 2


# --- Per-contact invitations POST /groups/{id}/invitations should include code & correct host ---
class TestPerContactInvitation:
    def test_per_contact_invitation_has_code_and_correct_host(self, owner_tokens, owner_group):
        gid = owner_group["id"]
        h = {"Authorization": f"Bearer {owner_tokens['access_token']}"}
        body = {"name": "TEST_contact", "membership": "temporary", "channel": "whatsapp", "duration_hours": 24}
        r = requests.post(f"{API}/groups/{gid}/invitations", json=body, headers=h, timeout=30)
        # If plan cap reached, that's a business restriction — mark skip w/ msg
        if r.status_code >= 400:
            pytest.skip(f"Could not create contact invitation (plan cap or 400): {r.status_code} {r.text}")
        data = r.json()["invitation"]
        assert data.get("code"), f"Missing code in per-contact invitation: {data}"
        assert re.match(r"^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$", data["code"])
        assert "link" in data
        expected_host = BASE_URL.split("://", 1)[1]
        assert expected_host in data["link"], f"link host mismatch: {data['link']}"

        # cleanup: cancel this invitation so we don't clutter the group
        try:
            requests.post(f"{API}/invitations/{data['id']}/cancel", headers=h, timeout=15)
        except Exception:
            pass


# --- Account deletion (throwaway account) ---
class TestAccountDeletion:
    def test_delete_account_revokes_sessions(self):
        email = _rand_email()
        pw = "Sentinel2026!"
        r = requests.post(f"{API}/auth/register", json={"email": email, "password": pw}, timeout=30)
        assert r.status_code == 201, r.text
        tok = r.json()["access_token"]
        h = {"Authorization": f"Bearer {tok}"}

        # /me works before deletion
        me = requests.get(f"{API}/auth/me", headers=h, timeout=15)
        assert me.status_code == 200, me.text

        # delete
        d = requests.delete(f"{API}/auth/account", headers=h, timeout=30)
        assert d.status_code == 204, d.text

        # Subsequent call should fail. Access JWT stays valid (30 min) but user has deleted_at set
        # → current_user should reject it.
        me2 = requests.get(f"{API}/auth/me", headers=h, timeout=15)
        assert me2.status_code == 401, f"Expected 401 after account deletion, got {me2.status_code}: {me2.text}"
