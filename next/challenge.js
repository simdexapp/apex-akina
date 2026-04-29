// Daily challenge — pick one fresh challenge per UTC day. Persists "completed
// today" so the player can claim it once. The pool is 14 challenges; each
// day's pick is deterministic (based on the date string) so multiple devices
// see the same one if signed in to nothing.

const CHALLENGE_KEY = "apex-akina-3d:dailyChallenge";
const PLAYLIST_KEY = "apex-akina-3d:dailyPlaylist";

// Featured race configs the daily playlist can pick from. Each becomes one
// of the day's 3 featured slots. Picking keys off the date so the same 3
// surface to everyone on the same day.
const PLAYLIST_POOL = [
  { id: "lakeside-gt",     trackId: "lakeside",     car: "gt",     mode: "race",      laps: 3, label: "Lakeside · GT Coupe" },
  { id: "bayside-drift",   trackId: "bayside",      car: "drift",  mode: "timeTrial", laps: 1, label: "Bayside · Drift TT" },
  { id: "highway-muscle",  trackId: "highway",      car: "muscle", mode: "race",      laps: 3, label: "Highway · Muscle GT" },
  { id: "neon-super",      trackId: "neon",         car: "super",  mode: "race",      laps: 3, label: "Neon · Wedge Super" },
  { id: "akagi-rally",     trackId: "mountainpass", car: "rally",  mode: "race",      laps: 3, label: "Akagi · Rally Sedan" },
  { id: "akagi-tt",        trackId: "mountainpass", car: "drift",  mode: "timeTrial", laps: 1, label: "Akagi · Drift TT" },
  { id: "city-kei",        trackId: "city",         car: "kei",    mode: "hotlap",    laps: 1, label: "City · Kei Hot Lap" },
  { id: "rural-gt",        trackId: "rural",        car: "gt",     mode: "race",      laps: 3, label: "Hakone · GT Coupe" },
  { id: "drift-court",     trackId: "drift",        car: "drift",  mode: "race",      laps: 3, label: "Daikoku · Drift Coupe" },
  { id: "lakeside-tt",     trackId: "lakeside",     car: "kei",    mode: "timeTrial", laps: 1, label: "Lakeside · Kei TT" },
  { id: "neon-hotlap",     trackId: "neon",         car: "super",  mode: "hotlap",    laps: 1, label: "Neon · Super Hot Lap" }
];

// Hash a date string into 3 distinct pool indices.
function pickPlaylistIndices(dateStr) {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) {
    h = ((h << 5) - h) + dateStr.charCodeAt(i);
    h |= 0;
  }
  const used = new Set();
  const out = [];
  let probe = Math.abs(h);
  while (out.length < 3 && out.length < PLAYLIST_POOL.length) {
    const idx = probe % PLAYLIST_POOL.length;
    if (!used.has(idx)) { used.add(idx); out.push(idx); }
    probe = Math.floor(probe / 7) + 1;
  }
  return out;
}

let playlistState = null;
function loadPlaylistState() {
  if (playlistState) return playlistState;
  try { playlistState = JSON.parse(localStorage.getItem(PLAYLIST_KEY) || "{}"); }
  catch (_) { playlistState = {}; }
  return playlistState;
}
function savePlaylistState() {
  try { localStorage.setItem(PLAYLIST_KEY, JSON.stringify(playlistState)); } catch (_) {}
}

export function getDailyPlaylist() {
  const today = todayKey();
  const indices = pickPlaylistIndices(today);
  const state = loadPlaylistState();
  const completed = state[today] || [];
  return indices.map((idx) => {
    const slot = PLAYLIST_POOL[idx];
    return { ...slot, completed: completed.includes(slot.id) };
  });
}

// Mark a playlist slot complete if the player just won this exact config.
// Returns the slot if it was newly completed.
export function checkPlaylistEntry(ctx) {
  if (!ctx.won) return null;
  const today = todayKey();
  const slots = getDailyPlaylist();
  for (const slot of slots) {
    if (slot.completed) continue;
    if (ctx.trackId === slot.trackId && ctx.car === slot.car && ctx.mode === slot.mode) {
      const state = loadPlaylistState();
      if (!state[today]) state[today] = [];
      state[today].push(slot.id);
      savePlaylistState();
      return slot;
    }
  }
  return null;
}

