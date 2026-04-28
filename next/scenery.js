// Per-track scenery — distant mountains, trees, buildings, billboards.
// All built procedurally from primitives; instanced where possible to keep
// draw calls down. Returns a single Group that can be added/removed cleanly.

import * as THREE from "three";

// Build a ring of distant mountain silhouettes. The ring centers on (cx, cz)
// at radius `r`, with `count` peaks. Each peak is a thin pyramid of varied
// width/height, tinted by `color` with a touch of emissive rim glow.
export function buildMountains({ count = 60, radius = 520, baseY = -8, color = 0x261a3a, rimColor = 0x6a3a8a } = {}) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color, metalness: 0.0, roughness: 1.0, emissive: rimColor, emissiveIntensity: 0.18, flatShading: true
  });
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + Math.random() * 0.04;
    const r = radius + (Math.random() - 0.5) * 80;
    const h = 30 + Math.random() * 70;
    const w = 50 + Math.random() * 100;
    const peak = new THREE.Mesh(new THREE.ConeGeometry(w, h, 4 + Math.floor(Math.random() * 3), 1, false), mat);
    peak.position.set(Math.cos(ang) * r, baseY + h * 0.5, Math.sin(ang) * r);
    peak.rotation.y = Math.random() * Math.PI;
    group.add(peak);
  }
  return group;
}

// Pine-tree silhouette — stack of cones for a touge look. Returns a Group
// that can be reused (clone each placement).
function buildPineTree(scale = 1) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2a1810, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x1a4030, roughness: 0.85, emissive: 0x0c2018, emissiveIntensity: 0.2 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.22 * scale, 1.2 * scale, 8), trunkMat);
  trunk.position.y = 0.6 * scale;
  group.add(trunk);
  for (let i = 0; i < 3; i++) {
    const r = (1.2 - i * 0.28) * scale;
    const h = (1.6 - i * 0.32) * scale;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), leafMat);
    cone.position.y = (1.4 + i * 0.7) * scale;
    group.add(cone);
  }
  return group;
}

// Palm-tree silhouette — bent trunk + a fan of cone fronds.
function buildPalmTree(scale = 1) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6a4a26, roughness: 0.85 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2a8048, roughness: 0.7, emissive: 0x0c2018, emissiveIntensity: 0.18 });
  // Curved trunk approximated by 3 cylinder segments.
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * scale, 0.20 * scale, 1.4 * scale, 8), trunkMat);
    seg.position.set(i * 0.12 * scale, (i + 0.5) * 1.4 * scale, 0);
    seg.rotation.z = -i * 0.08;
    group.add(seg);
  }
  // Fronds.
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.30 * scale, 1.6 * scale, 4), leafMat);
    frond.position.set(0.36 * scale + Math.cos(ang) * 0.6 * scale, 4.4 * scale, Math.sin(ang) * 0.6 * scale);
    frond.rotation.x = Math.PI / 2 - 0.3;
    frond.rotation.y = ang;
    group.add(frond);
  }
  return group;
}

// Skyscraper — dark box with random emissive window grid (cheap noise-based UV).
function buildSkyscraper(w, h, d, hue = 0x2ee9ff) {
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x080812, roughness: 0.7, metalness: 0.4 });
  const winMat = new THREE.MeshBasicMaterial({ color: hue });
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
  body.position.y = h * 0.5;
  group.add(body);
  // Window grid: small emissive boxes embedded in each side.
  const winSize = 0.5;
  const winGap = 1.4;
  for (const side of [-1, 1]) {
    const cols = Math.floor(w / winGap);
    const rows = Math.floor(h / winGap);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() > 0.55) continue;
        const win = new THREE.Mesh(new THREE.BoxGeometry(winSize, winSize, 0.05), winMat);
        win.position.set(-w * 0.45 + c * winGap + 0.7, 0.6 + r * winGap, side * (d * 0.5 + 0.03));
        group.add(win);
      }
    }
  }
  return group;
}

// Billboard — pole + lit panel with emissive face.
function buildBillboard(color = 0xff315c) {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x1a2030, roughness: 0.7 });
  for (const side of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6, 0.3), poleMat);
    pole.position.set(side * 1.6, 3, 0);
    group.add(pole);
  }
  const panelMat = new THREE.MeshBasicMaterial({ color });
  const panel = new THREE.Mesh(new THREE.BoxGeometry(5, 2.2, 0.2), panelMat);
  panel.position.set(0, 5.2, 0);
  group.add(panel);
  // Subtle frame.
  const frame = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.4, 0.05), poleMat);
  frame.position.set(0, 5.2, 0.13);
  group.add(frame);
  return group;
}

