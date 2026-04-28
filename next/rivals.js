import * as THREE from "three";
import { buildSlopedCabin, buildNoseWedge } from "./car.js";

// Lightweight 3D rival cars. Each rival follows the track at a target speed,
// holds a small lateral lane offset, and dodges nearby rivals + the player.
//
// Each rival drives along arclength `s` (0..track.length). Lateral offset comes from
// `homeLane` (varied per rival) blended with `dodge` (when there's traffic ahead).

// Each entry has its own livery + body proportions so rivals look distinct.
const RIVAL_VARIANTS = [
  { name: "Rina",  body: 0xff315c, stripe: 0xffd166, w: 1.85, h: 0.80, l: 4.20, spoiler: "wing" },
  { name: "Mako",  body: 0x2ee9ff, stripe: 0xfbfdff, w: 1.95, h: 0.55, l: 4.40, spoiler: "deck" },
  { name: "Ren",   body: 0xffe156, stripe: 0x101525, w: 1.70, h: 0.75, l: 3.80, spoiler: "lip" },
  { name: "Kai",   body: 0xa66cff, stripe: 0xfbfdff, w: 1.95, h: 0.55, l: 4.40, spoiler: "deck" },
  { name: "Jun",   body: 0xfbfdff, stripe: 0xff315c, w: 1.78, h: 0.72, l: 3.95, spoiler: "ducktail" },
  { name: "Sora",  body: 0x3cff9b, stripe: 0x101525, w: 1.70, h: 0.75, l: 3.80, spoiler: "lip" },
  { name: "Noa",   body: 0xff8f1f, stripe: 0xfbfdff, w: 1.85, h: 0.80, l: 4.20, spoiler: "wing" },
  { name: "Aki",   body: 0xff61b6, stripe: 0x101525, w: 1.78, h: 0.72, l: 3.95, spoiler: "ducktail" },
  { name: "Tomo",  body: 0x1aa6ff, stripe: 0xffd166, w: 1.80, h: 0.70, l: 4.00, spoiler: "ducktail" },
  { name: "Yuki",  body: 0xcaff5e, stripe: 0x101525, w: 1.55, h: 0.85, l: 3.40, spoiler: null },
  { name: "Saki",  body: 0x5b6dff, stripe: 0xfbfdff, w: 1.85, h: 0.80, l: 4.20, spoiler: "wing" },
  { name: "Riku",  body: 0xff7e1a, stripe: 0x101525, w: 1.70, h: 0.75, l: 3.80, spoiler: "lip" },
  { name: "Hina",  body: 0xfbfdff, stripe: 0xff315c, w: 1.55, h: 0.85, l: 3.40, spoiler: null },
  { name: "Daichi",body: 0x0d2240, stripe: 0x2ee9ff, w: 1.80, h: 0.70, l: 4.00, spoiler: "ducktail" }
];

function makeRivalMesh(variant) {
  const group = new THREE.Group();
  const w = variant.w, h = variant.h, l = variant.l;
  // Body
  const bodyGeo = new THREE.BoxGeometry(w, h, l * 0.94);
  const bodyMat = new THREE.MeshStandardMaterial({ color: variant.body, metalness: 0.4, roughness: 0.5 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.set(0, h * 0.85, -l * 0.03);
  group.add(body);
  // Sloped cabin
  const cabinW = w * 0.84, cabinH = h * 0.85, cabinL = l * 0.46;
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x101729, metalness: 0.25, roughness: 0.3 });
  const cabin = new THREE.Mesh(buildSlopedCabin(cabinW, cabinH, cabinL, -l * 0.04), cabinMat);
  cabin.position.y = h * 0.85 + h * 0.5 - 0.05;
  group.add(cabin);
  // Glass
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x2ee9ff, metalness: 0.0, roughness: 0.1, transparent: true, opacity: 0.36 });
  const glass = new THREE.Mesh(buildSlopedCabin(cabinW * 0.96, cabinH * 0.94, cabinL * 0.96, -l * 0.04), glassMat);
  glass.position.copy(cabin.position);
  glass.position.y += 0.02;
  group.add(glass);
  // Nose wedge
  const nose = new THREE.Mesh(buildNoseWedge(w * 0.96, h * 0.6, l * 0.22), bodyMat);
  nose.position.set(0, h * 0.45, l * 0.40);
  group.add(nose);
  // Side mirrors
  for (const side of [-1, 1]) {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.10, 0.14), bodyMat);
    mirror.position.set(side * (cabinW * 0.5 + 0.06), cabin.position.y + cabinH * 0.45, -l * 0.04 + cabinL * 0.32);
    group.add(mirror);
  }
  // Stripe
  const stripeMat = new THREE.MeshStandardMaterial({ color: variant.stripe, metalness: 0.1, roughness: 0.4 });
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.30, h + 0.02, l + 0.02), stripeMat);
  stripe.position.y = h * 0.85;
  group.add(stripe);
  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0e18, roughness: 0.9 });
  const wx = w * 0.5 - 0.06;
  const wzF = l * 0.36;
  const wzR = -l * 0.36;
  for (const [px, pz] of [[-wx, wzF], [wx, wzF], [-wx, wzR], [wx, wzR]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(px, 0.36, pz);
    group.add(wheel);
  }
  // Spoiler per variant.
  if (variant.spoiler === "wing") {
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x10131e });
    const wing = new THREE.Mesh(new THREE.BoxGeometry(w * 0.95, 0.06, 0.30), wingMat);
    wing.position.set(0, h * 0.85 + h * 0.5 + 0.50, -l * 0.42);
    group.add(wing);
    for (const side of [-1, 1]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.46, 0.10), wingMat);
      r.position.set(side * w * 0.32, h * 0.85 + h * 0.5 + 0.27, -l * 0.42);
      group.add(r);
    }
  } else if (variant.spoiler === "ducktail") {
    const tailMat = new THREE.MeshStandardMaterial({ color: variant.body, metalness: 0.4 });
    const tail = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, 0.10, 0.32), tailMat);
    tail.position.set(0, h * 0.85 + h * 0.55, -l * 0.40);
    group.add(tail);
  } else if (variant.spoiler === "deck") {
    const tailMat = new THREE.MeshStandardMaterial({ color: 0x10131e });
    const tail = new THREE.Mesh(new THREE.BoxGeometry(w * 0.95, 0.06, 0.18), tailMat);
    tail.position.set(0, h * 0.85 + h * 0.5 + 0.10, -l * 0.46);
    group.add(tail);
  } else if (variant.spoiler === "lip") {
    const lipMat = new THREE.MeshStandardMaterial({ color: 0x0a0d18 });
    const lip = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, 0.05, 0.20), lipMat);
    lip.position.set(0, h * 0.18, -l * 0.44);
    group.add(lip);
  }
  // Tail lights
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff315c });
  for (const side of [-1, 1]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.08), tailMat);
    tail.position.set(side * w * 0.30, 0.62, -l * 0.50);
    group.add(tail);
  }
  return group;
}

