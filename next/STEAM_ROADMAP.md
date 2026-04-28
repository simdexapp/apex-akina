# Apex Akina — Steam Readiness Roadmap

State as of this commit and what remains before the game is ready to publish on
Steam (or any storefront with a paying audience). Items marked **DONE** shipped
in the most recent rehaul. **TODO** items are the next swings.

## What just shipped (rehaul wave)

### Visual
- **DONE** PCF soft shadows, shadow-casting directional light following the
  player, all cars + barriers + lamp posts cast/receive.
- **DONE** Reshaped car bodies: sloped windshield/roof prism + rounded nose
  wedge + side mirrors. No more stacked-box silhouette.
- **DONE** Wheel chrome accent (color-customisable) + 5-lug detail.
- **DONE** Front grille + intake slits + rear bumper indent.
- **DONE** Window-frame chrome strips around the cabin glass.
- **DONE** Track surface: start-line checker, finish gate banner, sector stripe
  markers at 1/3, 2/3, lap line.
- **DONE** Denser trackside posts (every 4 samples) with full lamp posts every
  24 samples casting real point-light onto the road.
- **DONE** 28 distant ambient lamp markers ringing the playfield for depth.

### Driving mechanics (the rehaul this update centred on)
- **DONE** 6-speed gearbox with RPM-driven up/down shifts, throttle dip during
  shift, audible thunk + on-screen ▲ indicator.
- **DONE** Slipstream / draft: tail an AI within 22 m and on-axis to get up to
  +10% top-speed and slow boost-meter top-up.
- **DONE** Trail-braking: holding brake while turning amplifies steering
  authority for rear rotation into corners.
- **DONE** Counter-steer assist: drift no longer spins out; heading drags
  toward direction of motion.
- **DONE** Perfect-launch: throttle within 0.28s of GO grants surge + boost.
- **DONE** F1-style 7×2 grid start, straight on every track (start tangent
  projection so curved start lines still look right).
- **DONE** Rivals: 14-car field with tiered top speeds (front pack matches
  player base) and rubber-band so leaders don't run away.

### Audio
- **DONE** Engine: dual osc + filter sweep + tremolo LFO, RPM-aware.
- **DONE** Tire screech with skrrrt LFO.
- **DONE** Wind-noise layer scaling with speed.
- **DONE** Countdown beep + GO chord (5th + octave).
- **DONE** Gear-shift filtered-noise thunk.
- **DONE** Per-track music profiles (4 tracks × distinct tempo/key).

### UI
- **DONE** Speedometer arc gauge with gradient fill + gear pill in
  bottom-left corner.
- **DONE** Boost FX overlay: radial vignette + animated speed-lines
  on boost.
- **DONE** Final-lap badge glow.
- **DONE** Draft % HUD, combo HUD, heat HUD, boost HUD.
- **DONE** Pause menu (Esc): Resume / Restart / Quit / Settings.
- **DONE** Settings screen: quality preset (high/medium/low), volume,
  FOV, camera shake, counter-steer assist toggle. Persisted.
- **DONE** First-time tutorial overlay with control-grid keycaps.

### Input
- **DONE** Gamepad support via standard mapping (left stick steer, RT/LT
  throttle/brake, A drift, B/RB boost). Auto-detected.
- **DONE** Keyboard + gamepad mix.

### Customization
- **DONE** Garage with body / stripe / accent (chrome) / spoiler picker per
  car. Live preview swap. Persisted profile.

---

## Still missing for Steam (TODO)

### Visual
- [ ] **GLTF model imports** — replace BufferGeometry composites with
      proper modeled cars (per-shape variation in real geometry, not
      stacked primitives).
- [ ] **Roadside variety** — buildings, trees, signs, billboards keyed to
      each palette. Currently only lamp posts + barriers.
- [ ] **Asphalt texture** — currently flat vertex-coloured. Needs a real
      tilable noise/asphalt material with normal map.
