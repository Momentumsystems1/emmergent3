"""Iteration 18 — Group birth (planned_size + reserved slots) & partial PATCH regressions.

Covers backend spec:
- POST /api/groups with {name, planned_size} stores planned_size and returns stats.reserved = planned_size - members
- planned_size is capped by the plan (free.maxPermanentMembers = 5 → 9 becomes 5)
- PATCH /api/groups/{id} partial updates: {name} alone does NOT wipe planned_size,
  {planned_size} alone does NOT wipe the name, negative values clamp to 0.
- GET /api/groups and GET /api/groups/{id} include stats.reserved and planned_size.
- Regression: invite-link is idempotent and returns {link, code}; by-code resolves the token;
  a fresh user can register + accept and reserved goes down by 1.
"""
import os
import secrets

import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL") or "").rstrip("/")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL/EXPO_BACKEND_URL not configured"

PASSWORD = "Sentinel2026!"


# ---------------------------- helpers ----------------------------
def _register(email: str | None = None) -> tuple[str, str]:
    """Create a throwaway account, return (email, access_token)."""
    email = email or f"TEST_it18_{secrets.token_hex(4)}@sentinelfamily.app"
    r = requests.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": PASSWORD}, timeout=20)
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token") or (data.get("tokens") or {}).get("access_token")
    assert tok, f"no access_token in register response: {data}"
    return email, tok


