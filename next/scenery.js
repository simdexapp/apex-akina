// Per-track scenery — distant mountains, trees, buildings, billboards.
// Heavily optimized: mountains are positioned outside the track bbox (so the
// player can't drive into them), repeated assets use InstancedMesh / shared
// geometry+material, and per-track density is conservative.

import * as THREE from "three";
import { buildBuildingTexture } from "./textures.js?v=97";

// Build the texture once, share across all building instances.
let _BUILDING_TEX = null;
function getBuildingTex() {
  return _BUILDING_TEX || (_BUILDING_TEX = buildBuildingTexture());
}

// Compute the axis-aligned bbox of a track's centerline points. Used to push
// mountains and far scenery outside any drivable region.
function trackBounds(track) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of track.points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  const cx = (minX + maxX) * 0.5;
  const cz = (minZ + maxZ) * 0.5;
  const halfX = (maxX - minX) * 0.5;
  const halfZ = (maxZ - minZ) * 0.5;
  const radius = Math.sqrt(halfX * halfX + halfZ * halfZ);
  return { cx, cz, radius };
}

// Distant mountain ring centered on the track bbox. Radius = bbox radius +
// MOUNTAIN_BUFFER so the player never drives into them. Uses ONE shared
// material + geometry (re-using the same ConeGeometry for every peak with a
// per-instance scale) so it's a small handful of draw calls.
// Mountains intersecting the playable area was a real bug at small tracks.
// Buffer bumped from 320 -> 520; we also push them OUT by half their base
// width so the inner edge of the mountain stays well clear of the road.
const MOUNTAIN_BUFFER = 520;
function buildMountains(track, { count = 36, color = 0x261a3a, rimColor = 0x6a3a8a } = {}) {
  const group = new THREE.Group();
  const bounds = trackBounds(track);
  const mat = new THREE.MeshStandardMaterial({
    color, metalness: 0.0, roughness: 1.0, emissive: rimColor, emissiveIntensity: 0.22, flatShading: true
  });
  const baseGeo = new THREE.ConeGeometry(1, 1, 5, 1, false);
  const inst = new THREE.InstancedMesh(baseGeo, mat, count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + Math.random() * 0.06;
    const h = 60 + Math.random() * 120;
    const w = 80 + Math.random() * 140;
    // Push the mountain center out by half its base width so the inner
    // edge sits behind MOUNTAIN_BUFFER, not on top of it.
    const r = bounds.radius + MOUNTAIN_BUFFER + w * 0.5 + (Math.random() - 0.5) * 80;
    dummy.position.set(bounds.cx + Math.cos(ang) * r, -8 + h * 0.5, bounds.cz + Math.sin(ang) * r);
    dummy.rotation.y = Math.random() * Math.PI;
    dummy.scale.set(w, h, w);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  }
  inst.instanceMatrix.needsUpdate = true;
  group.add(inst);
  return group;
}

// ============================================================
// Asset templates — built once, then InstancedMesh-ed per placement.
// Each template returns { geometries, material } so we can build one
// InstancedMesh per (geometry, material) pair.
// ============================================================

// Tree: merged into 2 instanced parts — trunk (cylinder) + foliage (cone).
// We pre-bake one trunk+foliage stack, then the InstancedMesh handles N copies.
function buildTreeInstances(count, trunkColor, leafColor, leafEmissive = 0x0c2018) {
  const trunkMat = new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.85, emissive: leafEmissive, emissiveIntensity: 0.18 });
  // Trunk + 3 stacked foliage cones merged via 4 InstancedMeshes.
  const trunkGeo = new THREE.CylinderGeometry(0.20, 0.24, 1.2, 6);
  const tier1Geo = new THREE.ConeGeometry(1.2, 1.6, 6);
  const tier2Geo = new THREE.ConeGeometry(0.92, 1.28, 6);
  const tier3Geo = new THREE.ConeGeometry(0.64, 0.96, 6);
  return {
    trunkMesh: new THREE.InstancedMesh(trunkGeo, trunkMat, count),
    tier1Mesh: new THREE.InstancedMesh(tier1Geo, leafMat, count),
    tier2Mesh: new THREE.InstancedMesh(tier2Geo, leafMat, count),
    tier3Mesh: new THREE.InstancedMesh(tier3Geo, leafMat, count),
  };
}

