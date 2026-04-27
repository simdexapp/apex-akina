# Apex Akina

Touge arcade racer. Two engines living in one repo — pick your build at the landing page.

> Static site. No build step. Runs from any HTTPS host.

## Builds

| | Engine | Status | Tech |
|---|---|---|---|
| 🎨 | **Canvas Pseudo-3D** | full feature set | 2D canvas + custom segment renderer |
| 🛠 | **3D WebGL** | v0 rebuild | Three.js + post-processing + custom physics |

The canvas build has the polished gameplay loop: 26-car grid, 4 tracks, 8 JDM-style shapes, drift trails, combo system, engine wear, near-miss bonuses, music, full pre-race picker.

The 3D build is the rebuilt foundation — real WebGL, real chase camera, lateral-grip physics, AI rivals on a closed-loop track. Feature parity with the canvas game is the migration roadmap.

## Play

Visit the deployed site (see Deploy section) or:

```bash
# From the project root
npx http-server . -p 5181
# or
python3 -m http.server 5181
```

Then open `http://localhost:5181/`.

## Controls

- **Arrows / WASD** — drive
- **Space** — drift
- **Shift** — boost
- **Enter** — start (canvas build)

## Repo layout

```
.
├── index.html          # landing page (engine picker)
├── canvas.html         # canvas game
├── styles.css, game.js # canvas logic + style
├── next/               # 3D engine
│   ├── index.html
│   ├── styles.css
│   ├── main.js         # scene + render loop
│   ├── track.js        # track mesh + projection
│   ├── car.js          # car physics + 3D body
│   ├── input.js        # keyboard input
│   ├── rivals.js       # AI rivals
│   └── audio.js        # synth engine + tire + music
├── DEPLOY.md
└── README.md
```

## Deploy

See [DEPLOY.md](DEPLOY.md) for Vercel / GitHub Pages / itch.io / Netlify.

**TL;DR — GitHub Pages** (free, public URL):

1. Push this repo to GitHub.
2. Repo → **Settings** → **Pages**.
3. Source: **Deploy from a branch**, branch: `main`, folder: `/ (root)`. Save.
4. URL appears at the top of the Pages panel after ~30 seconds.

A workflow at `.github/workflows/pages.yml` is included so pushes to `main` auto-publish.

## Roadmap

Canvas build (stable, polished):
- Drift trails ✓
- Engine wear ✓
- Combo / streak system ✓
- Slow-mo near-miss ✓
- 4 tracks with palette variants ✓
- 8 JDM car shapes ✓

3D build (in progress):
- v0 ✓ — scene, physics, AI, leaderboard, finish flow, bloom, audio
- v0.1 — track picker, multiple tracks
- v0.2 — car picker, multiple shapes
- v0.3 — boost meter, mini-map, particles, best-lap persistence
- v1.0 — feature parity with canvas
- v1.x — proper GLTF car models, baked lighting, replay system

## License

Personal project. No license — ask before reuse.
