// Spoken navigation via the backend TTS endpoint (OpenAI voice, Emergent-managed).
// One module-level player is reused across the drive screen; audio is played from an https URL (never a data: URI).
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

import { api, BASE } from "@/src/api";

let player: AudioPlayer | null = null;
let configured = false;
let enabled = true;
let lastSpoken = "";

export function setVoiceEnabled(v: boolean) {
  enabled = v;
  if (!v) stopVoice();
}
export function isVoiceEnabled() {
  return enabled;
}

async function configure() {
  if (configured) return;
  try {
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    configured = true;
  } catch {
    /* audio mode unavailable (e.g. web) */
  }
}

function ensurePlayer(): AudioPlayer | null {
  if (!player) {
    try {
      player = createAudioPlayer();
    } catch {
      player = null;
    }
  }
  return player;
}

/** Speak a short instruction. Duplicate consecutive phrases are ignored so a repeated GPS tick doesn't stutter. */
export async function speak(text: string) {
  if (!enabled || !text) return;
  if (text === lastSpoken) return;
  lastSpoken = text;
  try {
    await configure();
    const r = await api<{ key: string }>("/tts", { method: "POST", json: { text } });
    const p = ensurePlayer();
    if (!p) return;
    p.replace({ uri: `${BASE}/tts/${r.key}.mp3` });
    p.play();
  } catch {
    /* keep navigation silent on failure rather than crashing */
  }
}

export function stopVoice() {
  try {
    player?.pause();
  } catch {
    /* noop */
  }
}

/** Reset the de-dupe guard (call when a new route/leg starts). */
export function resetVoice() {
  lastSpoken = "";
}
