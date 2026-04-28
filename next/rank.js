// Player rank — tiered progression based on accumulated stats. Points are
// awarded for wins (5), podiums (2), and races completed (1). Each tier
// has a threshold; player progresses up as points accumulate.
//
// Tiers are intentionally generous up front and steep at the top.

export const TIERS = [
  { id: "rookie",   name: "Rookie",     threshold: 0,    color: "#9aa8ba" },
  { id: "amateur",  name: "Amateur",    threshold: 25,   color: "#4adf80" },
  { id: "pro",      name: "Pro",        threshold: 80,   color: "#2ee9ff" },
  { id: "elite",    name: "Elite",      threshold: 200,  color: "#ffd166" },
  { id: "master",   name: "Master",     threshold: 500,  color: "#ff8a4c" },
  { id: "legend",   name: "Legend",     threshold: 1000, color: "#ff315c" }
];

export function pointsFromStats(stats) {
  if (!stats) return 0;
  return (stats.wins || 0) * 5 + (stats.podiums || 0) * 2 + (stats.races || 0) * 1;
}

// Returns { tier, nextTier, progress (0..1 toward next), points }.
export function computeRank(stats) {
  const points = pointsFromStats(stats);
  let tier = TIERS[0];
  let nextTier = null;
  for (let i = 0; i < TIERS.length; i++) {
    if (points >= TIERS[i].threshold) {
      tier = TIERS[i];
      nextTier = TIERS[i + 1] || null;
    }
  }
  let progress = 1;
  if (nextTier) {
    const span = nextTier.threshold - tier.threshold;
    progress = (points - tier.threshold) / span;
    progress = Math.max(0, Math.min(1, progress));
  }
  return { tier, nextTier, progress, points };
}

// Detect rank-up by comparing two stats snapshots. Returns the new tier
// if the rank increased, otherwise null.
export function detectRankUp(prevStats, nextStats) {
  const before = computeRank(prevStats).tier.id;
  const after = computeRank(nextStats).tier.id;
  if (before === after) return null;
  // Find tier index of after.
  return TIERS.find((t) => t.id === after) || null;
}
