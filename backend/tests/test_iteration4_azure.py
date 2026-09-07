"""Iteration 4 review tests: Azure Maps tiles, static map, traffic incidents, weather."""
import os
import pytest
import requests

FRONTEND_ENV = "/app/frontend/.env"
BASE_URL = None
with open(FRONTEND_ENV) as f:
    for line in f:
        if line.strip().startswith("EXPO_PUBLIC_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
            break
assert BASE_URL
API = f"{BASE_URL}/api"

ANA_EMAIL = "ana.demo@sentinelfamily.app"
ANA_PASS = "Sentinel2026!"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def ana_token(s):
    r = s.post(f"{API}/auth/login", json={"email": ANA_EMAIL, "password": ANA_PASS})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ------------------ TILES (no auth required) ------------------
class TestTiles:
    def test_road_tile_200_png(self, s):
        r = s.get(f"{API}/mobility/tiles/road/12/2008/1543.png", timeout=15)
        assert r.status_code == 200, r.text[:200]
        assert r.headers.get("content-type", "").startswith("image/")
        assert len(r.content) > 500

    def test_traffic_tile_200_png(self, s):
        r = s.get(f"{API}/mobility/tiles/traffic/12/2008/1543.png", timeout=15)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image/")

    def test_incidents_tile_200_png(self, s):
        r = s.get(f"{API}/mobility/tiles/incidents/12/2008/1543.png", timeout=15)
        assert r.status_code == 200
        # NOTE: Azure returns vector tile (application/vnd.mapbox-vector-tile) for
        # microsoft.traffic.incident tileset — proxied as-is. This is technically a
        # naming inconsistency (URL says .png but body is vector); flagged, not blocking.
        ct = r.headers.get("content-type", "")
        assert ct.startswith("image/") or "mapbox-vector-tile" in ct

    def test_bogus_tileset_404(self, s):
        r = s.get(f"{API}/mobility/tiles/bogus/12/2008/1543.png", timeout=15)
        assert r.status_code == 404


# ------------------ STATIC MAP (no auth) ------------------
class TestStaticMap:
    def test_static_map_with_pins_and_path(self, s):
        r = s.get(
            f"{API}/mobility/static.png",
            params={
                "lat": 40.4168, "lng": -3.7038, "zoom": 13, "w": 390, "h": 700,
                "pins": "40.4168,-3.7038,E11D48",
                "path": "40.40,-3.70;40.41,-3.705",
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text[:300]
        assert r.headers.get("content-type", "").startswith("image/")
        assert len(r.content) > 1000


# ------------------ INCIDENTS ------------------
class TestIncidents:
    def test_incidents_without_auth_401(self, s):
        r = requests.get(
            f"{API}/mobility/incidents",
            params={"min_lat": 40.30, "min_lng": -3.90, "max_lat": 40.55, "max_lng": -3.50},
            timeout=15,
        )
        assert r.status_code == 401

    def test_incidents_with_auth_madrid(self, s, ana_token):
        r = s.get(
            f"{API}/mobility/incidents",
            headers=h(ana_token),
            params={"min_lat": 40.30, "min_lng": -3.90, "max_lat": 40.55, "max_lng": -3.50},
            timeout=20,
        )
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert isinstance(data, list)
        # Likely non-empty in Madrid; not strictly required
        if data:
            first = data[0]
            for field in ("id", "lat", "lng", "type", "title", "description",
                          "severity", "delay_s", "road_closed", "jam"):
                assert field in first, f"missing '{field}' in {first}"


# ------------------ WEATHER ------------------
class TestWeather:
    def test_weather_madrid(self, s, ana_token):
        r = s.get(
            f"{API}/mobility/weather",
            headers=h(ana_token),
            params={"lat": 40.4168, "lng": -3.7038},
            timeout=20,
        )
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert "phrase" in d
        # temp_c should be number if present
        if d.get("temp_c") is not None:
            assert isinstance(d["temp_c"], (int, float))
        assert isinstance(d.get("alerts"), list)
        for a in d["alerts"]:
            assert "title" in a and "level" in a and "source" in a
        assert d.get("provider") == "azure_maps"


# ------------------ PROVIDERS ------------------
class TestProviders:
    def test_providers_weather_and_incidents(self, s):
        r = s.get(f"{API}/mobility/providers", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["weather"]["configured"] is True
        assert d["traffic"]["incidents"] is True


# ------------------ REGRESSION ------------------
class TestRegression:
    def test_reverse(self, s, ana_token):
        r = s.get(f"{API}/mobility/reverse", headers=h(ana_token),
                  params={"lat": 40.4168, "lng": -3.7038}, timeout=15)
        assert r.status_code == 200
        assert "name" in r.json()

    def test_nav_route(self, s, ana_token):
        r = s.post(f"{API}/mobility/nav-route", headers=h(ana_token),
                   json={"points": [[40.4168, -3.7038], [40.4530, -3.6883]], "mode": "car"},
                   timeout=25)
        assert r.status_code == 200, r.text[:200]
        d = r.json()
        assert d["distance_m"] > 0 and d["duration_s"] > 0
        assert "geometry" in d and len(d["geometry"]) > 2

    def test_autocomplete(self, s, ana_token):
        r = s.get(f"{API}/mobility/autocomplete", headers=h(ana_token),
                  params={"q": "Gran Via"}, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
