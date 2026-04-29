// Procedural textures rendered to Canvas at module-load time. Used as
// MeshStandardMaterial maps for the road + ground. Avoids any external
// image asset dependencies (the game ships fully offline) while still
// delivering real surface detail that vertex colors can't.

import * as THREE from "three";

// Render a 512x512 asphalt texture: dark base + low-contrast noise grain
// + faint lane-wear streaks running vertically (along the U axis, which
// will be aligned with the road tangent when applied).
export function buildAsphaltTexture() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 512;
  const x = c.getContext("2d");

  // Base gradient — medium gray asphalt (~#55-65). Was #22-2c which
  // looked nearly black and blended completely with dark off-road ground.
  // Real asphalt under streetlights is much lighter than midnight terrain.
  const grad = x.createLinearGradient(0, 0, c.width, 0);
  grad.addColorStop(0,    "#4a4e58");
  grad.addColorStop(0.5,  "#5a5e6a");
  grad.addColorStop(1,    "#4a4e58");
  x.fillStyle = grad;
  x.fillRect(0, 0, c.width, c.height);

  // Asphalt grain — many tiny gray dots.
  const img = x.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const noise = (Math.random() - 0.5) * 28;
    d[i]     = Math.max(0, Math.min(255, d[i]     + noise));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + noise));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + noise));
  }
  x.putImageData(img, 0, 0);

  // Tire wear streaks — slightly DARKER bands at wheel paths (real wear
  // shows as polished darker tracks on lighter asphalt).
  x.globalAlpha = 0.20;
  x.strokeStyle = "#2a2d35";
  x.lineWidth = 22;
  for (const cx of [c.width * 0.34, c.width * 0.66]) {
    x.beginPath();
    x.moveTo(cx, 0);
    x.lineTo(cx, c.height);
    x.stroke();
  }
  x.globalAlpha = 1.0;

  // Surface cracks — random short dark lines for texture interest.
  x.strokeStyle = "rgba(8,10,14,0.55)";
  x.lineWidth = 1;
  for (let i = 0; i < 80; i++) {
    const x0 = Math.random() * c.width;
    const y0 = Math.random() * c.height;
    const len = 6 + Math.random() * 24;
    const ang = Math.random() * Math.PI * 2;
    x.beginPath();
    x.moveTo(x0, y0);
    x.lineTo(x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len);
    x.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Procedural normal map for asphalt — derive from a noise field so the
// road has physical surface detail under directional lighting.
export function buildAsphaltNormal() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  const x = c.getContext("2d");
  // Start with a flat blue (normal pointing straight up: 128, 128, 255).
  x.fillStyle = "rgb(128,128,255)";
  x.fillRect(0, 0, c.width, c.height);
  // Add small bumps via random radial gradients.
  for (let i = 0; i < 220; i++) {
    const cx = Math.random() * c.width;
    const cy = Math.random() * c.height;
    const r = 2 + Math.random() * 4;
    const sign = Math.random() > 0.5 ? 1 : -1;
    const dx = Math.random() * 0.5;
    const dy = Math.random() * 0.5;
    const grad = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    const r2 = Math.round(128 + sign * 26 * dx);
    const g2 = Math.round(128 + sign * 26 * dy);
    grad.addColorStop(0, `rgba(${r2},${g2},255,0.65)`);
    grad.addColorStop(1, "rgba(128,128,255,0)");
    x.fillStyle = grad;
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

// Render a ground (off-track) texture — varied dirt/grass with patches.
// `palette.ground` is the base hex color. We sample around it for variety.
export function buildGroundTexture(baseColorHex = 0x182d3a) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 512;
  const x = c.getContext("2d");
  const r = (baseColorHex >> 16) & 0xff;
  const g = (baseColorHex >>  8) & 0xff;
  const b = (baseColorHex >>  0) & 0xff;
  x.fillStyle = `rgb(${r},${g},${b})`;
  x.fillRect(0, 0, c.width, c.height);
  // Splotches — softer/darker patches.
  for (let i = 0; i < 60; i++) {
    const cx = Math.random() * c.width;
    const cy = Math.random() * c.height;
    const radius = 16 + Math.random() * 70;
    const tone = Math.random() > 0.5 ? 1 : -1;
    const dr = tone * 18;
    const grad = x.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, `rgba(${Math.max(0, Math.min(255, r + dr))},${Math.max(0, Math.min(255, g + dr))},${Math.max(0, Math.min(255, b + dr))},0.40)`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = grad;
    x.beginPath();
    x.arc(cx, cy, radius, 0, Math.PI * 2);
    x.fill();
  }
  // Fine noise for variation.
  const img = x.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 18;
    d[i]     = Math.max(0, Math.min(255, d[i]     + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  x.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
