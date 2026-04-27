# Apex Akina — Deploy guide

The whole project is **static** (HTML + CSS + ES modules + a Three.js CDN import). Anywhere that serves static files works.

```
camera/
├── index.html       ← Engine picker (root landing page)
├── canvas.html      ← Stable canvas pseudo-3D game
├── styles.css       ← Canvas game styles
├── game.js          ← Canvas game logic
├── next/            ← New 3D engine (v0)
│   ├── index.html
│   ├── styles.css
│   ├── main.js
│   ├── track.js
│   ├── car.js
│   └── input.js
└── DEPLOY.md
```

## Local preview

Serve the folder with any static server. From the project root:

```bash
npx http-server . -p 5181
# or
python3 -m http.server 5181
```

Open `http://localhost:5181/`.

## Public deploy

### Option A — Vercel (1 minute)

1. Install: `npm i -g vercel`
2. From the project root: `vercel --prod`
3. Vercel will detect the static site and give you a public URL.

### Option B — GitHub Pages (free)

1. Push to a GitHub repo.
2. Repo → Settings → Pages.
3. Source: **Deploy from a branch**, branch: `main`, folder: `/ (root)`.
4. Save. Wait ~30s. URL appears at the top of the Pages panel.

### Option C — itch.io (game-friendly)

1. Zip the project root: `zip -r apex-akina.zip . -x ".*" "node_modules/*"`
2. itch.io dashboard → Create new project → "HTML" kind.
3. Upload the zip, mark it as "This file will be played in the browser", set the embed dimensions to 1280x720.
4. Publish.

### Option D — Netlify drag & drop

1. Open https://app.netlify.com/drop
2. Drag the project root folder in. Done.

## Notes on the Three.js engine

- Imports use a `<script type="importmap">` pointing at unpkg's CDN. No build step needed.
- If you need offline / firewalled deploy, swap the importmap to a local copy of `three.module.js` (download from https://unpkg.com/three@0.160.0/build/three.module.js).
- The 3D engine is **v0** — real WebGL, real physics, but feature parity with the canvas game (multiple tracks, 26-car AI, picker UI, audio system) is still coming.

## Adding new features later

- Canvas game physics + AI lives in `game.js`. Each future feature there is a one-file change.
- 3D engine code is split:
  - `main.js` — scene + render loop + HUD
  - `track.js` — track geometry + projection helpers
  - `car.js` — physics module
  - `input.js` — keyboard
- Adding rivals, audio, more tracks, etc. for the 3D engine is the next phase. Keep both engines until the 3D side reaches feature parity.