// F1-style grid: player at pole (s=0, lane=0). Rivals fill 7 rows of 2 behind,
// staggered laterally ±3m and longitudinally ROW_SPACING metres apart.
const ROW_SPACING = 6;
const COL_OFFSET = 3;

// AI personality archetypes. Each affects how aggressively the rival defends
// position, how late they brake, and how often they take wide racing lines.
const PERSONALITIES = [
  { id: "aggressive",  brakeBoldness: 1.20, blockChance: 0.65, laneJitter: 0.40, paceVariance: 0.05 },
  { id: "smooth",      brakeBoldness: 0.90, blockChance: 0.20, laneJitter: 0.10, paceVariance: 0.02 },
  { id: "consistent",  brakeBoldness: 1.00, blockChance: 0.35, laneJitter: 0.18, paceVariance: 0.01 },
  { id: "wildcard",    brakeBoldness: 1.10, blockChance: 0.50, laneJitter: 0.55, paceVariance: 0.10 }
];

export function createRivals(track, count = 14) {
  const rivals = [];
  for (let i = 0; i < count; i++) {
    const variant = RIVAL_VARIANTS[i % RIVAL_VARIANTS.length];
    const personality = PERSONALITIES[i % PERSONALITIES.length];
    const mesh = makeRivalMesh(variant);
    // Grid placement.
    const row = Math.floor(i / 2) + 1;
    const col = i % 2 === 0 ? -1 : 1;
    const gridS = -row * ROW_SPACING;
    const gridLane = col * COL_OFFSET;
    const homeLane = ((i % 5) - 2) * 1.6;
    rivals.push({
      name: variant.name,
      mesh,
      personality,
      s: gridS,
      lane: gridLane,
      homeLane,
      targetSpeed: i < 4 ? 78 + Math.random() * 6
                  : i < 9 ? 70 + Math.random() * 6
                  : 60 + Math.random() * 6,
      baseTargetSpeed: 0,
      speed: 0,
      laps: 0,
      heading: 0
    });
  }
  // Cache the base targetSpeed for rubber-band scaling later.
  for (const r of rivals) r.baseTargetSpeed = r.targetSpeed;
  return rivals;
}

// Resolve a rival pose at arclength `s` and lateral `lane`. When s < 0 we project
// straight backwards from the start point along the start tangent — this gives a
// straight grid even on tracks whose start line sits on a curve.
function resolveRivalPose(track, s, lane) {
  const trackLen = track.length;
  if (s < 0) {
    const start = track.sample(0);
    const tangentX = Math.sin(start.tangentAngle);
    const tangentZ = Math.cos(start.tangentAngle);
    const rightX = -tangentZ;
    const rightZ = tangentX;
    // Walk backwards along the straight line of the start tangent by |s|.
    const x = start.x + tangentX * s + rightX * lane;
    const z = start.z + tangentZ * s + rightZ * lane;
    return { x, y: start.y, z, heading: start.tangentAngle };
  }
  const tParam = ((s % trackLen) + trackLen) % trackLen / trackLen;
  const pt = track.sample(tParam);
  const tangentX = Math.sin(pt.tangentAngle);
  const tangentZ = Math.cos(pt.tangentAngle);
  const rightX = -tangentZ;
  const rightZ = tangentX;
  return {
    x: pt.x + rightX * lane,
    y: pt.y,
    z: pt.z + rightZ * lane,
    heading: pt.tangentAngle
  };
}