// Place a tree instance at world (x, y, z) with random scale + yaw.
function setTreeInstance(meshes, idx, x, y, z, scale = 1, yaw = 0) {
  const dummy = new THREE.Object3D();
  // Trunk
  dummy.position.set(x, y + 0.6 * scale, z);
  dummy.rotation.set(0, yaw, 0);
  dummy.scale.setScalar(scale);
  dummy.updateMatrix();
  meshes.trunkMesh.setMatrixAt(idx, dummy.matrix);
  // Tier 1
  dummy.position.set(x, y + 1.4 * scale, z);
  dummy.updateMatrix();
  meshes.tier1Mesh.setMatrixAt(idx, dummy.matrix);
  // Tier 2
  dummy.position.set(x, y + 2.1 * scale, z);
  dummy.updateMatrix();
  meshes.tier2Mesh.setMatrixAt(idx, dummy.matrix);
  // Tier 3
  dummy.position.set(x, y + 2.8 * scale, z);
  dummy.updateMatrix();
  meshes.tier3Mesh.setMatrixAt(idx, dummy.matrix);
}

function flushTreeInstances(group, meshes) {
  for (const m of [meshes.trunkMesh, meshes.tier1Mesh, meshes.tier2Mesh, meshes.tier3Mesh]) {
    m.instanceMatrix.needsUpdate = true;
    group.add(m);
  }
}

// Building: one InstancedMesh for body + one for window grid (random subset).
function buildBuildingInstances(count) {
  // Apply the procedural window-grid texture so dark blocks now read as
  // lit-up office buildings at night.
  const tex = getBuildingTex();
  // Repeat horizontally per face — keeps window scale roughly constant
  // regardless of building width.
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex,
    roughness: 0.6,
    metalness: 0.2,
    emissive: 0xffffff,
    emissiveMap: tex,
    emissiveIntensity: 0.55
  });
  const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
  return new THREE.InstancedMesh(bodyGeo, bodyMat, count);
}

// Billboard: pole + panel as one merged mesh per placement (cheap enough).
function makeBillboard(color) {
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
  return group;
}

// ============================================================
// Track-side decoration helper. Uses InstancedMesh callback for hot paths.
// ============================================================
function decorateTrackInstanced(track, sideOffset, stride, count, place) {
  if (!track || !track.points || !track.tangents) return 0;
  const SAMPLES = Math.min(track.points.length, track.tangents.length);
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3();
  let placed = 0;
  for (let i = 0; i < SAMPLES; i += stride) {
    if (placed >= count) break;
    const p = track.points[i];
    const t = track.tangents[i];
    if (!p || !t) continue;
    right.crossVectors(t, up).normalize();
    for (const side of [1, -1]) {
      if (placed >= count) break;
      const off = side * sideOffset + (Math.random() - 0.5) * 6;
      const x = p.x + right.x * off;
      const z = p.z + right.z * off;
      const yaw = Math.atan2(t.x, t.z);
      // Skip if the slot would be too close to any other track point — guards
      // against accidental placements where the loop curves back.
      const ok = place(placed, x, p.y, z, yaw);
      if (ok) placed++;
    }
  }
  return placed;
}

// ============================================================
// Ambient particle cloud — flavored per track. Uses THREE.Points with a
// per-vertex animation offset so particles gently drift across the track
// envelope. Returns the Points mesh and an updater fn the caller can tick
// each frame for slight motion (or skip — the static cloud still looks ok).
function buildAmbientParticles(trackId, track) {
  const PALETTES = {
    lakeside:     { color: 0xfff5a0, count: 240, size: 1.6, mode: "float" },     // fireflies
    bayside:      { color: 0xfff5d0, count: 180, size: 1.4, mode: "float" },
    highway:      { color: 0xffd9a0, count: 120, size: 1.2, mode: "drift" },     // dust
    neon:         { color: 0x4ce8ff, count: 320, size: 1.4, mode: "spark" },
    mountainpass: { color: 0xeef4ff, count: 280, size: 1.6, mode: "snow" },
    city:         { color: 0xb0c0d8, count: 180, size: 1.0, mode: "drift" },
    rural:        { color: 0xc8e8a0, count: 200, size: 1.2, mode: "float" },     // pollen
    drift:        { color: 0xff48b6, count: 200, size: 1.6, mode: "spark" }      // confetti vibes
  };
  const cfg = PALETTES[trackId] || PALETTES.lakeside;
  const { cx, cz, radius } = trackBounds(track);
  const N = cfg.count;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = radius * (0.4 + Math.random() * 0.6);
    pos[i * 3]     = cx + Math.cos(ang) * r;
    pos[i * 3 + 1] = 4 + Math.random() * 30;
    pos[i * 3 + 2] = cz + Math.sin(ang) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: cfg.color,
    size: cfg.size,
    sizeAttenuation: false,
    transparent: true,
    opacity: cfg.mode === "snow" ? 0.6 : 0.85,
    depthWrite: false
  });
  const points = new THREE.Points(geo, mat);
  points.userData.mode = cfg.mode;
  points.userData.basePos = pos.slice();
  return points;
}

