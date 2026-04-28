# Apex Akina online leaderboards

Cloudflare Worker that backs the in-game online board (Time Trial + Hotlap).
The game ships a graceful no-op fallback: if the URL is not configured in
Settings, all submit/fetch calls quietly skip and the game runs offline.

## Deploy

Prereqs: `npm i -g wrangler`, a Cloudflare account.

```sh
cd worker
wrangler login
wrangler kv:namespace create LEADERBOARD            # prints a real id
wrangler kv:namespace create LEADERBOARD --preview  # prints preview id
```

Paste the two ids into `wrangler.toml` (`id` and `preview_id`).

```sh
wrangler deploy
```

Wrangler prints a worker URL like `https://apex-akina-leaderboard.<sub>.workers.dev`.

## Wire it into the game

1. Open the game, hit **Settings**.
2. Paste the worker URL into **Leaderboard URL**.
3. Set your **Online handle** (16 chars max, uppercased server-side).

Time Trial / Hotlap finishes now POST to `/submit` and render the top 10 from
`/board?track=…&car=…&limit=10` on the finish overlay.

## Endpoints

- `POST /submit` — body `{ track, car, time, handle, ts }`. Returns `{ ok, rank, total }`.
- `GET /board?track=lakeside&car=gt&limit=10` — top entries.

## Validation + limits

- Track must be one of the eight known ids.
- Car must be one of the six known ids.
- Time must be a finite positive number under 600s.
- One submission per IP+track+car per 5 seconds.
- Handle is stripped of control chars, capped at 16, uppercased.
- Top 200 entries per (track, car) retained; rest dropped.

## Storage

A single KV namespace (`LEADERBOARD`) with keys:

- `board:<track>:<car>` → JSON array sorted ascending by time.
- `rl:<ip>:<track>:<car>` → rate-limit marker, 5s TTL.
