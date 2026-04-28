// Apex Akina online leaderboards — Cloudflare Worker.
//
// Endpoints:
//   POST /submit    body: { track, car, time, handle, ts }   → store + return rank
//   GET  /board?track=lakeside&car=gt&limit=10               → top N entries
//   GET  /board/all?limit=20                                  → top entries across all
//
// Storage: a single KV namespace called LEADERBOARD. Keys:
//   board:<track>:<car>   → JSON array of { handle, time, ts } sorted ascending by time, capped at 200.
//
// CORS: open. Validation rejects garbage submissions; rate limits per
// (cf-connecting-ip + track + car) at 1 submission per 5 seconds.
//
// Setup:
//   wrangler kv:namespace create LEADERBOARD
//   wrangler deploy
// Bind LEADERBOARD in wrangler.toml.

const TRACKS = new Set([
  "lakeside", "bayside", "highway", "neon", "mountainpass", "city", "rural", "drift"
]);
const CARS = new Set([
  "gt", "drift", "rally", "super", "kei", "muscle"
]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};

function cleanHandle(h) {
  if (!h) return "ANON";
  // Strip control chars, cap at 16 chars, uppercase.
  return String(h).replace(/[\x00-\x1f]/g, "").slice(0, 16).trim().toUpperCase() || "ANON";
}

function validateSubmission(body) {
  if (!body || typeof body !== "object") return "bad body";
  if (!TRACKS.has(body.track)) return "unknown track";
  if (!CARS.has(body.car)) return "unknown car";
  const t = Number(body.time);
  if (!Number.isFinite(t) || t <= 0 || t > 600) return "bad time";
  return null;
}

async function getBoard(env, track, car) {
  const key = `board:${track}:${car}`;
  try {
    const raw = await env.LEADERBOARD.get(key);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (_) { return []; }
}

async function saveBoard(env, track, car, board) {
  const key = `board:${track}:${car}`;
  await env.LEADERBOARD.put(key, JSON.stringify(board));
}

const RATE_LIMIT_S = 5;

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");

    if (request.method === "POST" && path === "/submit") {
      let body;
      try { body = await request.json(); } catch (_) {
        return new Response(JSON.stringify({ error: "bad json" }), { status: 400, headers: { "Content-Type": "application/json", ...CORS } });
      }
      const err = validateSubmission(body);
      if (err) {
        return new Response(JSON.stringify({ error: err }), { status: 400, headers: { "Content-Type": "application/json", ...CORS } });
      }
      // Rate-limit per IP+track+car.
      const ip = request.headers.get("cf-connecting-ip") || "anon";
      const rlKey = `rl:${ip}:${body.track}:${body.car}`;
      const last = await env.LEADERBOARD.get(rlKey);
      if (last) {
        return new Response(JSON.stringify({ error: "too fast" }), { status: 429, headers: { "Content-Type": "application/json", ...CORS } });
      }
      await env.LEADERBOARD.put(rlKey, "1", { expirationTtl: RATE_LIMIT_S });

      const handle = cleanHandle(body.handle);
      const entry = { handle, time: Number(body.time), ts: Date.now() };
      const board = await getBoard(env, body.track, body.car);
      // Replace previous entry from same handle if new time is better.
      const existing = board.findIndex((e) => e.handle === handle);
      if (existing >= 0) {
        if (entry.time < board[existing].time) board[existing] = entry;
      } else {
        board.push(entry);
      }
      board.sort((a, b) => a.time - b.time);
      const trimmed = board.slice(0, 200);
      await saveBoard(env, body.track, body.car, trimmed);
      const rank = trimmed.findIndex((e) => e.handle === handle && e.time === entry.time) + 1;

      return new Response(JSON.stringify({ ok: true, rank, total: trimmed.length }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS }
      });
    }

    if (request.method === "GET" && path === "/board") {
      const track = url.searchParams.get("track");
      const car = url.searchParams.get("car");
      const limit = Math.max(1, Math.min(50, parseInt(url.searchParams.get("limit") || "10", 10)));
      if (!TRACKS.has(track) || !CARS.has(car)) {
        return new Response(JSON.stringify({ error: "bad params" }), { status: 400, headers: { "Content-Type": "application/json", ...CORS } });
      }
      const board = await getBoard(env, track, car);
      return new Response(JSON.stringify({ track, car, entries: board.slice(0, limit) }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS }
      });
    }

    if (request.method === "GET" && (path === "" || path === "/")) {
      return new Response("Apex Akina leaderboards · /submit POST · /board?track=&car=", {
        status: 200,
        headers: { "Content-Type": "text/plain", ...CORS }
      });
    }

    return new Response("Not found", { status: 404, headers: CORS });
  }
};
