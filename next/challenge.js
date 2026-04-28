// Daily challenge — pick one fresh challenge per UTC day. Persists "completed
// today" so the player can claim it once. The pool is 14 challenges; each
// day's pick is deterministic (based on the date string) so multiple devices
// see the same one if signed in to nothing.

const CHALLENGE_KEY = "apex-akina-3d:dailyChallenge";

const POOL = [
  { id: "win-lakeside",    text: "Win a race on Lakeside.",                        check: (ctx) => ctx.won && ctx.trackId === "lakeside" },
  { id: "win-akagi",       text: "Win a race on Akagi Pass.",                      check: (ctx) => ctx.won && ctx.trackId === "mountainpass" },
  { id: "drift-3s",        text: "Hold a drift for 3+ seconds.",                   check: (ctx) => (ctx.driftDuration ?? 0) >= 3 },
  { id: "topspeed-200",    text: "Hit 200 km/h.",                                  check: (ctx) => (ctx.topSpeedKmh ?? 0) >= 200 },
  { id: "podium-hard",     text: "Podium on Hard difficulty.",                     check: (ctx) => ctx.place <= 3 && ctx.difficulty === "hard" },
  { id: "no-boost",        text: "Win without using boost.",                       check: (ctx) => ctx.won && ctx.boostUsed === false },
  { id: "near-misses-5",   text: "Pull off 5 near-misses in one race.",            check: (ctx) => (ctx.nearMisses ?? 0) >= 5 },
  { id: "win-neon",        text: "Win on Neon Highway.",                           check: (ctx) => ctx.won && ctx.trackId === "neon" },
  { id: "win-kei",         text: "Win a race in the Kei Sport.",                   check: (ctx) => ctx.won && ctx.car === "kei" },
  { id: "win-muscle",      text: "Win a race in the Hyper GT.",                    check: (ctx) => ctx.won && ctx.car === "muscle" },
  { id: "lap-29",          text: "Set a sub-29-second lap on any track.",          check: (ctx) => (ctx.lapTime ?? Infinity) < 29 },
  { id: "drift-king",      text: "Earn a 5+ combo from drifts and near-misses.",   check: (ctx) => (ctx.maxCombo ?? 0) >= 5 },
  { id: "career-round",    text: "Finish a career round in the top 3.",            check: (ctx) => ctx.mode === "career" && ctx.place <= 3 },
  { id: "drift-court-win", text: "Win on the Daikoku Drift Court.",                check: (ctx) => ctx.won && ctx.trackId === "drift" }
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

export function getTodaysChallenge() {
  const today = todayKey();
  const s = load();
  const idx = pickIndex(today);
  const pick = POOL[idx];
  return {
    id: pick.id,
    text: pick.text,
    completed: s[today] === pick.id
  };
}

// Call after each race. Marks today's challenge complete if ctx satisfies it.
export function checkDailyChallenge(ctx) {
  const today = todayKey();
  const s = load();
  if (s[today]) return null;       // already claimed today
  const idx = pickIndex(today);
  const pick = POOL[idx];
  try {
    if (pick.check(ctx)) {
      s[today] = pick.id;
      save();
      return pick;
    }
  } catch (_) {}
  return null;
}
