# Apex Akina — Expansion Roadmap

The 3D engine v0 baseline shipped. Below is the plan for taking it to a polished, shippable game. Phases are independently scoped; you can reorder, skip, or interleave.

Each phase is a multi-batch effort. Each row inside a phase is a single batch (≈ one focused session of work).

---

## Phase A — Visual & UX foundation
**Goal:** game *feels* like a deliberate product, not a demo. Calmer palette, refined geometry, professional UI.

| Batch | What lands |
|-------|------------|
| A1 | Toned palettes per track (less neon-saturated, more dusk/night realistic). Restrained bloom + tone-mapping pass. *In-flight as of this commit.* |
| A2 | Refined procedural car bodies — sloped hood, swept windshield, beveled silhouettes, subtle paint highlights. |
| A3 | Track scenery — billboards, fence lines, distant signage, atmospheric props (tunnels for Akagi, ocean railing for Bayside, etc.). |
| A4 | Road-surface detail — lane markings as stenciled decals, dashed center lines, pit-entry/exit chevrons, sponsor logos. |
| A5 | Skybox upgrade — pre-baked equirect HDRIs per track with proper atmospheric scattering. |
| A6 | UI overhaul — softer typography, animated card transitions, loading states between race/menu, controls overlay on first run. |

## Phase B — Game modes & persistence
**Goal:** more reasons to keep playing. Real progression.

| Batch | What lands |
|-------|------------|
| B1 | **Time trial** — solo lap chase, ghost car of your best lap, sector splits. |
| B2 | **Championship** — 4-race series, points table, season summary screen. |
| B3 | **Garage / profile** — driver name, owned cars, stats (laps, races, podiums). |
| B4 | localStorage schema migration — single root key with version field, safe upgrade path. |

## Phase C — Audio & atmosphere
**Goal:** every track sounds different. Cars sound like *those* cars.

| Batch | What lands |
|-------|------------|
| C1 | **Per-track music** — distinct chord progressions, drum patterns, lead-synth voicing per track palette. |
| C2 | **Engine variety per shape** — 4 distinct profiles (I4 / V6 / V8 / rotary) with different harmonic content + idle/redline ranges. |
| C3 | **SFX library** — collisions, near-miss whoosh, lap-complete chime, lights-out tone, victory fanfare, gear-shift click. |
| C4 | **Spatial audio** — rivals pan based on lateral, volume falls off with distance, doppler-ish pitch shift on close pass. |

## Phase D — Mobile, photo, replay
**Goal:** broaden the audience and add post-race depth.

| Batch | What lands |
|-------|------------|
| D1 | **Mobile touch controls** — bottom-screen virtual buttons (steer pad, throttle, brake, drift, boost). Responsive frame layout. |
| D2 | **Photo mode** — `P` to pause, free orbital camera, dolly + zoom, FOV slider, screenshot capture, optional film-grain filter. |
| D3 | **Replay system** — record state ring buffer (positions, headings, inputs at 30Hz). Playback from spectator camera. Shareable via URL hash. |

## Phase E — Asset pipeline
**Goal:** real models, real textures. This is the biggest visual lift.

| Batch | What lands |
|-------|------------|
| E1 | **GLTF car models** — author or source 4 cars (one per shape). GLTFLoader integration with procedural fallback. |
| E2 | **Track environment models** — proper guardrails, lamp posts, billboards, tunnel meshes. |
| E3 | **Decal system** — road imperfections (cracks, oil stains), sponsor logos on kerbs and billboards. |
| E4 | **Material library** — PBR textures for asphalt, paint, glass, chrome. Reusable across tracks/cars. |

## Phase F — Multiplayer & social *(long horizon, optional)*
**Goal:** other people in your race.

| Batch | What lands |
|-------|------------|
| F1 | **Ghost-car sharing** — encode best lap as base64 URL hash; friends visit URL and race against your ghost. |
| F2 | **Leaderboard server** — fastest laps per track per car, simple cloud function or static GitHub commit-based. |
| F3 | **Live multiplayer** — peer-to-peer WebRTC or WebSocket relay for 2-4 player races. |

## Phase G — Track variety & editor *(recurring)*
**Goal:** more places to race + a way to extend.

| Batch | What lands |
|-------|------------|
| G1 | **4 more tracks** — total of 8. Distinct sectors, weather variants. |
| G2 | **Track editor** — author tracks via JSON control points, palette config, hot-reload on dev server. Export as track file. |
| G3 | **Weather system** — rain (wet road, reduced grip), fog (reduced visibility), dusk/dawn transitions during race. |

---

## Recommended ordering for shipping a v1.0

1. **Phase A** in full — foundation of polish.
2. **Phase B1 + B3** — time trial + garage are huge for replayability.
3. **Phase C1 + C3** — per-track music + SFX library.
4. **Phase D1 + D2** — mobile + photo mode for sharing-friendly content.
5. **Phase E1** — GLTF cars (the biggest visual upgrade).
6. **Phase G1** — 4 more tracks.
7. **Phase F1** — ghost-car sharing for organic competition.

Everything else is post-v1.0 polish or scope expansion.

---

## Out of scope for now

- **Engine swap to Babylon / PlayCanvas** — Three.js is fine.
- **Full physics engine** (Cannon-es / Rapier) — current arcade physics is the right feel.
- **Server-rendered art** — all assets ship in the static bundle.
- **Account system / monetization** — public free webgame for now.
