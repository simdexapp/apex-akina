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
      accent: 0xc8d4e6,
      spoiler: shape.spoiler ?? "none",
      livery: "Stock",
      // Per-car stats (km driven, wins with this car, races with this car).
      kmDriven: 0,
      wins: 0,
      races: 0
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
      laps: 0,
      streak: 0,
      bestStreak: 0,
      sessions: 0,        // unique browser sessions launched
      longestRaceMs: 0,   // longest single race time (any mode)
      skillRating: 1000,  // Elo-style; updated by applySkillDelta
      peakSkillRating: 1000
    },
    bestLaps: {}
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
    // Backfill missing car entries + new fields.
    const def = defaultProfile();
    for (const id of Object.keys(def.cars)) {
      if (!parsed.cars[id]) parsed.cars[id] = def.cars[id];
      const c = parsed.cars[id];
      if (c.accent === undefined) c.accent = def.cars[id].accent;
      if (c.spoiler === undefined) c.spoiler = def.cars[id].spoiler;
      if (c.kmDriven === undefined) c.kmDriven = 0;
      if (c.wins === undefined) c.wins = 0;
      if (c.races === undefined) c.races = 0;
    }
    if (parsed.stats.streak === undefined) parsed.stats.streak = 0;
    if (parsed.stats.bestStreak === undefined) parsed.stats.bestStreak = 0;
    if (parsed.stats.sessions === undefined) parsed.stats.sessions = 0;
    if (parsed.stats.longestRaceMs === undefined) parsed.stats.longestRaceMs = 0;
    if (parsed.stats.skillRating === undefined) parsed.stats.skillRating = 1000;
    if (parsed.stats.peakSkillRating === undefined) parsed.stats.peakSkillRating = parsed.stats.skillRating || 1000;
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

export function bumpCarStats(carShape, delta) {
  const p = loadProfile();
  if (!p.cars[carShape]) return;
  for (const k of Object.keys(delta)) {
    p.cars[carShape][k] = (p.cars[carShape][k] || 0) + delta[k];
  }
  saveProfile();
}

// Apply an Elo-style skill rating delta. Place is 1-based; total is field
// size including the player. Returns { before, after, delta }.
//
// The expected score for a "median" finish is 0.5; player's actual score is
// 1.0 for 1st down to 0.0 for last, scaled linearly. K factor is 24.
export function applySkillDelta(place, total) {
  const p = loadProfile();
  if (!p.stats.skillRating) p.stats.skillRating = 1000;
  if (!p.stats.peakSkillRating) p.stats.peakSkillRating = p.stats.skillRating;
  const before = p.stats.skillRating;
  if (!Number.isFinite(place) || !Number.isFinite(total) || total <= 1) {
    return { before, after: before, delta: 0 };
  }
  const score = (total - place) / (total - 1);  // 1 for 1st, 0 for last
  const expected = 0.5;                          // average expectation
  const K = 24;
  const delta = Math.round(K * (score - expected) * 2);  // amplify for fewer rivals
  const after = Math.max(100, Math.min(5000, before + delta));
  p.stats.skillRating = after;
  if (after > p.stats.peakSkillRating) p.stats.peakSkillRating = after;
  saveProfile();
  return { before, after, delta };
}

// Record a race result for streak tracking. `won` is true if 1st place.
// Returns the new streak length (0 if reset).
export function recordRaceResult(won) {
  const p = loadProfile();
  if (won) {
    p.stats.streak = (p.stats.streak || 0) + 1;
    if (p.stats.streak > (p.stats.bestStreak || 0)) p.stats.bestStreak = p.stats.streak;
  } else {
    p.stats.streak = 0;
  }
  saveProfile();
  return p.stats.streak;
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