// Place each rival's mesh at its current (s, lane). Used to make the grid
// visible before the race ticks, and after a reset.
export function placeRivalsOnGrid(rivals, track) {
  for (const r of rivals) {
    const pose = resolveRivalPose(track, r.s, r.lane);
    r.mesh.position.set(pose.x, pose.y + 0.4, pose.z);
    r.heading = pose.heading;
    r.mesh.rotation.set(0, r.heading, 0);
  }
}

// Difficulty profiles. paceMul scales target speeds; rubberStrength scales
// the rubber-band logic; rubberMode "none" disables rubber-band entirely.
const DIFFICULTY_PROFILES = {
  easy:    { paceMul: 0.88, rubberCatchup: 1.05, rubberEase: 0.85, rubberMode: "soft" },
  normal:  { paceMul: 1.00, rubberCatchup: 1.15, rubberEase: 0.92, rubberMode: "soft" },
  hard:    { paceMul: 1.08, rubberCatchup: 1.22, rubberEase: 0.96, rubberMode: "tight" },
  brutal:  { paceMul: 1.16, rubberCatchup: 1.00, rubberEase: 1.00, rubberMode: "none" }
};

export function tickRivals(rivals, dt, track, playerCar, playerTotal = 0, difficulty = "normal") {
  const trackLen = track.length;
  const prof = DIFFICULTY_PROFILES[difficulty] || DIFFICULTY_PROFILES.normal;
  // Rubber-band: rivals just behind/ahead of the player get a small boost/drag.
  for (const r of rivals) {
    const rivalTotal = (r.laps || 0) * trackLen + r.s;
    const delta = rivalTotal - playerTotal;
    let mul = 1.0;
    if (prof.rubberMode !== "none") {
      if (delta < -120) {
        mul = prof.rubberCatchup;
      } else if (delta > 200) {
        mul = prof.rubberEase;
      }
    }
    r.targetSpeed = r.baseTargetSpeed * mul * prof.paceMul;
  }
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

    // ---- Pace: look-ahead corner braking ----
    // Sample three look-aheads (0.5%, 1.5%, 3% of track) and use the worst
    // curvature to scale braking. Sharper turns trigger heavier slowdown.
    const sampleS = Math.max(0, r.s);
    const t0 = sampleS / trackLen;
    const here = track.sample(t0);
    const a1 = track.sample((t0 + 0.005) % 1);
    const a2 = track.sample((t0 + 0.015) % 1);
    const a3 = track.sample((t0 + 0.030) % 1);
    const c1 = Math.abs(angularDelta(here.tangentAngle, a1.tangentAngle));
    const c2 = Math.abs(angularDelta(here.tangentAngle, a2.tangentAngle));
    const c3 = Math.abs(angularDelta(here.tangentAngle, a3.tangentAngle));
    const curveSeverity = Math.max(c1, c2 * 0.8, c3 * 0.6);
    const cornerDrag = Math.min(0.55, curveSeverity * 6.0);
    let pace = r.targetSpeed * (1 - cornerDrag);
    if (blockerSpeed != null) pace = Math.min(pace, blockerSpeed * 0.96);
    // Approaching a sharp upcoming turn? Brake harder than steady drag.
    // Personality: aggressive drivers brake later (lower urgency threshold).
    const personality = r.personality || PERSONALITIES[0];
    const brakeUrgency = Math.min(1, c2 * 12.0);
    const brakeThreshold = 0.55 / personality.brakeBoldness;
    if (brakeUrgency > brakeThreshold && r.speed > pace) {
      r.speed -= dt * 18 * brakeUrgency;
    }
    // Lane jitter — wildcards weave a bit, smooth drivers hold a tight line.
    r.lane += Math.sin(performance.now() * 0.001 + r.s * 0.05) * personality.laneJitter * dt * 0.4;
    r.speed += (pace - r.speed) * Math.min(1, dt * 2.4);

    // Advance arclength. Don't modulo while still on the negative-s grid —
    // only wrap once the rival has actually crossed the start line and the
    // arclength would exceed track length.
    const oldS = r.s;
    let nextS = r.s + r.speed * dt;
    if (nextS >= trackLen) {
      nextS -= trackLen;
      r.laps++;
    }
    r.s = nextS;

    // Place mesh — use straight-line projection while still on the grid (s < 0),
    // otherwise sample the track centerline. This keeps the formation straight
    // on tracks whose start line is on a curve.
    const pose = resolveRivalPose(track, r.s, r.lane);
    r.mesh.position.set(pose.x, pose.y + 0.4, pose.z);
    r.heading = pose.heading;
    r.mesh.rotation.set(0, r.heading, 0);
  }
}

function angularDelta(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
