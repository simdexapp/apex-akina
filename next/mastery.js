// Track mastery — Bronze / Silver / Gold / Platinum tiers per track,
// earned by hitting target lap times. Diamond is reserved for top-3
// online leaderboard placement (computed at finish via fetchBoard).
//
// Targets are rough first-pass estimates and should be tuned with playtest
// data. They live here (not in tracks-data.js) so they can be tweaked
// without touching geometry.

export const MASTERY_TARGETS = {
  lakeside:     { bronze: 100, silver: 80,  gold: 70, platinum: 62 },
  bayside:      { bronze: 105, silver: 85,  gold: 73, platinum: 65 },
  highway:      { bronze: 130, silver: 108, gold: 92, platinum: 82 },
  neon:         { bronze: 110, silver: 88,  gold: 75, platinum: 67 },
  mountainpass: { bronze: 140, silver: 115, gold: 98, platinum: 88 },
  city:         { bronze: 110, silver: 90,  gold: 78, platinum: 70 },
  rural:        { bronze: 120, silver: 100, gold: 85, platinum: 76 },
  drift:        { bronze: 90,  silver: 72,  gold: 62, platinum: 55 }
};

// Tier order, lowest to highest. "none" = haven't beaten bronze.
export const TIERS = ["none", "bronze", "silver", "gold", "platinum", "diamond"];

// Visual style per tier — used by the track picker badge.
export const TIER_STYLE = {
  none:     { label: "—",        color: "#6c7a92", glyph: "·"  },
  bronze:   { label: "Bronze",   color: "#cd7f32", glyph: "▲"  },
  silver:   { label: "Silver",   color: "#c0c0c0", glyph: "▲▲" },
  gold:     { label: "Gold",     color: "#ffd166", glyph: "★"  },
  platinum: { label: "Platinum", color: "#80f0ff", glyph: "★★" },
  diamond:  { label: "Diamond",  color: "#ff63a8", glyph: "♦"  }
};

// Given a track id and a lap time in seconds, return the highest tier earned.
// Diamond is *not* awarded by lap time — only by online ranking — so this
// caps at platinum.
export function getMasteryTier(trackId, lapSeconds) {
  if (!Number.isFinite(lapSeconds) || lapSeconds <= 0) return "none";
  const t = MASTERY_TARGETS[trackId];
  if (!t) return "none";
  if (lapSeconds <= t.platinum) return "platinum";
  if (lapSeconds <= t.gold)     return "gold";
  if (lapSeconds <= t.silver)   return "silver";
  if (lapSeconds <= t.bronze)   return "bronze";
  return "none";
}

// Compare two tier names; returns 1 if a>b, -1 if a<b, 0 if equal.
export function compareTiers(a, b) {
  const ai = TIERS.indexOf(a || "none");
  const bi = TIERS.indexOf(b || "none");
  if (ai > bi) return 1;
  if (ai < bi) return -1;
  return 0;
}

// Diamond eligibility — passed in from main.js after fetchBoard returns,
// if the player ranks in the global top 3 they earn diamond.
export function diamondFromRank(rank) {
  return Number.isFinite(rank) && rank >= 1 && rank <= 3;
}