// `tiers` is an optional [bronzeThreshold, silverThreshold, goldThreshold].
// For binary win-style challenges there's no tier — completion is just bronze.
// `tier(ctx)` returns 0 (none), 1 (bronze), 2 (silver), 3 (gold).
function tieredNumeric(getter, thresholds) {
  return (ctx) => {
    const v = getter(ctx);
    if (!Number.isFinite(v)) return 0;
    if (v >= thresholds[2]) return 3;
    if (v >= thresholds[1]) return 2;
    if (v >= thresholds[0]) return 1;
    return 0;
  };
}
function tieredNumericLT(getter, thresholds) {
  // For "lower is better" (e.g., lap times). thresholds[2] = hardest (lowest).
  return (ctx) => {
    const v = getter(ctx);
    if (!Number.isFinite(v)) return 0;
    if (v <= thresholds[2]) return 3;
    if (v <= thresholds[1]) return 2;
    if (v <= thresholds[0]) return 1;
    return 0;
  };
}
const POOL = [
  { id: "win-lakeside",    text: "Win a race on Lakeside.",                  tier: (ctx) => (ctx.won && ctx.trackId === "lakeside") ? 1 : 0 },
  { id: "win-akagi",       text: "Win a race on Akagi Pass.",                tier: (ctx) => (ctx.won && ctx.trackId === "mountainpass") ? 1 : 0 },
  { id: "drift-3s",        text: "Drift hold: bronze 3s · silver 5s · gold 8s.",
                                                                             tier: tieredNumeric((c) => c.driftDuration ?? 0, [3, 5, 8]),
                                                                             tiers: [3, 5, 8] },
  { id: "topspeed-200",    text: "Top speed: bronze 200 · silver 230 · gold 260 km/h.",
                                                                             tier: tieredNumeric((c) => c.topSpeedKmh ?? 0, [200, 230, 260]),
                                                                             tiers: [200, 230, 260] },
  { id: "podium-hard",     text: "Podium on Hard difficulty.",               tier: (ctx) => (ctx.place <= 3 && ctx.difficulty === "hard") ? 1 : 0 },
  { id: "no-boost",        text: "Win without using boost.",                 tier: (ctx) => (ctx.won && ctx.boostUsed === false) ? 1 : 0 },
  { id: "near-misses",     text: "Near misses in one race: bronze 3 · silver 5 · gold 8.",
                                                                             tier: tieredNumeric((c) => c.nearMisses ?? 0, [3, 5, 8]),
                                                                             tiers: [3, 5, 8] },
  { id: "win-neon",        text: "Win on Neon Highway.",                     tier: (ctx) => (ctx.won && ctx.trackId === "neon") ? 1 : 0 },
  { id: "win-kei",         text: "Win a race in the Kei Sport.",             tier: (ctx) => (ctx.won && ctx.car === "kei") ? 1 : 0 },
  { id: "win-muscle",      text: "Win a race in the Hyper GT.",              tier: (ctx) => (ctx.won && ctx.car === "muscle") ? 1 : 0 },
  { id: "lap-time",        text: "Lap time: bronze <32s · silver <30s · gold <28s.",
                                                                             tier: tieredNumericLT((c) => c.lapTime ?? Infinity, [32, 30, 28]),
                                                                             tiers: [32, 30, 28] },
  { id: "drift-king",      text: "Combo chain: bronze 3 · silver 5 · gold 8.",
                                                                             tier: tieredNumeric((c) => c.maxCombo ?? 0, [3, 5, 8]),
                                                                             tiers: [3, 5, 8] },
  { id: "career-round",    text: "Finish a career round in the top 3.",      tier: (ctx) => (ctx.mode === "career" && ctx.place <= 3) ? 1 : 0 },
  { id: "drift-court-win", text: "Win on the Daikoku Drift Court.",          tier: (ctx) => (ctx.won && ctx.trackId === "drift") ? 1 : 0 }
];

function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${(d.getUTCMonth() + 1).toString().padStart(2, "0")}-${d.getUTCDate().toString().padStart(2, "0")}`;
}

// Hash a date string into a pool index (deterministic).
function pickIndex(dateStr) {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) {
    h = ((h << 5) - h) + dateStr.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % POOL.length;
}

let state = null;
function load() {
  if (state) return state;
  try {
    const raw = JSON.parse(localStorage.getItem(CHALLENGE_KEY) || "{}");
    state = raw;
  } catch (_) { state = {}; }
  return state;
}
function save() {
  try { localStorage.setItem(CHALLENGE_KEY, JSON.stringify(state)); } catch (_) {}
}

export const MEDAL_NAMES = ["—", "Bronze", "Silver", "Gold"];

export function getTodaysChallenge() {
  const today = todayKey();
  const s = load();
  const idx = pickIndex(today);
  const pick = POOL[idx];
  // Tier earned today (0..3). Backward-compat: legacy true → 1, false/missing → 0.
  let earnedTier = 0;
  const stored = s[today];
  if (stored && typeof stored === "object") {
    earnedTier = Math.min(3, Math.max(0, stored.tier || 0));
  } else if (stored === pick.id) {
    earnedTier = 1;
  }
  return {
    id: pick.id,
    text: pick.text,
    tiers: pick.tiers,                  // optional [b, s, g]
    earnedTier,
    medal: MEDAL_NAMES[earnedTier]
  };
}

// Call after each race. Updates today's earned tier if higher than before.
// Returns the challenge object iff the tier improved.
export function checkDailyChallenge(ctx) {
  const today = todayKey();
  const s = load();
  const idx = pickIndex(today);
  const pick = POOL[idx];
  let prev = 0;
  const stored = s[today];
  if (stored && typeof stored === "object") prev = stored.tier || 0;
  else if (stored === pick.id) prev = 1;
  if (prev >= 3) return null;          // already gold
  let earned = 0;
  try { earned = pick.tier ? pick.tier(ctx) : 0; } catch (_) { earned = 0; }
  if (earned > prev) {
    s[today] = { id: pick.id, tier: earned };
    save();
    return { id: pick.id, text: pick.text, tier: earned, medal: MEDAL_NAMES[earned] };
  }
  return null;
}
