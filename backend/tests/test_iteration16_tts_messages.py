"""Iteration 16 — TTS (OpenAI/Emergent) + Messages (per-group thread, inbox, unread)."""
import os
import time
import uuid

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


def uniq_email(prefix="m"):
    return f"TEST_{prefix}_{uuid.uuid4().hex[:10]}@sentinelfamily.app"


def auth_h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def owner(s):
    email = uniq_email("owner")
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "Sentinel2026!"})
    assert r.status_code == 201, r.text
    tok = r.json()["access_token"]
    uid = r.json()["user"]["id"]
    # profile
    s.put(f"{API}/profile", headers=auth_h(tok), json={"name": "Owner"})
    return {"email": email, "tok": tok, "id": uid}


@pytest.fixture(scope="module")
def group_two(s, owner):
    """Group with owner + a second active member (via group invite-link)."""
    r = s.post(f"{API}/groups", headers=auth_h(owner["tok"]), json={"name": "TEST_GrupoMsg"})
    assert r.status_code == 201, r.text
    gid = r.json()["id"]
    # multi-use link
    r = s.post(f"{API}/groups/{gid}/invite-link", headers=auth_h(owner["tok"]))
    assert r.status_code == 200
    token = r.json()["token"]
    # second user accepts
    email2 = uniq_email("mate")
    r = s.post(f"{API}/auth/register", json={"email": email2, "password": "Sentinel2026!"})
    assert r.status_code == 201
    tok2 = r.json()["access_token"]
    uid2 = r.json()["user"]["id"]
    s.put(f"{API}/profile", headers=auth_h(tok2), json={"name": "Mate"})
    r = s.post(f"{API}/invitations/by-token/{token}/respond",
               headers=auth_h(tok2), json={"accept": True})
    assert r.status_code == 200, r.text
    return {"gid": gid, "owner": owner, "mate": {"tok": tok2, "id": uid2}}


@pytest.fixture(scope="module")
def group_solo(s, owner):
    """Second group where owner is the only active member (to test 400)."""
    # Free plan allows only 1 group - use pro? Need a different owner.
    email = uniq_email("solo")
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "Sentinel2026!"})
    assert r.status_code == 201
    tok = r.json()["access_token"]
    r = s.post(f"{API}/groups", headers=auth_h(tok), json={"name": "TEST_Solo"})
    assert r.status_code == 201
    return {"gid": r.json()["id"], "tok": tok}


# -------------------- TTS --------------------
class TestTTS:
    def test_tts_requires_auth(self, s):
        r = s.post(f"{API}/tts", json={"text": "Hola"})
        assert r.status_code == 401

    def test_tts_generates_and_serves_mp3(self, s, owner):
        text = f"En 200 metros gira a la derecha. Prueba {uuid.uuid4().hex[:6]}"
        r = s.post(f"{API}/tts", headers=auth_h(owner["tok"]), json={"text": text})
        assert r.status_code in (200, 502, 503), r.text
        if r.status_code != 200:
            pytest.skip(f"TTS provider unavailable: {r.status_code} {r.text}")
        d = r.json()
        assert "key" in d and d["key"]
        assert d.get("url", "").endswith(".mp3")
        # GET the mp3
        r2 = s.get(f"{API}/tts/{d['key']}.mp3")
        assert r2.status_code == 200
        assert r2.headers.get("content-type", "").startswith("audio/mpeg")
        assert len(r2.content) > 500  # got real bytes

    def test_tts_cached_returns_same_key_fast(self, s, owner):
        text = f"Continúa por la avenida durante un kilómetro {uuid.uuid4().hex[:6]}"
        r = s.post(f"{API}/tts", headers=auth_h(owner["tok"]), json={"text": text})
        if r.status_code != 200:
            pytest.skip("TTS provider unavailable")
        k1 = r.json()["key"]
        t0 = time.time()
        r = s.post(f"{API}/tts", headers=auth_h(owner["tok"]), json={"text": text})
        assert r.status_code == 200
        assert r.json()["key"] == k1
        # cached path should not need to hit provider — under 2s reasonable
        assert time.time() - t0 < 3.0

    def test_tts_404_for_unknown_key(self, s):
        r = s.get(f"{API}/tts/deadbeef.mp3")
        assert r.status_code == 404


