"""Iteration 12 — Google-Maps-like groups bar & big location FAB.
Backend focus: GET /api/groups (Bearer) returns stats with 'connected' integer >= 0
alongside existing members/pending/alerts. Also sanity-check members and alerts fields.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/") or os.environ.get("EXPO_BACKEND_URL", "").rstrip("/")

ANA_EMAIL = "ana.demo@sentinelfamily.app"
ANA_PASSWORD = "Sentinel2026!"


@pytest.fixture(scope="module")
def ana_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ANA_EMAIL, "password": ANA_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok, f"no token in login response: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def headers(ana_token):
    return {"Authorization": f"Bearer {ana_token}", "Content-Type": "application/json"}


class TestGroupsListStats:
    """GET /api/groups must expose stats.connected as an int >= 0."""

    def test_groups_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/groups", timeout=15)
        assert r.status_code in (401, 403), f"expected 401/403 without auth, got {r.status_code}"

    def test_groups_returns_list(self, headers):
        r = requests.get(f"{BASE_URL}/api/groups", headers=headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list), f"expected list, got {type(data)}"
        assert len(data) >= 1, "Ana should own at least one group ('Grupo 1')"

    def test_group_has_connected_stat(self, headers):
        r = requests.get(f"{BASE_URL}/api/groups", headers=headers, timeout=20)
        assert r.status_code == 200
        for g in r.json():
            assert "stats" in g, f"group {g.get('id')} missing stats"
            stats = g["stats"]
            # required numeric keys
            for k in ("members", "connected", "pending", "alerts"):
                assert k in stats, f"stats missing '{k}' on group {g.get('name')}"
                assert isinstance(stats[k], int), f"stats.{k} must be int, got {type(stats[k]).__name__}={stats[k]}"
                assert stats[k] >= 0, f"stats.{k} must be >= 0, got {stats[k]}"
            # 'connected' cannot be greater than 'members' logically (active members connected)
            assert stats["connected"] <= stats["members"] + stats["pending"], \
                f"connected({stats['connected']}) exceeds members+pending on {g.get('name')}"

    def test_group_shape(self, headers):
        r = requests.get(f"{BASE_URL}/api/groups", headers=headers, timeout=20)
        for g in r.json():
            assert "id" in g and isinstance(g["id"], str)
            assert "name" in g and isinstance(g["name"], str)
            assert "members" in g and isinstance(g["members"], list)

    def test_group_detail_also_has_connected(self, headers):
        r = requests.get(f"{BASE_URL}/api/groups", headers=headers, timeout=20)
        gid = r.json()[0]["id"]
        r2 = requests.get(f"{BASE_URL}/api/groups/{gid}", headers=headers, timeout=20)
        assert r2.status_code == 200, r2.text
        stats = r2.json()["stats"]
        assert "connected" in stats and isinstance(stats["connected"], int) and stats["connected"] >= 0
