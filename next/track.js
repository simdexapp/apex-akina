import * as THREE from "three";
import { TRACKS } from "./tracks-data.js";
import { buildAsphaltTexture, buildAsphaltNormal, buildGroundTexture } from "./textures.js?v=90";

const ROAD_HALF_WIDTH = 7;
const SHOULDER = 1.0;
const SAMPLES = 480;

// Build textures once, reuse across track rebuilds (track loadTrack swaps the
// road geometry but not the surface look).
let _ROAD_MAP = null;
let _ROAD_NORMAL = null;
function getRoadMap()    { return _ROAD_MAP    || (_ROAD_MAP    = buildAsphaltTexture()); }
function getRoadNormal() { return _ROAD_NORMAL || (_ROAD_NORMAL = buildAsphaltNormal()); }

export function getTrackList() {
  return Object.entries(TRACKS).map(([id, t]) => ({ id, name: t.name, description: t.description, palette: t.palette }));
}

export function buildTrack(trackId = "lakeside") {
  const track = TRACKS[trackId] || TRACKS.lakeside;
  // Use CHORDAL CatmullRom — avoids the "twist" / overshoot artifacts that the
  // default tensioned spline produces at unevenly-spaced control points. The
  // curve sticks closer to the actual point sequence without creating kinks
  // or self-intersections at sharp turns.
  const curve = new THREE.CatmullRomCurve3(track.points, true, "chordal", 0.5);
  const points = curve.getSpacedPoints(SAMPLES);
  const tangents = [];
  for (let i = 0; i < SAMPLES; i++) {
    tangents.push(curve.getTangent(i / SAMPLES).normalize());
  }

  // Build a ribbon mesh by extruding a width vector perpendicular to each tangent.
  const positions = [];
  const colors = [];
  const uvs = [];
  const indices = [];
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3();
  // Vertex colors near WHITE so the asphalt texture map shows through at
  // full brightness. Was #a8b0bc / #8c95a4 — those tinted the road BACK
  // toward gray and combined with the dark texture to make the road
  // invisible against the ground. Now ~#f0 / #dd: tiny stripe variation
  // on top of full-bright texture sampling.
  const innerColor = new THREE.Color("#f0f4fa");
  const altColor = new THREE.Color("#dde2eb");
  // Accumulate arclength for V coordinate so the texture doesn't repeat per
  // segment — it tiles down the road naturally.
  let accLen = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const p = points[i];
    const t = tangents[i];
    right.crossVectors(t, up).normalize();
    const lx = p.x + right.x * (ROAD_HALF_WIDTH + SHOULDER);
    const lz = p.z + right.z * (ROAD_HALF_WIDTH + SHOULDER);
    const rx = p.x - right.x * (ROAD_HALF_WIDTH + SHOULDER);
    const rz = p.z - right.z * (ROAD_HALF_WIDTH + SHOULDER);
    positions.push(lx, p.y, lz);
    positions.push(rx, p.y, rz);
    const c = i % 6 < 3 ? innerColor : altColor;
    colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    // U: 0 = left edge, 1 = right edge.
    // V: arclength / 6m (so texture tiles every 6m along the road).
    if (i > 0) accLen += p.distanceTo(points[i - 1]);
    const v = accLen / 6.0;
    uvs.push(0, v, 1, v);
  }
  for (let i = 0; i < SAMPLES; i++) {
    const j = (i + 1) % SAMPLES;
    const a = i * 2, b = i * 2 + 1, c = j * 2, d = j * 2 + 1;
    indices.push(a, b, c);
    indices.push(b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: getRoadMap(),
    normalMap: getRoadNormal(),
    normalScale: new THREE.Vector2(0.55, 0.55),
    metalness: 0.10,
    roughness: 0.78,
    // Strong emissive — the road needs to read as a distinct surface in
    // every lighting condition. 0x808088 at 0.55 gives it ~50% self-glow
    // so it's never confused with the off-road ground.
    emissive: 0x808088,
    emissiveIntensity: 0.55
  });
  const roadMesh = new THREE.Mesh(geo, mat);
  roadMesh.receiveShadow = true;

  // Lane lines — minimal: just one center dashed line (gold) and two edge
  // lines (off-white). Stripes thinned + dimmed so they read as paint
  // not bright neon paint stripes scattered everywhere.
  const laneGroup = new THREE.Group();
  // [offsetMul, color, dashLen, gapLen]
  const laneSpec = [
    [0,    0xc8b070, 2.4, 6.0],   // center dashed gold
    [-0.92, 0x9098a4, 2.0, 0.0], // left solid edge
    [0.92,  0x9098a4, 2.0, 0.0]  // right solid edge
  ];
  for (const [offsetMul, color, dashLen, gapLen] of laneSpec) {
    const offset = ROAD_HALF_WIDTH * offsetMul;
    const slots = [];
    let acc = 0;
    let drawing = true;
    for (let i = 0; i < SAMPLES; i++) {
      const p = points[i];
      const next = points[(i + 1) % SAMPLES];
      const seg = p.distanceTo(next);
      acc += seg;
      const limit = drawing ? dashLen : gapLen;
      if (gapLen === 0 || acc >= limit) {
        if (drawing) slots.push(i);
        if (gapLen > 0) drawing = !drawing;
        acc = 0;
      }
    }
    if (slots.length === 0) continue;
    const mat = new THREE.MeshBasicMaterial({ color });
    const geo = new THREE.PlaneGeometry(0.10, dashLen * 0.9);
    const inst = new THREE.InstancedMesh(geo, mat, slots.length);
    const dummy = new THREE.Object3D();
    for (let s = 0; s < slots.length; s++) {
      const i = slots[s];
      const p = points[i];
      const t = tangents[i];
      right.crossVectors(t, up).normalize();
      dummy.position.set(p.x + right.x * offset, p.y + 0.03, p.z + right.z * offset);
      dummy.rotation.set(-Math.PI / 2, 0, -Math.atan2(t.x, t.z));
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      inst.setMatrixAt(s, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    laneGroup.add(inst);
  }

  // Kerb stripes — alternating colors at the road edge. Instanced per side
  // so we collapse 480×2 mesh instances into 2 draw calls. Slimmer + lower
  // profile so they read as painted curbs instead of speed bumps.
  const kerbGroup = new THREE.Group();
  const kerbGeoFlat = new THREE.BoxGeometry(0.4, 0.06, 1.6);
  for (const side of [1, -1]) {
    const matA = new THREE.MeshStandardMaterial({ color: track.palette.kerbA, metalness: 0.15, roughness: 0.55 });
    const matB = new THREE.MeshStandardMaterial({ color: track.palette.kerbB, metalness: 0.15, roughness: 0.55 });
    const instA = new THREE.InstancedMesh(kerbGeoFlat, matA, Math.ceil(SAMPLES / 2));
    const instB = new THREE.InstancedMesh(kerbGeoFlat, matB, Math.ceil(SAMPLES / 2));
    let aIdx = 0, bIdx = 0;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < SAMPLES; i++) {
      const p = points[i];
      const t = tangents[i];
      right.crossVectors(t, up).normalize();
      const offset = side * (ROAD_HALF_WIDTH + SHOULDER * 0.5);
      dummy.position.set(p.x + right.x * offset, p.y + 0.03, p.z + right.z * offset);
      dummy.rotation.set(0, Math.atan2(t.x, t.z), 0);
      dummy.updateMatrix();
      if (i % 2 === 0) { instA.setMatrixAt(aIdx++, dummy.matrix); }
      else             { instB.setMatrixAt(bIdx++, dummy.matrix); }
    }
    instA.instanceMatrix.needsUpdate = true;
    instB.instanceMatrix.needsUpdate = true;
    instA.count = aIdx;
    instB.count = bIdx;
    kerbGroup.add(instA, instB);
  }

  // Ground plane below the track — DARKER than the road by design so
  // the asphalt strip pops visibly against the off-road terrain.
  const groundGeo = new THREE.PlaneGeometry(2400, 2400, 32, 32);
  const groundTex = buildGroundTexture(track.palette.ground);
  groundTex.repeat.set(80, 80);
  const groundMat = new THREE.MeshStandardMaterial({
    // Multiply texture by 18% — pushes ground way darker than the road's
    // emissive-boosted self-glow. Now there's clear contrast.
    color: 0x303440,
    map: groundTex,
    metalness: 0.0,
    roughness: 0.95,
    emissive: 0x000000,
    emissiveIntensity: 0
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2.2;
  ground.receiveShadow = true;

  // Bridge / guardrail barriers — looser than before so it doesn't feel claustrophobic.
  const barrierGroup = new THREE.Group();
  const BRIDGE_THRESHOLD = 1.4;        // only genuinely high sections become bridges
  const BRIDGE_BARRIER_H = 1.8;        // shorter walls so the view stays open
  const FLAT_BARRIER_H = 0.45;
  const wallMatBridge = new THREE.MeshLambertMaterial({
    color: 0xd6dde8, emissive: 0x2ee9ff, emissiveIntensity: 0.16
  });
  const wallMatFlat = new THREE.MeshLambertMaterial({ color: 0x2c3344 });
  const postMatBridge = new THREE.MeshLambertMaterial({ color: 0x1a1f2c, emissive: 0x0a0d18 });
  const supportMat = new THREE.MeshLambertMaterial({ color: 0x10131e });
  const stripeMatRight = new THREE.MeshBasicMaterial({ color: 0x2ee9ff });
  const stripeMatLeft = new THREE.MeshBasicMaterial({ color: 0xffd166 });

  for (let i = 0; i < SAMPLES; i++) {
    const p = points[i];
    const t = tangents[i];
    right.crossVectors(t, up).normalize();
    const isBridge = p.y > BRIDGE_THRESHOLD;
    const barrierH = isBridge ? BRIDGE_BARRIER_H : FLAT_BARRIER_H;
    const barrierY = p.y + barrierH * 0.5;

    for (const side of [1, -1]) {
      const offset = side * (ROAD_HALF_WIDTH + SHOULDER * 0.9);
      const wx = p.x + right.x * offset;
      const wz = p.z + right.z * offset;
      const yaw = Math.atan2(t.x, t.z);

      // Main wall section.
      const wallGeo = new THREE.BoxGeometry(0.24, barrierH, 1.6);
      const wall = new THREE.Mesh(wallGeo, isBridge ? wallMatBridge : wallMatFlat);
      wall.position.set(wx, barrierY, wz);
      wall.rotation.y = yaw;
      barrierGroup.add(wall);

      if (isBridge) {
        // Vertical posts every 6 segments — much sparser.
        if (i % 6 === 0) {
          const postGeo = new THREE.BoxGeometry(0.26, BRIDGE_BARRIER_H + 0.3, 0.26);
          const post = new THREE.Mesh(postGeo, postMatBridge);
          post.position.set(wx, p.y + (BRIDGE_BARRIER_H + 0.3) * 0.5, wz);
          post.rotation.y = yaw;
          barrierGroup.add(post);
        }
        // Reflective top stripe stays continuous.
        const topGeo = new THREE.BoxGeometry(0.30, 0.08, 1.62);
        const top = new THREE.Mesh(topGeo, side > 0 ? stripeMatRight : stripeMatLeft);
        top.position.set(wx, p.y + BRIDGE_BARRIER_H + 0.05, wz);
        top.rotation.y = yaw;
        barrierGroup.add(top);
      }
    }

    // Support pillars: every 12 segments, only on genuinely high bridges.
    if (isBridge && i % 12 === 0 && p.y > 2.0) {
      for (const side of [1, -1]) {
        const offset = side * (ROAD_HALF_WIDTH + SHOULDER * 1.2);  // pushed slightly outboard
        const wx = p.x + right.x * offset;
        const wz = p.z + right.z * offset;
        const yaw = Math.atan2(t.x, t.z);
        const pillarHeight = p.y + 10;
        const pillarGeo = new THREE.BoxGeometry(0.45, pillarHeight, 0.45);
        const pillar = new THREE.Mesh(pillarGeo, supportMat);
        pillar.position.set(wx, p.y - pillarHeight * 0.5, wz);
        pillar.rotation.y = yaw;
        barrierGroup.add(pillar);
      }

      // No more cross-beam under the road — it cluttered the view.
    }
  }

  // Trackside posts — instanced for cheap draw cost.
  const postGroup = new THREE.Group();
  const postMatShared = new THREE.MeshLambertMaterial({ color: 0x0c1322 });
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xfff5d4 });
  const capMatRight = new THREE.MeshBasicMaterial({ color: 0x2ee9ff });
  const capMatLeft = new THREE.MeshBasicMaterial({ color: 0xffd166 });
  // Plan slots first so we can size InstancedMesh exactly.
  const POST_STRIDE = 8;       // shorter posts every 8 samples
  const LAMP_STRIDE = 40;      // tall lamps every 40 samples
  const shortSlots = [];
  const lampSlots = [];
  for (let i = 0; i < SAMPLES; i += POST_STRIDE) {
    if (i % LAMP_STRIDE === 0) lampSlots.push(i);
    else shortSlots.push(i);
  }
  // Each slot has 2 sides.
  const shortPostMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 1.6, 0.2), postMatShared, shortSlots.length * 2);
  const shortCapMeshR = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.06, 0.22), capMatRight, shortSlots.length);
  const shortCapMeshL = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.06, 0.22), capMatLeft, shortSlots.length);
  const lampPostMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 4.6, 0.2), postMatShared, lampSlots.length * 2);
  const lampHeadMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.45, 0.18, 0.45), lampHeadMat, lampSlots.length * 2);
  const dummy = new THREE.Object3D();
  let spIdx = 0, lpIdx = 0, lhIdx = 0, scrIdx = 0, sclIdx = 0;
  for (const i of shortSlots) {
    const p = points[i];
    const t = tangents[i];
    right.crossVectors(t, up).normalize();
    for (const side of [1, -1]) {
      const offset = side * (ROAD_HALF_WIDTH + SHOULDER + 1.6);
      const px = p.x + right.x * offset;
      const pz = p.z + right.z * offset;
      dummy.position.set(px, p.y + 0.8, pz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      shortPostMesh.setMatrixAt(spIdx++, dummy.matrix);
      dummy.position.set(px, p.y + 1.65, pz);
      dummy.updateMatrix();
      if (side > 0) shortCapMeshR.setMatrixAt(scrIdx++, dummy.matrix);
      else          shortCapMeshL.setMatrixAt(sclIdx++, dummy.matrix);
    }
  }
  shortCapMeshR.count = scrIdx;
  shortCapMeshL.count = sclIdx;
  for (const i of lampSlots) {
    const p = points[i];
    const t = tangents[i];
    right.crossVectors(t, up).normalize();
    for (const side of [1, -1]) {
      const offset = side * (ROAD_HALF_WIDTH + SHOULDER + 1.6);
      const px = p.x + right.x * offset;
      const pz = p.z + right.z * offset;
      dummy.position.set(px, p.y + 2.3, pz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      lampPostMesh.setMatrixAt(lpIdx++, dummy.matrix);
      // Lamp head over the road.
      const armLen = 2.0;
      const headX = px - right.x * side * armLen;
      const headZ = pz - right.z * side * armLen;
      dummy.position.set(headX, p.y + 4.46, headZ);
      dummy.updateMatrix();
      lampHeadMesh.setMatrixAt(lhIdx++, dummy.matrix);
    }
  }
  for (const m of [shortPostMesh, shortCapMeshR, shortCapMeshL, lampPostMesh, lampHeadMesh]) {
    m.instanceMatrix.needsUpdate = true;
    postGroup.add(m);
  }
  // Add a small number of real lights at lamp slots — too many tanks the
  // renderer. Cap at 6 across the whole track for sanity.
  const LAMP_LIGHT_CAP = 6;
  for (let k = 0; k < Math.min(LAMP_LIGHT_CAP, lampSlots.length); k++) {
    const i = lampSlots[Math.floor((k / LAMP_LIGHT_CAP) * lampSlots.length)];
    const p = points[i];
    const lampLight = new THREE.PointLight(0xfff5d4, 1.4, 22, 1.5);
    lampLight.position.set(p.x, p.y + 4.0, p.z);
    postGroup.add(lampLight);
  }

  // Distant ambient lights — small glowing markers off in the distance to give depth.
  const distantGroup = new THREE.Group();
  const distantHues = [0xff315c, 0x2ee9ff, 0xffd166, 0xa66cff, 0x3cff9b];
  for (let i = 0; i < 28; i++) {
    const ang = (i / 28) * Math.PI * 2;
    const r = 240 + Math.random() * 90;
    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r;
    const y = 4 + Math.random() * 22;
    const color = distantHues[i % distantHues.length];
    const lampGeo = new THREE.SphereGeometry(0.9 + Math.random() * 0.5, 6, 6);
    const lampMat = new THREE.MeshBasicMaterial({ color });
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(x, y, z);
    distantGroup.add(lamp);
  }

  // Start-line: a checkered strip at s=0 across the road surface.
  // Tiles are very thin (0.02 height) so they read as paint, not 3D bricks.
  const startGroup = new THREE.Group();
  {
    const start = points[0];
    const startTangent = tangents[0];
    right.crossVectors(startTangent, up).normalize();
    const yaw = Math.atan2(startTangent.x, startTangent.z);
    const lineWidth = 1.4;
    const TILES = 10;
    const tileGeo = new THREE.PlaneGeometry((ROAD_HALF_WIDTH * 2) / TILES, lineWidth);
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xfbfdff });
    const blackMat = new THREE.MeshBasicMaterial({ color: 0x05070d });
    for (let i = 0; i < TILES; i++) {
      const t = (i / TILES - 0.5) * (ROAD_HALF_WIDTH * 2) + (ROAD_HALF_WIDTH * 2) / TILES * 0.5;
      const tile = new THREE.Mesh(tileGeo, i % 2 === 0 ? whiteMat : blackMat);
      tile.position.set(start.x + right.x * t, start.y + 0.04, start.z + right.z * t);
      tile.rotation.set(-Math.PI / 2, 0, -yaw);
      startGroup.add(tile);
    }
    // Two pylons at the line edges with a banner between them.
    const pylonMat = new THREE.MeshStandardMaterial({ color: 0x0c1322, metalness: 0.3, roughness: 0.6 });
    for (const side of [1, -1]) {
      const pyOff = side * (ROAD_HALF_WIDTH + SHOULDER + 1.0);
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6.0, 0.3), pylonMat);
      pylon.position.set(start.x + right.x * pyOff, start.y + 3.0, start.z + right.z * pyOff);
      pylon.rotation.y = yaw;
      startGroup.add(pylon);
    }
    // Banner: slimmer + raised so it doesn't dominate the play view.
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(ROAD_HALF_WIDTH * 2 + 2, 0.32, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xff315c })
    );
    banner.position.set(start.x, start.y + 6.2, start.z);
    banner.rotation.y = yaw;
    startGroup.add(banner);
    // Overhead arch — two thin diagonal struts bridging the pylons.
    const archMat = new THREE.MeshStandardMaterial({ color: 0x2a3144, metalness: 0.6, roughness: 0.4 });
    const arch = new THREE.Mesh(new THREE.BoxGeometry(ROAD_HALF_WIDTH * 2 + 2, 0.10, 0.10), archMat);
    arch.position.set(start.x, start.y + 6.0, start.z);
    arch.rotation.y = yaw;
    startGroup.add(arch);
  }

  // Sector markers — flat plane stripes.
  const sectorGroup = new THREE.Group();
  for (let s = 1; s <= 3; s++) {
    const idx = Math.floor((s / 3) * SAMPLES) % SAMPLES;
    const p = points[idx];
    const t = tangents[idx];
    right.crossVectors(t, up).normalize();
    const yaw = Math.atan2(t.x, t.z);
    const sectorMat = new THREE.MeshBasicMaterial({ color: s === 3 ? 0xfbfdff : 0xffd166 });
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF_WIDTH * 2, 0.35), sectorMat);
    stripe.position.set(p.x, p.y + 0.04, p.z);
    stripe.rotation.set(-Math.PI / 2, 0, -yaw);
    sectorGroup.add(stripe);
  }

  const group = new THREE.Group();
  group.add(ground);
  group.add(roadMesh);
  group.add(laneGroup);
  group.add(kerbGroup);
  group.add(barrierGroup);
  group.add(postGroup);
  group.add(distantGroup);
  group.add(startGroup);
  group.add(sectorGroup);

  // Track length in world units.
  let length = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const a = points[i];
    const b = points[(i + 1) % SAMPLES];
    length += a.distanceTo(b);
  }

  // Sample(t) returns a position along the loop at param t ∈ [0,1).
  function sample(t) {
    const idx = Math.floor(((t % 1 + 1) % 1) * SAMPLES);
    const p = points[idx];
    const tang = tangents[idx];
    return {
      x: p.x,
      y: p.y,
      z: p.z,
      tangentAngle: Math.atan2(tang.x, tang.z)
    };
  }

  // Project a world position onto the track centerline. Returns { s, lateral } where
  // s is arclength position [0, length) and lateral is signed offset from centerline.
  function project(pos) {
    let bestI = 0;
    let bestDist = Infinity;
    for (let i = 0; i < SAMPLES; i++) {
      const dx = points[i].x - pos.x;
      const dz = points[i].z - pos.z;
      const d = dx * dx + dz * dz;
      if (d < bestDist) { bestDist = d; bestI = i; }
    }
    const s = (bestI / SAMPLES) * length;
    const t = tangents[bestI];
    const r = new THREE.Vector3().crossVectors(t, up).normalize();
    const dx = pos.x - points[bestI].x;
    const dz = pos.z - points[bestI].z;
    const lateral = dx * r.x + dz * r.z;
    return { s, lateral, segmentIndex: bestI };
  }

  return {
    id: trackId,
    name: track.name,
    palette: track.palette,
    group,
    sample,
    project,
    length,
    halfWidth: ROAD_HALF_WIDTH,
    points,
    tangents,
    controlPoints: track.points
  };
}