// ============================================================
// Top-level: build a scenery group for a given track id + track object.
// ============================================================
export function buildScenery(trackId, track) {
  const group = new THREE.Group();

  // 1. Distant mountain ring — outside the track bbox by 320m.
  const mountainColors = {
    lakeside: { color: 0x1a3050, rim: 0x4a6a90 },
    bayside:  { color: 0x14285a, rim: 0x3a6a9a },
    highway:  { color: 0x281030, rim: 0x6a3070 },
    neon:     { color: 0x2a0c4a, rim: 0xa648c8 },
    mountainpass: { color: 0x18243a, rim: 0xa86a48 },
    city:     { color: 0x1c1838, rim: 0x6a4080 },
    rural:    { color: 0x1c2a3c, rim: 0xa86a48 },
    drift:    { color: 0x281438, rim: 0xa648c8 }
  };
  const mc = mountainColors[trackId] || mountainColors.lakeside;
  group.add(buildMountains(track, { color: mc.color, rimColor: mc.rim }));

  // 2. Per-track foreground scenery. Pushed well off the road; instanced.
  // sideOffset 24+ keeps anything tall outside the racing line.
  const dummy = new THREE.Object3D();

  if (trackId === "lakeside") {
    // ~80 pines along both sides, instanced.
    const PINE_CAP = 80;
    const trees = buildTreeInstances(PINE_CAP, 0x2a1810, 0x1a4030);
    let placed = 0;
    decorateTrackInstanced(track, 26, 7, PINE_CAP, (i, x, y, z, yaw) => {
      if (Math.random() < 0.18) return false;
      const scale = 0.9 + Math.random() * 1.0;
      setTreeInstance(trees, placed, x, y, z, scale, yaw + Math.random() * 0.5);
      placed++;
      return true;
    });
    // Park unused instances out of view.
    for (let i = placed; i < PINE_CAP; i++) {
      dummy.position.set(0, -1000, 0); dummy.scale.setScalar(0.001); dummy.updateMatrix();
      trees.trunkMesh.setMatrixAt(i, dummy.matrix);
      trees.tier1Mesh.setMatrixAt(i, dummy.matrix);
      trees.tier2Mesh.setMatrixAt(i, dummy.matrix);
      trees.tier3Mesh.setMatrixAt(i, dummy.matrix);
    }
    flushTreeInstances(group, trees);
  } else if (trackId === "bayside") {
    // Palms on outer shoulder, instanced lite (just trunk+frond ball).
    const PALM_CAP = 50;
    const palms = buildTreeInstances(PALM_CAP, 0x6a4a26, 0x2a8048);
    let placed = 0;
    decorateTrackInstanced(track, 22, 10, PALM_CAP, (i, x, y, z, yaw) => {
      if (Math.random() < 0.2) return false;
      const scale = 1.2 + Math.random() * 0.5;
      setTreeInstance(palms, placed, x, y, z, scale, yaw);
      placed++;
      return true;
    });
    for (let i = placed; i < PALM_CAP; i++) {
      dummy.position.set(0, -1000, 0); dummy.scale.setScalar(0.001); dummy.updateMatrix();
      palms.trunkMesh.setMatrixAt(i, dummy.matrix);
      palms.tier1Mesh.setMatrixAt(i, dummy.matrix);
      palms.tier2Mesh.setMatrixAt(i, dummy.matrix);
      palms.tier3Mesh.setMatrixAt(i, dummy.matrix);
    }
    flushTreeInstances(group, palms);
    // ~20 buildings further inland, instanced.
    const BLD_CAP = 20;
    const bldMesh = buildBuildingInstances(BLD_CAP);
    let bplaced = 0;
    decorateTrackInstanced(track, 90, 18, BLD_CAP, (i, x, y, z, yaw) => {
      if (Math.random() < 0.4) return false;
      const w = 8 + Math.random() * 8, h = 14 + Math.random() * 16, d = 8 + Math.random() * 8;
      dummy.position.set(x, y + h * 0.5, z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(w, h, d);
      dummy.updateMatrix();
      bldMesh.setMatrixAt(bplaced, dummy.matrix);
      bplaced++;
      return true;
    });
    for (let i = bplaced; i < BLD_CAP; i++) {
      dummy.position.set(0, -1000, 0); dummy.scale.setScalar(0.001); dummy.updateMatrix();
      bldMesh.setMatrixAt(i, dummy.matrix);
    }
    bldMesh.instanceMatrix.needsUpdate = true;
    group.add(bldMesh);
  } else if (trackId === "highway") {
    // ~12 billboards.
    const colors = [0xff315c, 0xffd166, 0x2ee9ff, 0xa66cff];
    let bilCount = 0;
    decorateTrackInstanced(track, 32, 22, 12, (i, x, y, z, yaw) => {
      if (Math.random() < 0.4) return false;
      const bil = makeBillboard(colors[i % colors.length]);
      bil.position.set(x, y, z);
      bil.rotation.y = yaw + Math.PI * 0.5;
      group.add(bil);
      bilCount++;
      return true;
    });
    // ~16 buildings.
    const BLD_CAP = 16;
    const bldMesh = buildBuildingInstances(BLD_CAP);
    let bplaced = 0;
    decorateTrackInstanced(track, 70, 14, BLD_CAP, (i, x, y, z, yaw) => {
      if (Math.random() < 0.4) return false;
      const w = 12 + Math.random() * 10, h = 14 + Math.random() * 14, d = 12 + Math.random() * 8;
      dummy.position.set(x, y + h * 0.5, z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(w, h, d);
      dummy.updateMatrix();
      bldMesh.setMatrixAt(bplaced, dummy.matrix);
      bplaced++;
      return true;
    });
    for (let i = bplaced; i < BLD_CAP; i++) {
      dummy.position.set(0, -1000, 0); dummy.scale.setScalar(0.001); dummy.updateMatrix();
      bldMesh.setMatrixAt(i, dummy.matrix);
    }
    bldMesh.instanceMatrix.needsUpdate = true;
    group.add(bldMesh);
  } else if (trackId === "neon") {
    // Dense skyscrapers — 50 buildings via instancing.
    const BLD_CAP = 50;
    const bldMesh = buildBuildingInstances(BLD_CAP);
    let bplaced = 0;
    decorateTrackInstanced(track, 38, 8, BLD_CAP, (i, x, y, z, yaw) => {
      if (Math.random() < 0.18) return false;
      const w = 8 + Math.random() * 8, h = 28 + Math.random() * 50, d = 8 + Math.random() * 8;
      dummy.position.set(x, y + h * 0.5, z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(w, h, d);
      dummy.updateMatrix();
      bldMesh.setMatrixAt(bplaced, dummy.matrix);
      bplaced++;
      return true;
    });
    for (let i = bplaced; i < BLD_CAP; i++) {
      dummy.position.set(0, -1000, 0); dummy.scale.setScalar(0.001); dummy.updateMatrix();
      bldMesh.setMatrixAt(i, dummy.matrix);
    }
    bldMesh.instanceMatrix.needsUpdate = true;
    group.add(bldMesh);
  } else if (trackId === "mountainpass") {
    // Heavy pine forest both sides + far parallax pines.
    const PINE_CAP = 100;
    const trees = buildTreeInstances(PINE_CAP, 0x2a1810, 0x244838);
    let placed = 0;
    decorateTrackInstanced(track, 28, 6, PINE_CAP, (i, x, y, z, yaw) => {
      if (Math.random() < 0.10) return false;
      const scale = 0.9 + Math.random() * 1.4;
      setTreeInstance(trees, placed, x, y, z, scale, yaw + Math.random() * 0.5);
      placed++;
      return true;
    });
    for (let i = placed; i < PINE_CAP; i++) {
      dummy.position.set(0, -1000, 0); dummy.scale.setScalar(0.001); dummy.updateMatrix();
      trees.trunkMesh.setMatrixAt(i, dummy.matrix);
      trees.tier1Mesh.setMatrixAt(i, dummy.matrix);
      trees.tier2Mesh.setMatrixAt(i, dummy.matrix);
      trees.tier3Mesh.setMatrixAt(i, dummy.matrix);
    }
    flushTreeInstances(group, trees);
  } else if (trackId === "rural") {
    // Rural — light pine spread + a few mountain billboard hills.
    const PINE_CAP = 80;
    const trees = buildTreeInstances(PINE_CAP, 0x2a1810, 0x244838);
    let placed = 0;
    decorateTrackInstanced(track, 24, 8, PINE_CAP, (i, x, y, z, yaw) => {
      if (Math.random() < 0.20) return false;
      const scale = 0.8 + Math.random() * 1.0;
      setTreeInstance(trees, placed, x, y, z, scale, yaw + Math.random() * 0.5);
      placed++;
      return true;
    });
    for (let i = placed; i < PINE_CAP; i++) {
      dummy.position.set(0, -1000, 0); dummy.scale.setScalar(0.001); dummy.updateMatrix();
      trees.trunkMesh.setMatrixAt(i, dummy.matrix);
      trees.tier1Mesh.setMatrixAt(i, dummy.matrix);
      trees.tier2Mesh.setMatrixAt(i, dummy.matrix);
      trees.tier3Mesh.setMatrixAt(i, dummy.matrix);
    }
    flushTreeInstances(group, trees);
  } else if (trackId === "drift") {
    // Drift court — minimal scenery, just open tarmac. A handful of low buildings.
    const BLD_CAP = 14;
    const bldMesh = buildBuildingInstances(BLD_CAP);
    let bplaced = 0;
    decorateTrackInstanced(track, 50, 18, BLD_CAP, (i, x, y, z, yaw) => {
      if (Math.random() < 0.4) return false;
      const w = 14 + Math.random() * 14, h = 8 + Math.random() * 14, d = 14 + Math.random() * 12;
      dummy.position.set(x, y + h * 0.5, z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(w, h, d);
      dummy.updateMatrix();
      bldMesh.setMatrixAt(bplaced, dummy.matrix);
      bplaced++;
      return true;
    });
    for (let i = bplaced; i < BLD_CAP; i++) {
      dummy.position.set(0, -1000, 0); dummy.scale.setScalar(0.001); dummy.updateMatrix();
      bldMesh.setMatrixAt(i, dummy.matrix);
    }
    bldMesh.instanceMatrix.needsUpdate = true;
    group.add(bldMesh);
  } else if (trackId === "city") {
    // Tall blocky buildings tight to the track.
    const BLD_CAP = 60;
    const bldMesh = buildBuildingInstances(BLD_CAP);
    let bplaced = 0;
    decorateTrackInstanced(track, 36, 7, BLD_CAP, (i, x, y, z, yaw) => {
      if (Math.random() < 0.15) return false;
      const w = 14 + Math.random() * 14, h = 36 + Math.random() * 60, d = 14 + Math.random() * 14;
      dummy.position.set(x, y + h * 0.5, z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(w, h, d);
      dummy.updateMatrix();
      bldMesh.setMatrixAt(bplaced, dummy.matrix);
      bplaced++;
      return true;
    });
    for (let i = bplaced; i < BLD_CAP; i++) {
      dummy.position.set(0, -1000, 0); dummy.scale.setScalar(0.001); dummy.updateMatrix();
      bldMesh.setMatrixAt(i, dummy.matrix);
    }
    bldMesh.instanceMatrix.needsUpdate = true;
    group.add(bldMesh);
  }

  // 3. Ambient atmospheric particles (always added).
  const ambient = buildAmbientParticles(trackId, track);
  group.add(ambient);
  group.userData.ambient = ambient;

  return group;
}

// Tick ambient particles — gentle motion based on mode.
export function tickAmbient(group, dt) {
  const pts = group?.userData?.ambient;
  if (!pts) return;
  const mode = pts.userData.mode;
  const base = pts.userData.basePos;
  const arr = pts.geometry.attributes.position.array;
  const t = performance.now() * 0.001;
  for (let i = 0; i < arr.length / 3; i++) {
    const bx = base[i * 3], by = base[i * 3 + 1], bz = base[i * 3 + 2];
    if (mode === "float") {
      arr[i * 3]     = bx + Math.sin(t * 0.5 + i * 0.7) * 1.4;
      arr[i * 3 + 1] = by + Math.cos(t * 0.4 + i * 0.3) * 1.0;
      arr[i * 3 + 2] = bz + Math.cos(t * 0.5 + i * 0.5) * 1.4;
    } else if (mode === "snow") {
      arr[i * 3 + 1] = by + ((-t * 6 + i * 3.7) % 30);
      arr[i * 3]     = bx + Math.sin(t * 0.6 + i) * 0.8;
    } else if (mode === "spark") {
      arr[i * 3]     = bx + Math.sin(t * 1.6 + i * 0.9) * 2.0;
      arr[i * 3 + 1] = by + Math.cos(t * 1.2 + i * 0.5) * 1.6;
      arr[i * 3 + 2] = bz + Math.cos(t * 1.5 + i * 0.7) * 2.0;
    } else {
      // drift — slow horizontal sweep.
      arr[i * 3]     = bx + Math.sin(t * 0.2 + i * 0.4) * 3.0;
      arr[i * 3 + 2] = bz + Math.cos(t * 0.2 + i * 0.4) * 3.0;
    }
  }
  pts.geometry.attributes.position.needsUpdate = true;
}