def _headers(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------------------------- fixtures ----------------------------
@pytest.fixture(scope="module")
def owner():
    email, tok = _register()
    return {"email": email, "token": tok}


@pytest.fixture(scope="module")
def owner_headers(owner):
    return _headers(owner["token"])


# ---------------------------- POST /groups: planned_size + reserved ----------------------------
class TestCreateGroupPlannedSize:
    def test_create_with_planned_size_returns_reserved(self, owner_headers):
        r = requests.post(f"{BASE_URL}/api/groups", headers=owner_headers,
                          json={"name": "TEST_it18_A", "planned_size": 5}, timeout=20)
        assert r.status_code == 201, r.text
        g = r.json()
        assert g["name"] == "TEST_it18_A"
        assert g.get("planned_size") == 5
        # owner is 1 member → reserved = 5 - 1
        assert g["stats"]["reserved"] == 4, f"expected reserved=4, got {g['stats']}"
        assert g["stats"]["members"] == 1

    def test_planned_size_capped_by_plan(self):
        # Fresh user → free plan, maxPermanentMembers = 5. planned_size=9 must clamp to 5.
        _, tok = _register()
        r = requests.post(f"{BASE_URL}/api/groups", headers=_headers(tok),
                          json={"name": "TEST_it18_cap", "planned_size": 9}, timeout=20)
        assert r.status_code == 201, r.text
        g = r.json()
        assert g["planned_size"] == 5, f"expected clamp to 5, got {g.get('planned_size')}"
        # owner counts as 1 member → reserved = 5 - 1 = 4
        assert g["stats"]["reserved"] == 4

    def test_planned_size_negative_clamps_to_zero(self):
        _, tok = _register()
        r = requests.post(f"{BASE_URL}/api/groups", headers=_headers(tok),
                          json={"name": "TEST_it18_neg", "planned_size": -3}, timeout=20)
        assert r.status_code == 201, r.text
        g = r.json()
        assert g["planned_size"] == 0
        assert g["stats"]["reserved"] == 0


# ---------------------------- PATCH partial semantics ----------------------------
class TestPatchGroupPartial:
    @pytest.fixture(scope="class")
    def gid(self):
        _, tok = _register()
        r = requests.post(f"{BASE_URL}/api/groups", headers=_headers(tok),
                          json={"name": "TEST_it18_patch", "planned_size": 4}, timeout=20)
        assert r.status_code == 201, r.text
        return {"token": tok, "gid": r.json()["id"]}

    def test_patch_name_only_keeps_planned_size(self, gid):
        h = _headers(gid["token"])
        r = requests.patch(f"{BASE_URL}/api/groups/{gid['gid']}", headers=h,
                           json={"name": "TEST_it18_renamed"}, timeout=20)
        assert r.status_code == 200, r.text
        g = r.json()
        assert g["name"] == "TEST_it18_renamed"
        assert g["planned_size"] == 4, "planned_size must be preserved when only name is patched"

    def test_patch_planned_size_only_keeps_name(self, gid):
        h = _headers(gid["token"])
        r = requests.patch(f"{BASE_URL}/api/groups/{gid['gid']}", headers=h,
                           json={"planned_size": 3}, timeout=20)
        assert r.status_code == 200, r.text
        g = r.json()
        assert g["name"] == "TEST_it18_renamed", "name must be preserved when only planned_size is patched"
        assert g["planned_size"] == 3
        # owner alone → reserved = 3 - 1 = 2
        assert g["stats"]["reserved"] == 2

    def test_patch_planned_size_negative_clamps_to_zero(self, gid):
        h = _headers(gid["token"])
        r = requests.patch(f"{BASE_URL}/api/groups/{gid['gid']}", headers=h,
                           json={"planned_size": -5}, timeout=20)
        assert r.status_code == 200, r.text
        g = r.json()
        assert g["planned_size"] == 0
        assert g["stats"]["reserved"] == 0
        # name still preserved
        assert g["name"] == "TEST_it18_renamed"


# ---------------------------- GET returns planned_size + reserved ----------------------------
class TestListAndDetailExposeReserved:
    def test_list_and_detail_include_reserved_and_planned_size(self):
        _, tok = _register()
        h = _headers(tok)
        r = requests.post(f"{BASE_URL}/api/groups", headers=h,
                          json={"name": "TEST_it18_list", "planned_size": 4}, timeout=20)
        assert r.status_code == 201
        gid = r.json()["id"]

        lst = requests.get(f"{BASE_URL}/api/groups", headers=h, timeout=20)
        assert lst.status_code == 200
        found = [g for g in lst.json() if g["id"] == gid]
        assert found, "created group must appear in GET /groups"
        g = found[0]
        assert g.get("planned_size") == 4
        assert g["stats"]["reserved"] == 3  # 4 - 1 (owner)

        det = requests.get(f"{BASE_URL}/api/groups/{gid}", headers=h, timeout=20)
        assert det.status_code == 200
        assert det.json().get("planned_size") == 4
        assert det.json()["stats"]["reserved"] == 3


# ---------------------------- Regression: invite-link + by-code + accept ----------------------------
class TestInviteLinkAndAccept:
    def test_full_invite_flow_reserved_decreases_on_accept(self):
        # Owner
        _, otok = _register()
        oh = _headers(otok)
        r = requests.post(f"{BASE_URL}/api/groups", headers=oh,
                          json={"name": "TEST_it18_invite", "planned_size": 5}, timeout=20)
        assert r.status_code == 201, r.text
        gid = r.json()["id"]
        assert r.json()["stats"]["reserved"] == 4

        # invite-link is idempotent and returns {link, code}
        l1 = requests.post(f"{BASE_URL}/api/groups/{gid}/invite-link", headers=oh, timeout=20)
        assert l1.status_code == 200, l1.text
        d1 = l1.json()
        assert d1.get("link") and d1.get("code"), f"missing link/code in {d1}"
        assert len(d1["code"]) == 6

        l2 = requests.post(f"{BASE_URL}/api/groups/{gid}/invite-link", headers=oh, timeout=20)
        assert l2.status_code == 200
        d2 = l2.json()
        assert d2["code"] == d1["code"], "invite-link must be idempotent (same code)"
        assert d2["token"] == d1["token"]

        # by-code resolves the token (uppercase + lowercase)
        by = requests.get(f"{BASE_URL}/api/invitations/by-code/{d1['code'].lower()}", timeout=20)
        assert by.status_code == 200, by.text
        assert by.json()["token"] == d1["token"]

        by_bad = requests.get(f"{BASE_URL}/api/invitations/by-code/ZZZZZZ", timeout=20)
        assert by_bad.status_code == 404

        # New user registers and accepts
        _, gtok = _register()
        gh = _headers(gtok)
        resp = requests.post(f"{BASE_URL}/api/invitations/by-token/{d1['token']}/respond",
                             headers=gh, json={"accept": True}, timeout=20)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body.get("status") == "accepted"
        assert body.get("group_id") == gid

        # Owner sees reserved decrease by 1
        det = requests.get(f"{BASE_URL}/api/groups/{gid}", headers=oh, timeout=20)
        assert det.status_code == 200
        assert det.json()["stats"]["members"] == 2
        assert det.json()["stats"]["reserved"] == 3, f"expected reserved=3 after accept, got {det.json()['stats']}"

        # Guest sees the group in their list
        gl = requests.get(f"{BASE_URL}/api/groups", headers=gh, timeout=20)
        assert gl.status_code == 200
        assert any(g["id"] == gid for g in gl.json())