# -------------------- Messages --------------------
class TestMessages:
    def test_send_to_all_broadcasts(self, s, group_two):
        gid = group_two["gid"]
        r = s.post(f"{API}/groups/{gid}/messages",
                   headers=auth_h(group_two["owner"]["tok"]),
                   json={"recipient_ids": [], "text": "Hola a todos"})
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["text"] == "Hola a todos"
        assert group_two["mate"]["id"] in d["recipient_ids"]
        assert d["sender_id"] == group_two["owner"]["id"]

    def test_send_specific_recipient(self, s, group_two):
        gid = group_two["gid"]
        r = s.post(f"{API}/groups/{gid}/messages",
                   headers=auth_h(group_two["owner"]["tok"]),
                   json={"recipient_ids": [group_two["mate"]["id"]], "text": "Solo a ti"})
        assert r.status_code == 201
        d = r.json()
        assert d["recipient_ids"] == [group_two["mate"]["id"]]

    def test_send_no_recipients_solo_group_400(self, s, group_solo):
        r = s.post(f"{API}/groups/{group_solo['gid']}/messages",
                   headers=auth_h(group_solo["tok"]),
                   json={"recipient_ids": [], "text": "Nadie recibe esto"})
        assert r.status_code == 400
        # Server responds "No hay destinatarios disponibles" but review says "No hay destinatarios"
        assert "destinatarios" in str(r.json().get("detail", ""))

    def test_non_member_send_and_list_403(self, s, group_two):
        # New random user
        email = uniq_email("outsider")
        r = s.post(f"{API}/auth/register", json={"email": email, "password": "Sentinel2026!"})
        tok = r.json()["access_token"]
        gid = group_two["gid"]
        r = s.post(f"{API}/groups/{gid}/messages", headers=auth_h(tok),
                   json={"recipient_ids": [], "text": "hi"})
        assert r.status_code == 403
        r = s.get(f"{API}/groups/{gid}/messages", headers=auth_h(tok))
        assert r.status_code == 403

    def test_list_messages_oldest_first_and_viewer_scope(self, s, group_two):
        gid = group_two["gid"]
        # owner sees his own sent messages
        r = s.get(f"{API}/groups/{gid}/messages", headers=auth_h(group_two["owner"]["tok"]))
        assert r.status_code == 200
        msgs_owner = r.json()
        assert len(msgs_owner) >= 2
        # oldest-first
        ts = [m["created_at"] for m in msgs_owner]
        assert ts == sorted(ts)
        # mate as recipient
        r = s.get(f"{API}/groups/{gid}/messages", headers=auth_h(group_two["mate"]["tok"]))
        assert r.status_code == 200
        assert len(r.json()) >= 2

    def test_inbox_returns_messages_with_group_name_and_read_flag(self, s, group_two):
        r = s.get(f"{API}/messages/inbox", headers=auth_h(group_two["mate"]["tok"]))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 1
        m = data[0]
        assert "group_name" in m and m["group_name"] == "TEST_GrupoMsg"
        assert "read" in m and isinstance(m["read"], bool)

    def test_unread_count_and_mark_read(self, s, group_two):
        # Mate: check unread count > 0
        r = s.get(f"{API}/messages/unread", headers=auth_h(group_two["mate"]["tok"]))
        assert r.status_code == 200
        c1 = r.json()["count"]
        assert c1 >= 1
        # Mark single message read
        inbox = s.get(f"{API}/messages/inbox", headers=auth_h(group_two["mate"]["tok"])).json()
        mid = inbox[0]["id"]
        r = s.post(f"{API}/messages/{mid}/read", headers=auth_h(group_two["mate"]["tok"]))
        assert r.status_code == 200
        r = s.get(f"{API}/messages/unread", headers=auth_h(group_two["mate"]["tok"]))
        assert r.json()["count"] == c1 - 1

    def test_read_all_for_group_drops_unread_to_zero(self, s, group_two):
        gid = group_two["gid"]
        # send one more from owner to mate to make sure unread > 0
        s.post(f"{API}/groups/{gid}/messages", headers=auth_h(group_two["owner"]["tok"]),
               json={"recipient_ids": [], "text": "otra más"})
        r = s.get(f"{API}/messages/unread", headers=auth_h(group_two["mate"]["tok"]))
        assert r.json()["count"] >= 1
        r = s.post(f"{API}/groups/{gid}/messages/read_all",
                   headers=auth_h(group_two["mate"]["tok"]))
        assert r.status_code == 200
        r = s.get(f"{API}/messages/unread", headers=auth_h(group_two["mate"]["tok"]))
        assert r.json()["count"] == 0

    def test_send_with_invalid_recipient_ids_filtered(self, s, group_two):
        """recipient_ids containing non-members should be filtered; if resulting list is empty → 400."""
        gid = group_two["gid"]
        r = s.post(f"{API}/groups/{gid}/messages",
                   headers=auth_h(group_two["owner"]["tok"]),
                   json={"recipient_ids": ["deadbeefdeadbeefdeadbeef"], "text": "garbage"})
        assert r.status_code == 400
