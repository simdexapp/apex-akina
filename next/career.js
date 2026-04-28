// Career mode — sequence of races (a "championship") that shares a points
// table across rounds. Persists progress in localStorage so the player can
// quit and resume. Single championship structure for now; extend later.

const KEY = "apex-akina-3d:career";

// F1-style points: 1st→25, 2nd→18, ..., 10th→1. Beyond 10th = 0.
const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

// Championships are arrays of round descriptors. Order matters.
export const CHAMPIONSHIPS = {
  rookie: {
    name: "Rookie Cup",
    description: "Three rounds on flowing tracks. Easy AI.",
    difficulty: "easy",
    rounds: [
      { trackId: "lakeside", laps: 3 },
      { trackId: "bayside", laps: 3 },
      { trackId: "highway", laps: 2 }
    ]
  },
  pro: {
    name: "Pro Series",
    description: "Five rounds across all tracks. Normal AI.",
    difficulty: "normal",
    rounds: [
      { trackId: "lakeside", laps: 3 },
      { trackId: "highway", laps: 3 },
      { trackId: "city", laps: 4 },
      { trackId: "mountainpass", laps: 3 },
      { trackId: "neon", laps: 3 }
    ]
  },
  pro2: {
    name: "Master Championship",
    description: "All tracks, brutal AI, 4 laps each.",
    difficulty: "hard",
    rounds: [
      { trackId: "mountainpass", laps: 4 },
      { trackId: "city", laps: 4 },
      { trackId: "neon", laps: 4 },
      { trackId: "bayside", laps: 4 },
      { trackId: "highway", laps: 4 },
      { trackId: "lakeside", laps: 4 }
    ]
  }
};

function defaultState() {
  return {
    championshipId: null,
    roundIdx: 0,
    points: { player: 0, rivals: {} },     // rivals: name → points
    finalStandings: null
  };
}

let cache = null;
function load() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? JSON.parse(raw) : defaultState();
  } catch (_) { cache = defaultState(); }
  return cache;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (_) {}
}

export function getCareerState() { return load(); }

export function startChampionship(id) {
  const champ = CHAMPIONSHIPS[id];
  if (!champ) return;
  cache = defaultState();
  cache.championshipId = id;
  save();
  return cache;
}

export function currentRound() {
  const s = load();
  if (!s.championshipId) return null;
  const champ = CHAMPIONSHIPS[s.championshipId];
  if (!champ) return null;
  if (s.roundIdx >= champ.rounds.length) return null;
  return { ...champ.rounds[s.roundIdx], championship: champ, idx: s.roundIdx, total: champ.rounds.length };
}

export function pointsFor(place) {
  return POINTS[place - 1] || 0;
}

// Record a finished round: updates points and advances roundIdx.
// `standings` is an array of { name, isPlayer } in finishing order.
export function recordRound(standings) {
  const s = load();
  if (!s.championshipId) return;
  for (let i = 0; i < standings.length; i++) {
    const place = i + 1;
    const pts = pointsFor(place);
    const e = standings[i];
    if (e.isPlayer) s.points.player = (s.points.player || 0) + pts;
    else s.points.rivals[e.name] = (s.points.rivals[e.name] || 0) + pts;
  }
  s.roundIdx++;
  // If championship is over, compute final standings.
  const champ = CHAMPIONSHIPS[s.championshipId];
  if (s.roundIdx >= champ.rounds.length) {
    const all = [{ name: "You", points: s.points.player, isPlayer: true }];
    for (const [name, p] of Object.entries(s.points.rivals)) {
      all.push({ name, points: p, isPlayer: false });
    }
    all.sort((a, b) => b.points - a.points);
    s.finalStandings = all;
  }
  save();
}

export function isComplete() {
  const s = load();
  return !!s.finalStandings;
}

export function reset() {
  cache = defaultState();
  save();
}
