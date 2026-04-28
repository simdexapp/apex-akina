import * as THREE from "three";
import { TRACKS } from "./tracks-data.js";

const ROAD_HALF_WIDTH = 7;
const SHOULDER = 1.0;
const SAMPLES = 480;

export function getTrackList() {
  return Object.entries(TRACKS).map(([id, t]) => ({ id, name: t.name, description: t.description, palette: t.palette }));
}

export function buildTrack(trackId = "lakeside") {
  const track = TRACKS[trackId] || TRACKS.lakeside;
  const curve = new THREE.CatmullRomCurve3(track.points, true, "catmullrom", 0.4);
  const points = curve.getSpacedPoints(SAMPLES);
  const tangents = [];
  for (let i = 0; i < SAMPLES; i++) {
    tangents.push(curve.getTangent(i / SAMPLES).normalize());
  }

  // Build a ribbon mesh by extruding a width vector perpendicular to each tangent.
  const positions = [];
  const colors = [];
  const indices = [];
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3();
  // Brighter asphalt — lighter base + alternating darker stripe so the road
  // surface visibly streaks past the player, instead of being a uniform black.
  const innerColor = new THREE.Color("#3a3f4f");
  const altColor = new THREE.Color("#2a2e3c");
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
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    metalness: 0.20,
    roughness: 0.62,
    emissive: 0x0a0c14,
    emissiveIntensity: 0.4
  });
  const roadMesh = new THREE.Mesh(geo, mat);

  // Lane lines — proper emissive boxes (visible regardless of `linewidth`,
  // which most browsers ignore). Center line is gold, side lines white.
  const laneGroup = new THREE.Group();
  const laneCount = 5;
  for (let lane = 1; lane < laneCount; lane++) {
    const offset = -ROAD_HALF_WIDTH + (ROAD_HALF_WIDTH * 2) * (lane / laneCount);
    const isCenter = lane === Math.floor(laneCount / 2);
    const color = isCenter ? 0xffe88a : 0xfbfdff;
    const dashLen = 3.0;
    const gapLen = 4.0;
    let acc = 0;
    let drawing = true;
    for (let i = 0; i < SAMPLES; i++) {
      const p = points[i];
      const next = points[(i + 1) % SAMPLES];
      const seg = p.distanceTo(next);
      acc += seg;
      const limit = drawing ? dashLen : gapLen;
      if (acc >= limit) {
        if (drawing) {
          // Draw a small box at this segment.
          const t = tangents[i];
          right.crossVectors(t, up).normalize();
          const stripe = new THREE.Mesh(
            new THREE.BoxGeometry(0.16, 0.06, dashLen * 0.9),
            new THREE.MeshBasicMaterial({ color })
          );
          stripe.position.set(p.x + right.x * offset, p.y + 0.04, p.z + right.z * offset);
          stripe.rotation.y = Math.atan2(t.x, t.z);
          laneGroup.add(stripe);
        }
        drawing = !drawing;
        acc = 0;
      }
    }
  }

  // Kerb stripes — alternating red/white at the road edge.
  const kerbGroup = new THREE.Group();
  for (let i = 0; i < SAMPLES; i++) {
    const p = points[i];
    const t = tangents[i];
    right.crossVectors(t, up).normalize();
    for (const side of [1, -1]) {
      const offset = side * (ROAD_HALF_WIDTH + SHOULDER * 0.5);
      const cubeGeo = new THREE.BoxGeometry(0.6, 0.10, 1.4);
      const color = i % 2 === 0 ? track.palette.kerbA : track.palette.kerbB;
      const cubeMat = new THREE.MeshStandardMaterial({ color, metalness: 0.20, roughness: 0.55 });
      const cube = new THREE.Mesh(cubeGeo, cubeMat);
      cube.position.set(p.x + right.x * offset, p.y + 0.05, p.z + right.z * offset);
      cube.rotation.y = Math.atan2(t.x, t.z);
      kerbGroup.add(cube);
    }
  }

  // Ground plane below the track. Closer to road level + emissive base so it
  // doesn't read as black at the horizon.
  const groundGeo = new THREE.PlaneGeometry(2400, 2400, 32, 32);
  const groundMat = new THREE.MeshStandardMaterial({
    color: track.palette.ground,
    metalness: 0.0,
    roughness: 0.92,
    emissive: track.palette.ground,
    emissiveIntensity: 0.18
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2.2;

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

  // Trackside posts — denser + tall lamp posts with point lights every 24 samples.
  const postGroup = new THREE.Group();
  const postMatShared = new THREE.MeshLambertMaterial({ color: 0x0c1322 });
  const armMat = new THREE.MeshLambertMaterial({ color: 0x1a2030 });
  const headMatRight = new THREE.MeshBasicMaterial({ color: 0xfff5d4 });
  const headMatLeft = new THREE.MeshBasicMaterial({ color: 0xffe9c4 });
  const capMatRight = new THREE.MeshBasicMaterial({ color: 0x2ee9ff });
  const capMatLeft = new THREE.MeshBasicMaterial({ color: 0xffd166 });
  for (let i = 0; i < SAMPLES; i += 4) {
    const p = points[i];
    const t = tangents[i];
    right.crossVectors(t, up).normalize();
    const isLamp = i % 24 === 0;
    for (const side of [1, -1]) {
      const offset = side * (ROAD_HALF_WIDTH + SHOULDER + 1.6);
      const px = p.x + right.x * offset;
      const pz = p.z + right.z * offset;
      const postH = isLamp ? 4.6 : 1.6;
      const postGeo = new THREE.BoxGeometry(0.2, postH, 0.2);
      const post = new THREE.Mesh(postGeo, postMatShared);
      post.position.set(px, p.y + postH * 0.5, pz);
      postGroup.add(post);
      if (isLamp) {
        // Curved arm reaching over the road.
        const armLen = 2.2;
        const armGeo = new THREE.BoxGeometry(0.12, 0.12, armLen);
        const arm = new THREE.Mesh(armGeo, armMat);
        const armX = px - right.x * side * armLen * 0.5;
        const armZ = pz - right.z * side * armLen * 0.5;
        arm.position.set(armX, p.y + postH - 0.1, armZ);
        arm.rotation.y = Math.atan2(right.x, right.z);
        postGroup.add(arm);
        // Lamp head emissive box.
        const headX = px - right.x * side * armLen;
        const headZ = pz - right.z * side * armLen;
        const headGeo = new THREE.BoxGeometry(0.45, 0.18, 0.45);
        const head = new THREE.Mesh(headGeo, side > 0 ? headMatRight : headMatLeft);
        head.position.set(headX, p.y + postH - 0.16, headZ);
        postGroup.add(head);
        // Point light to actually illuminate the road below.
        const lampLight = new THREE.PointLight(side > 0 ? 0xfff5d4 : 0xffe9c4, 1.3, 18, 1.6);
        lampLight.position.set(headX, p.y + postH - 0.5, headZ);
        postGroup.add(lampLight);
      } else {
        // Reflective top cap on shorter posts.
        const capGeo = new THREE.BoxGeometry(0.22, 0.06, 0.22);
        const cap = new THREE.Mesh(capGeo, side > 0 ? capMatRight : capMatLeft);
        cap.position.set(px, p.y + 1.65, pz);
        postGroup.add(cap);
      }
    }
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
  const startGroup = new THREE.Group();
  {
    const start = points[0];
    const startTangent = tangents[0];
    right.crossVectors(startTangent, up).normalize();
    const yaw = Math.atan2(startTangent.x, startTangent.z);
    const lineWidth = 1.6;
    const TILES = 12;
    for (let i = 0; i < TILES; i++) {
      const t = (i / TILES - 0.5) * (ROAD_HALF_WIDTH * 2);
      const tile = new THREE.Mesh(
        new THREE.BoxGeometry((ROAD_HALF_WIDTH * 2) / TILES, 0.04, lineWidth),
        new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0xfbfdff : 0x05070d })
      );
      tile.position.set(start.x + right.x * t, start.y + 0.06, start.z + right.z * t);
      tile.rotation.y = yaw;
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
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(ROAD_HALF_WIDTH * 2 + 4, 0.8, 0.12),
      new THREE.MeshBasicMaterial({ color: 0xff315c })
    );
    banner.position.set(start.x, start.y + 5.6, start.z);
    banner.rotation.y = yaw;
    startGroup.add(banner);
  }

  // Sector markers — three diagonal lines at 1/3, 2/3 and 1 of arclength.
  const sectorGroup = new THREE.Group();
  for (let s = 1; s <= 3; s++) {
    const idx = Math.floor((s / 3) * SAMPLES) % SAMPLES;
    const p = points[idx];
    const t = tangents[idx];
    right.crossVectors(t, up).normalize();
    const yaw = Math.atan2(t.x, t.z);
    const sectorMat = new THREE.MeshBasicMaterial({ color: s === 3 ? 0xfbfdff : 0xffd166 });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(ROAD_HALF_WIDTH * 2, 0.04, 0.4), sectorMat);
    stripe.position.set(p.x, p.y + 0.06, p.z);
    stripe.rotation.y = yaw;
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