// Place trees / billboards / buildings around the track at a given lateral
// offset, every `stride` samples. The decorate function returns an optional
// mesh per slot (or null to skip). Returns a Group.
function decorateTrack(track, sideOffset, stride, decorate) {
  const group = new THREE.Group();
  if (!track || !track.points || !track.tangents) return group;
  // Use the smaller of the two arrays so we never index a missing tangent.
  // (CatmullRom getSpacedPoints(N) returns N+1 points but only N tangents.)
  const SAMPLES = Math.min(track.points.length, track.tangents.length);
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3();
  for (let i = 0; i < SAMPLES; i += stride) {
    const p = track.points[i];
    const t = track.tangents[i];
    if (!p || !t) continue;
    right.crossVectors(t, up).normalize();
    for (const side of [1, -1]) {
      const off = side * sideOffset;
      const wx = p.x + right.x * off + (Math.random() - 0.5) * 4;
      const wz = p.z + right.z * off + (Math.random() - 0.5) * 4;
      const yaw = Math.atan2(t.x, t.z);
      const mesh = decorate(i, side);
      if (!mesh) continue;
      mesh.position.set(wx, p.y, wz);
      mesh.rotation.y = yaw + Math.PI * 0.5;
      group.add(mesh);
    }
  }
  return group;
}

// Top-level: build a scenery group for a given track id + track object.
export function buildScenery(trackId, track) {
  const group = new THREE.Group();

  // 1. Distant mountain ring — common to all tracks, recolored to taste.
  const mountainColors = {
    lakeside: { color: 0x1a3050, rim: 0x4a6a90 },
    bayside:  { color: 0x14285a, rim: 0x3a6a9a },
    highway:  { color: 0x281030, rim: 0x6a3070 },
    neon:     { color: 0x2a0c4a, rim: 0xa648c8 }
  };
  const mc = mountainColors[trackId] || mountainColors.lakeside;
  group.add(buildMountains({ color: mc.color, rimColor: mc.rim }));

  // 2. Per-track foreground scenery. Stride controls density.
  if (trackId === "lakeside") {
    // Pines along both sides, dense.
    group.add(decorateTrack(track, 18, 5, () => {
      if (Math.random() < 0.22) return null;
      return buildPineTree(0.7 + Math.random() * 0.7);
    }));
    // A few bigger pines further out for parallax.
    group.add(decorateTrack(track, 36, 14, () => {
      if (Math.random() < 0.5) return null;
      return buildPineTree(1.4 + Math.random() * 0.8);
    }));
  } else if (trackId === "bayside") {
    // Palm trees on outer shoulder.
    group.add(decorateTrack(track, 16, 8, () => {
      if (Math.random() < 0.2) return null;
      return buildPalmTree(0.9 + Math.random() * 0.4);
    }));
    // A few low buildings further inland.
    group.add(decorateTrack(track, 60, 16, () => {
      if (Math.random() < 0.45) return null;
      return buildSkyscraper(8 + Math.random() * 6, 12 + Math.random() * 14, 8 + Math.random() * 6, Math.random() < 0.5 ? 0xffd166 : 0x2ee9ff);
    }));
  } else if (trackId === "highway") {
    // Billboards every so often.
    group.add(decorateTrack(track, 22, 14, (i) => {
      if (Math.random() < 0.55) return null;
      const colors = [0xff315c, 0xffd166, 0x2ee9ff, 0xa66cff];
      return buildBillboard(colors[i % colors.length]);
    }));
    // Sparse low buildings.
    group.add(decorateTrack(track, 50, 12, () => {
      if (Math.random() < 0.5) return null;
      return buildSkyscraper(10 + Math.random() * 10, 8 + Math.random() * 10, 10 + Math.random() * 6, 0xffd166);
    }));
  } else if (trackId === "neon") {
    // Dense skyscrapers — cyberpunk overpass.
    group.add(decorateTrack(track, 28, 6, () => {
      if (Math.random() < 0.22) return null;
      const hues = [0xff315c, 0x2ee9ff, 0xa66cff, 0xffd166, 0x3cff9b];
      return buildSkyscraper(6 + Math.random() * 6, 18 + Math.random() * 36, 6 + Math.random() * 6, hues[Math.floor(Math.random() * hues.length)]);
    }));
    group.add(decorateTrack(track, 56, 10, () => {
      if (Math.random() < 0.4) return null;
      return buildSkyscraper(12 + Math.random() * 8, 40 + Math.random() * 40, 12 + Math.random() * 8, 0x2ee9ff);
    }));
  }

  return group;
}
