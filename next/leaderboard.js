// Online leaderboard client. Talks to the Cloudflare Worker if its URL is
// configured (in localStorage as `apex-akina-3d:lbUrl`); otherwise all calls
// gracefully no-op so offline play is unaffected.

const URL_KEY = "apex-akina-3d:lbUrl";
const HANDLE_KEY = "apex-akina-3d:handle";

export function getLeaderboardUrl() {
  try { return localStorage.getItem(URL_KEY) || ""; } catch (_) { return ""; }
}
export function setLeaderboardUrl(url) {
  try {
    if (url) localStorage.setItem(URL_KEY, url);
    else localStorage.removeItem(URL_KEY);
  } catch (_) {}
}

export function getHandle() {
  try { return localStorage.getItem(HANDLE_KEY) || ""; } catch (_) { return ""; }
}
export function setHandle(name) {
  try {
    if (name) localStorage.setItem(HANDLE_KEY, name.slice(0, 16).toUpperCase());
    else localStorage.removeItem(HANDLE_KEY);
  } catch (_) {}
}

export async function submitLap(track, car, time) {
  const url = getLeaderboardUrl();
  if (!url) return { skipped: true };
  const handle = getHandle() || "ANON";
  try {
    const r = await fetch(`${url.replace(/\/+$/, "")}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track, car, time, handle, ts: Date.now() })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { error: j.error || "submit failed" };
    return { rank: j.rank, total: j.total };
  } catch (err) {
    return { error: err.message || String(err) };
  }
}

export async function fetchBoard(track, car, limit = 10) {
  const url = getLeaderboardUrl();
  if (!url) return null;
  try {
    const r = await fetch(`${url.replace(/\/+$/, "")}/board?track=${encodeURIComponent(track)}&car=${encodeURIComponent(car)}&limit=${limit}`);
    if (!r.ok) return null;
    const j = await r.json();
    return j.entries || [];
  } catch (_) {
    return null;
  }
}