- [ ] **Skybox texture variants** — current procedural sphere is fine for
      pre-alpha; final needs real cubemaps per palette.
- [ ] **Crowd sprites** — pre-rendered planes lining the start zone.
- [ ] **Screen-space motion blur** at high speed.
- [ ] **Lens dirt / chromatic aberration** as part of speed FX.

### Audio
- [ ] **Real music tracks** (licensed or commissioned, 4–8 stems) replacing
      the procedural arp+bass scheduler.
- [ ] **3D-positional rival engine sounds** — currently only player engine.
- [ ] **Crowd ambience** swelling on the start line.
- [ ] **Crash impact / scrape audio** on barrier collisions.
- [ ] **Voice-over** for race start ("THREE, TWO, ONE, GO") and milestones
      ("FINAL LAP", "OVERTAKE").

### Game systems
- [ ] **Career mode**: tournament tree, championships, money/rep currency,
      unlock progression for cars + tracks.
- [ ] **Leaderboards** (online via simple JSON API + Steam leaderboard
      integration).
- [ ] **Replay system** (record full race state into a buffer, scrub +
      camera presets).
- [ ] **Photo mode** during replays.
- [ ] **Damage model** (visual + handling deg over a race).
- [ ] **Pit stops + tire wear** (optional; arcade-leaning so probably skip).
- [ ] **Daily challenge / time-trial of the day**.

### Content
- [ ] **8+ tracks** at launch (currently 4). Touge, oval, urban, mixed.
- [ ] **8+ car shapes** at launch (currently 4) with real per-shape physics
      stats + visible bodywork differences.
- [ ] **20+ liveries** per car as preset starting points before colour
      pickers.
- [ ] **Mode variants**: elimination, drift score attack, knockout, drag.

### Tech
- [ ] **Mobile touch controls** — virtual sticks, lock-orientation handling.
- [ ] **Performance profiling pass** — instanced meshes for trackside
      geometry, frustum-culled rivals, shadow LOD, draw-call audit.
- [ ] **Bundle as desktop app** via Electron / Tauri / Steam Runtime.
- [ ] **Steam SDK integration** — achievements, cloud saves, rich presence,
      controller hints, leaderboards.
- [ ] **Save versioning + migrations** beyond the simple `version: 1` flag.
- [ ] **Crash reporting + telemetry** opt-in.
- [ ] **Localisation** scaffolding (string table + lang picker).

### Onboarding & feel
- [ ] **Title-screen splash** separate from pre-race overlay (currently
      rolled together). Logo + animated reel.
- [ ] **Garage tour** as part of first run.
- [ ] **Difficulty slider** (rubber-band strength + AI top tier) instead
      of hardcoded.
- [ ] **Driving aids toggle** (ABS, TC, racing-line ghost) for newcomers.
- [ ] **Accessibility pass**: colour-blind palette swap, key rebinding UI,
      reduced-motion option for shake/blur.

### Legal / business
- [ ] Trademark / IP clearance on the name.
- [ ] Audio licensing if real tracks are used.
- [ ] Steamworks partner setup, age rating, store page art.
- [ ] EULA + privacy policy.

---

## Priority order (next 3 work batches)

**Batch A — Visual fidelity & content depth (~2 weeks)**
1. GLTF model import pipeline + 4 detailed car models.
2. 4 more tracks (8 total).
3. Asphalt + skybox texturing.
4. Roadside scenery (instanced trees / signs / barriers).

**Batch B — Game systems (~2 weeks)**
1. Career mode skeleton with championship tree.
2. Replay recorder + simple playback camera.
3. Photo mode.
4. Per-AI engine audio (positional).

**Batch C — Steam readiness (~1 week)**
1. Steamworks integration (achievements + cloud saves + leaderboards).
2. Tauri/Electron desktop bundle.
3. Settings rebinding UI.
4. Telemetry opt-in + crash reporting.

After Batch C the game is realistically ready for an Early Access Steam
launch. Polish, additional content, and balancing happen during EA.
