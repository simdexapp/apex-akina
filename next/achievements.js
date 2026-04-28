// Achievement system — small milestones the player unlocks across sessions.
// Persists which achievements have been earned in localStorage. Emits a
// "toast" event when one unlocks; main.js subscribes to display the popup.

const KEY = "apex-akina-3d:achievements";

export const ACHIEVEMENTS = {
  firstRace:    { name: "First Light",         desc: "Complete your first race.",            test: (s) => s.stats.races >= 1 },
  firstWin:     { name: "Apex Hunter",         desc: "Win your first race.",                 test: (s) => s.stats.wins >= 1 },
  podium3:      { name: "On the Box",          desc: "Take a podium 3 times.",               test: (s) => s.stats.podiums >= 3 },
  win10:        { name: "Reigning Champ",      desc: "Win 10 races.",                        test: (s) => s.stats.wins >= 10 },
  laps100:      { name: "Centurion",           desc: "Complete 100 laps.",                   test: (s) => s.stats.laps >= 100 },
  perfectLap:   { name: "Bullseye",            desc: "Set a sub-30s lap on any track.",       test: (s, ctx) => ctx?.lapTime != null && ctx.lapTime < 30 },
  topSpeed250:  { name: "Terminal Velocity",   desc: "Hit 250 km/h.",                         test: (s, ctx) => (ctx?.topSpeedKmh ?? 0) >= 250 },
  drift500:     { name: "Drift King",          desc: "Hold a drift for 5+ seconds.",          test: (s, ctx) => (ctx?.driftDuration ?? 0) >= 5.0 },
  near10:       { name: "Razor's Edge",        desc: "Pull off 10 near-misses in one race.", test: (s, ctx) => (ctx?.nearMisses ?? 0) >= 10 },
  champRookie:  { name: "Rookie Champion",     desc: "Win the Rookie Cup championship.",      test: (s, ctx) => ctx?.championshipWin === "rookie" },
  champPro:     { name: "Pro Series Champion", desc: "Win the Pro Series championship.",      test: (s, ctx) => ctx?.championshipWin === "pro" },
  champMaster:  { name: "Master Champion",     desc: "Win the Master Championship.",          test: (s, ctx) => ctx?.championshipWin === "pro2" }
};

let earned = null;
function load() {
  if (earned) return earned;
  try {
    earned = JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch (_) { earned = {}; }
  return earned;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(earned)); } catch (_) {}
}

export function isEarned(id) {
  return !!load()[id];
}

export function getAllEarned() {
  return Object.entries(load()).map(([id, t]) => ({ id, time: t, ...ACHIEVEMENTS[id] }));
}

let toastListener = null;
export function onToast(fn) { toastListener = fn; }

// Check all achievements against profile state + optional context. Emits
// toasts for newly-earned ones, returns the list of newly-earned ids.
export function checkAchievements(profile, ctx = {}) {
  load();
  const fresh = [];
  for (const [id, def] of Object.entries(ACHIEVEMENTS)) {
    if (earned[id]) continue;
    try {
      if (def.test(profile, ctx)) {
        earned[id] = Date.now();
        fresh.push({ id, ...def });
      }
    } catch (_) {}
  }
  if (fresh.length) save();
  if (fresh.length && toastListener) {
    for (const f of fresh) toastListener(f);
  }
  return fresh;
}
