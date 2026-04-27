import * as THREE from "three";

// Lightweight 3D rival cars. Each rival follows the track at a target speed,
// holds a small lateral lane offset, and dodges nearby rivals + the player.
//
// Each rival drives along arclength `s` (0..track.length). Lateral offset comes from
// `homeLane` (varied per rival) blended with `dodge` (when there's traffic ahead).

const RIVAL_PALETTES = [
  { body: 0xff315c, stripe: 0xffd166 },
  { body: 0x2ee9ff, stripe: 0xfbfdff },
  { body: 0xffe156, stripe: 0x101525 },
  { body: 0xa66cff, stripe: 0xfbfdff },
  { body: 0xfbfdff, stripe: 0xff315c },
  { body: 0x3cff9b, stripe: 0x101525 },
  { body: 0xff8f1f, stripe: 0xfbfdff },
  { body: 0xff61b6, stripe: 0x101525 }
];

const NAMES = ["Rina", "Mako", "Ren", "Kai", "Jun", "Sora", "Noa", "Aki"];

function makeRivalMesh(palette) {
  const group = new THREE.Group();
  // Body
  const bodyGeo = new THREE.BoxGeometry(1.7, 0.6, 3.6);
  const bodyMat = new THREE.MeshStandardMaterial({ color: palette.body, metalness: 0.4, roughness: 0.5 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.6;
  group.add(body);
  // Cabin
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x121828, metalness: 0.2, roughness: 0.3 });
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.5, 1.7), cabinMat);
  cabin.position.set(0, 1.05, -0.1);
  group.add(cabin);
  // Glass
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x2ee9ff, metalness: 0.0, roughness: 0.1, transparent: true, opacity: 0.32 });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.40, 0.46, 1.6), glassMat);
  glass.position.set(0, 1.07, -0.1);
  group.add(glass);
  // Stripe
  const stripeMat = new THREE.MeshStandardMaterial({ color: palette.stripe, metalness: 0.1, roughness: 0.4 });
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.62, 3.62), stripeMat);
  stripe.position.y = 0.6;
  group.add(stripe);
  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0e18, roughness: 0.9 });
  const wheelPositions = [
    [-0.88, 0.36,  1.25],
    [ 0.88, 0.36,  1.25],
    [-0.88, 0.36, -1.25],
    [ 0.88, 0.36, -1.25]
  ];
  for (const [x, y, z] of wheelPositions) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, y, z);
    group.add(w);
  }
  // Tail lights
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff315c });
  for (const side of [-1, 1]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.08), tailMat);
    tail.position.set(side * 0.5, 0.62, -1.82);
    group.add(tail);
  }
  return group;
}

export function createRivals(track, count = 8) {
  const rivals = [];
  for (let i = 0; i < count; i++) {
    const palette = RIVAL_PALETTES[i % RIVAL_PALETTES.length];
    const mesh = makeRivalMesh(palette);
    // Lane offset varies per rival from -4.5 to +4.5 m.
    const homeLane = ((i % 5) - 2) * 1.6;
    rivals.push({
      name: NAMES[i % NAMES.length],
      mesh,
      // Stagger starting arclength so they spread across the grid.
      s: -((i + 1) * 14),
      lane: homeLane,
      homeLane,
      // Target speed varied per rival.
      targetSpeed: 28 + Math.random() * 16,  // 28-44 m/s
      speed: 0,
      laps: 0,
      heading: 0
    });
  }
  return rivals;
}

export function tickRivals(rivals, dt, track, playerCar) {
  const trackLen = track.length;
  for (let i = 0; i < rivals.length; i++) {
    const r = rivals[i];

    // ---- Steering: blend homeLane with dodge if traffic ahead ----
    let dodge = 0;
    let blockerSpeed = null;
    // Look ahead 25m for blockers.
    for (let j = 0; j < rivals.length; j++) {
      if (j === i) continue;
      const other = rivals[j];
      let ds = other.s - r.s;
      if (ds < -trackLen * 0.5) ds += trackLen;
      if (ds < 0 || ds > 25) continue;
      if (Math.abs(other.lane - r.lane) < 1.4) {
        dodge = (other.lane >= 0 ? -1 : 1) * 1.6;
        if (blockerSpeed == null || other.speed < blockerSpeed) blockerSpeed = other.speed;
      }
    }
    // Also dodge the player if they're ahead and in our lane.
    if (playerCar && track) {
      const proj = track.project(playerCar.group.position);
      let dsP = proj.s - r.s;
      if (dsP < -trackLen * 0.5) dsP += trackLen;
      if (dsP > 0 && dsP < 22 && Math.abs(proj.lateral - r.lane) < 1.4) {
        dodge = (proj.lateral >= 0 ? -1 : 1) * 1.6;
      }
    }
    const targetLane = Math.max(-5, Math.min(5, r.homeLane + dodge));
    r.lane += (targetLane - r.lane) * Math.min(1, dt * 2);

    // ---- Pace: target speed minus traffic / corner drag ----
    // Sample upcoming curvature 5 segments ahead to slow into corners.
    const futureT = ((r.s / trackLen) + 0.005) % 1;
    const here = track.sample(r.s / trackLen);
    const future = track.sample(futureT);
    const curveSeverity = Math.abs(angularDelta(here.tangentAngle, future.tangentAngle));
    const cornerDrag = Math.min(0.35, curveSeverity * 4.0);
    let pace = r.targetSpeed * (1 - cornerDrag);
    if (blockerSpeed != null) pace = Math.min(pace, blockerSpeed * 0.96);
    r.speed += (pace - r.speed) * Math.min(1, dt * 1.8);

    // Advance arclength.
    const oldS = r.s;
    r.s = (r.s + r.speed * dt) % trackLen;
    if (r.s < oldS - trackLen * 0.5) r.laps++;

    // Place mesh on the track at (s, lane).
    const tParam = ((r.s % trackLen) + trackLen) % trackLen / trackLen;
    const pt = track.sample(tParam);
    // Compute lateral offset in world space.
    const tangentX = Math.sin(pt.tangentAngle);
    const tangentZ = Math.cos(pt.tangentAngle);
    // Right vector = tangent × up = (tx, 0, tz) × (0, 1, 0) = (-tz, 0, tx) but in our "negative-cos forward" convention we want:
    const rightX = -tangentZ;
    const rightZ = tangentX;
    r.mesh.position.set(
      pt.x + rightX * r.lane,
      pt.y + 0.4,
      pt.z + rightZ * r.lane
    );
    r.heading = pt.tangentAngle;
    r.mesh.rotation.set(0, r.heading, 0);
  }
}

function angularDelta(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
