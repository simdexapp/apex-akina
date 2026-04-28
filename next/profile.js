// Driver profile — name, stats, per-car customization, best-lap registry.
// Single root key for the whole profile, versioned for forward-compat.

import { CAR_SHAPES } from "./car.js";

const PROFILE_KEY = "apex-akina-3d:profile";
const VERSION = 1;

function defaultProfile() {
  const cars = {};
  for (const [id, shape] of Object.entries(CAR_SHAPES)) {
    cars[id] = {
      body: shape.body,
      stripe: shape.stripe,
      accent: 0xc8d4e6,            // wheel hub chrome
      spoiler: shape.spoiler ?? "none",
      livery: "Stock"
    };
  }
  return {
    version: VERSION,
    name: "Driver",
    cars,
    stats: {
      races: 0,
      wins: 0,
      podiums: 0,
      laps: 0
    },
    bestLaps: {}    // key: `${trackId}:${carShape}` → seconds
  };
}

let cache = null;

export function loadProfile() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) {
      cache = defaultProfile();
      return cache;
    }
    const parsed = JSON.parse(raw);
    if (parsed.version !== VERSION) {
      cache = defaultProfile();
      return cache;
    }
    // Backfill any missing car entries (in case CAR_SHAPES was extended).
    const def = defaultProfile();
    for (const id of Object.keys(def.cars)) {
      if (!parsed.cars[id]) parsed.cars[id] = def.cars[id];
      // Backfill new fields onto existing entries.
      if (parsed.cars[id].accent === undefined) parsed.cars[id].accent = def.cars[id].accent;
      if (parsed.cars[id].spoiler === undefined) parsed.cars[id].spoiler = def.cars[id].spoiler;
    }
    cache = parsed;
    return cache;
  } catch (_) {
    cache = defaultProfile();
    return cache;
  }
}

export function saveProfile() {
  if (!cache) return;
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(cache)); } catch (_) {}
}

export function setName(name) {
  const p = loadProfile();
  p.name = (name || "Driver").slice(0, 24);
  saveProfile();
}

export function setCarColors(carShape, body, stripe) {
  const p = loadProfile();
  if (!p.cars[carShape]) p.cars[carShape] = { body, stripe, accent: 0xc8d4e6, spoiler: "none", livery: "Custom" };
  p.cars[carShape].body = body;
  p.cars[carShape].stripe = stripe;
  p.cars[carShape].livery = "Custom";
  saveProfile();
}

export function setCarAccent(carShape, accent) {
  const p = loadProfile();
  if (!p.cars[carShape]) return;
  p.cars[carShape].accent = accent;
  p.cars[carShape].livery = "Custom";
  saveProfile();
}

export function setCarSpoiler(carShape, spoiler) {
  const p = loadProfile();
  if (!p.cars[carShape]) return;
  p.cars[carShape].spoiler = spoiler;
  p.cars[carShape].livery = "Custom";
  saveProfile();
}

export function getCarLivery(carShape) {
  const p = loadProfile();
  return p.cars[carShape] || null;
}

export function bumpStats(delta) {
  const p = loadProfile();
  for (const k of Object.keys(delta)) {
    p.stats[k] = (p.stats[k] || 0) + delta[k];
  }
  saveProfile();
}

export function recordBestLap(trackId, carShape, seconds) {
  const p = loadProfile();
  const key = `${trackId}:${carShape}`;
  const prev = p.bestLaps[key];
  if (!prev || seconds < prev) {
    p.bestLaps[key] = seconds;
    saveProfile();
    return true;
  }
  return false;
}

export function getBestLap(trackId, carShape) {
  const p = loadProfile();
  return p.bestLaps[`${trackId}:${carShape}`] || null;
}

// Hex helpers for the UI.
export function hex(c) {
  return "#" + c.toString(16).padStart(6, "0");
}
export function parseHex(s) {
  if (!s) return null;
  const m = s.replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(m)) return null;
  return parseInt(m, 16);
}
