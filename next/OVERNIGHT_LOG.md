# Overnight Build Log

Everything that landed while you were asleep, in roughly the order it
happened. The live game is at:

**https://simdexapp.github.io/apex-akina/next/**

## Visual / scene

- **Real environment overhaul**: AmbientLight, brighter HemisphereLight,
  warm horizon DirectionalLight, exposure 0.95 → 1.55, dawn-band sky
  shader, denser starfield (1400) + nebula glow planes.
- **Mountain ring** (`scenery.js`) instanced and positioned by track
  bbox + 320m buffer so the player can never drive into them.
- **Per-track scenery flavors**: Lakeside pines, Bayside palms, Highway
  billboards, Neon skyscrapers, Mountain Pass dense pines, City circuit
  tall blocks, Rural pines, Drift Court low buildings — all instanced.
- **Track surface**: lane lines flattened to PlaneGeometry stripes (were
  3D bricks); kerbs slimmed + InstancedMesh; trackside posts InstancedMesh
  (240 → 4 draw calls); flat start-line tiles + sector markers.
- **Splash screen** with branded gradient loader.
- **Track preview SVGs** in the picker (160×80 with cyan glow + start dot).
- **Driver name labels** projected from world to screen above each rival.
- **Spectator camera** (V key) — cinematic orbit on race leader.
- **Photo mode** (P key) — orbit cam, hides HUD.
- **Pre-race intro camera** — 1.6s flyby before lights.

## Mechanics

- **6-speed gearbox** with RPM-driven shifts, throttle dip during shift,
  audio thunk + ▲ callout.
- **Slipstream / draft**: tail within 22 m and on-axis for +10% top
  speed and slow boost top-up.
- **Trail-braking**: brake + steer amplifies steering authority.
- **Counter-steer assist**: drift no longer spins out unrecoverably.
- **Perfect-launch**: throttle within 0.28 s of GO grants surge + boost.
- **Drift rework**: directional lock-in on entry (fixed wrong-way bug),
  steer-with extends slip, counter-flick exits, reward scales with
  controlled duration.
- **AI brake-into-corners**: rivals sample 3 look-aheads + brake harder
  on sharp upcoming curves.
- **AI personalities**: 4 archetypes (aggressive, smooth, consistent,
  wildcard) cycled across the field.
- **Difficulty slider**: Easy / Normal / Hard / Brutal — scales pace
  and rubber-band aggression.

## UI

- **HUD redesigned**: top-left compact strip (Lap/Pos/Time/Best),
  top-right action buttons, top-center floating pills (Combo/Draft),
  bottom-left speedometer cluster (speed/gear/boost/heat), bottom-right
  leaderboard, top-right minimap.
- **Speedometer arc gauge** with gradient fill, gear pill, integrated
  boost+heat meters.
- **Lap delta indicator** vs personal best, real-time, color-coded.
- **Sector splits** (S1/S2/S3) with delta vs best, persisted per track.
- **Overtake notifications** — center-screen flash on position change.
- **Final-lap badge glow**.
- **Boost FX overlay** — radial vignette + speed lines on activation.
- **Slipstream visual** — cyan radial pulse when drafting.
- **Pause menu** (Esc): Resume / Restart / Quit / Settings.
- **Settings overlay**: graphics quality (Ultra/High/Medium/Low),
  volume, FOV, camera shake, counter-steer assist, AI difficulty.
- **First-time tutorial** with control-grid keycaps.
- **Tip-of-the-day** rotating hints in the pre-race overlay.
- **Achievement system + toasts** (12 achievements, persisted).

## Audio

- **Per-track music profiles** (8 tracks × distinct tempo/key).
- **Countdown beeps + GO chord** (square wave + triangle layer).
- **Gear-shift filtered noise thunk**.
- **Wind noise** layer scaling with speed.
- **Turbo whoosh** on boost activation.
- **Brake hiss** on first brake-press at speed.
- **Engine profile** beefed up: square secondary osc, deeper idle,
  taller redline, wider filter sweep.
- **Master volume** slider in settings.

## Input

- **Gamepad support** via standard mapping (LS steer, RT/LT throttle/brake,
  A drift, B/RB boost). Auto-detected, mixes with keyboard.
- **Mobile touch controls**: on-screen pads (steer L/R + throttle/brake/
  boost/drift) auto-shown on coarse-pointer devices.

## Content

- **8 tracks** (was 4): Lakeside, Bayside Boulevard, Coastal Highway,
  Neon Highway, Akagi Pass, Akihabara Circuit, Hakone Ridge,
  Daikoku Drift Court.
- **6 cars** (was 4): GT Coupe, Drift Coupe, Rally Sedan, Wedge Super,
  Kei Sport, Hyper GT.
- **Career mode** (`career.js`): three championships (Rookie Cup, Pro
  Series, Master Championship). F1-style points (25-18-15-…). Auto-
  loads next round's track. Final standings on finish overlay.
- **Replay system** (`replay.js`): 30 Hz buffer, 4-min cap. "Watch
  Replay" on finish drives the player car along recorded poses at 1.5×.

## Performance

- **Graphics quality tiers**: Ultra/High/Medium/Low scale shadow map
  size, bloom on/off + strength, pixelRatio, particleCap.
- **InstancedMesh** everywhere repeated (kerbs, posts, lamps, mountains,
  trees, buildings, lane stripes).
- **Lamp PointLights capped at 6** total (was 30+).
- **Reduced rival mesh count** in perf-critical builds via mountain
  bbox + smarter scenery densities.

## Tech

- **Cache-bust scheme**: every internal module import + the `<link>`
  to styles.css carries a `?v=N` query string, bumped each deploy so
  browsers always fetch fresh modules.
- **GitHub Pages auto-deploy** on every push to main.
- **8+ commits** across the night, each with a verified clean console
  on the live URL after the deploy completed.

## Files added this batch

- `next/scenery.js` — instanced per-track decoration.
- `next/career.js` — championship state + persistence.
- `next/replay.js` — pose ring buffer + playback.
- `next/achievements.js` — milestone tracking + toast events.
- `next/STEAM_ROADMAP.md` — explicit done/todo for Steam launch.

## Known things to revisit

- The tutorial and settings overlays are wide on phones — could
  benefit from a fully redesigned layout for portrait phones.
- AI overtaking the player still feels conservative on Brutal — more
  aggressive blocking lines next pass.
- Engine audio could get stage-by-stage RPM filter sweeps for more
  realism.
- The career mode finish flow auto-loads next round but doesn't show
  an interstitial "Next round in 3..." — would feel more deliberate.

## Live URL recap

**https://simdexapp.github.io/apex-akina/next/**

Repo: **https://github.com/simdexapp/apex-akina**
