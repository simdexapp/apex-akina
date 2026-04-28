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

// Boss rivals — special named drivers reserved for career-mode hard cups.
// Higher base pace, signature liveries, and a `boss: true` flag so the UI
// can mark them out (HP bar gold, name pill brighter).
export const BOSS_VARIANTS = [
  { name: "AKAGI ACE",   body: 0xff0033, stripe: 0xfbfdff, w: 1.98, h: 0.55, l: 4.45, spoiler: "wing", boss: true, basePace: 88 },
  { name: "NEON KING",   body: 0x9f00ff, stripe: 0x4ce8ff, w: 2.02, h: 0.46, l: 4.55, spoiler: "deck", boss: true, basePace: 90 },
  { name: "DAIKOKU GOD", body: 0x141828, stripe: 0xff315c, w: 2.10, h: 0.54, l: 4.75, spoiler: "wing", boss: true, basePace: 86 }
];

function makeRivalMesh(variant) {
  const group = new THREE.Group();
  // Apply sleek-JDM proportions: lower stance, wider stance.
  const w = variant.w * 1.05;
  const h = variant.h * 0.74;
  const l = variant.l * 1.04;
  // Body
  const bodyGeo = new THREE.BoxGeometry(w, h, l * 0.94);
  const bodyMat = new THREE.MeshStandardMaterial({ color: variant.body, metalness: 0.4, roughness: 0.5 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.set(0, h * 0.85, -l * 0.03);
  group.add(body);
  // Sloped cabin (more aggressive rake to match sleek style)
  const cabinW = w * 0.82, cabinH = h * 0.78, cabinL = l * 0.44;
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x101729, metalness: 0.25, roughness: 0.3 });
  const cabin = new THREE.Mesh(buildSlopedCabin(cabinW, cabinH, cabinL, -l * 0.04, 0.45, 0.35), cabinMat);
  cabin.position.y = h * 0.85 + h * 0.5 - 0.05;
  group.add(cabin);
  // Glass
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x2ee9ff, metalness: 0.0, roughness: 0.1, transparent: true, opacity: 0.36 });
  const glass = new THREE.Mesh(buildSlopedCabin(cabinW * 0.96, cabinH * 0.94, cabinL * 0.96, -l * 0.04, 0.45, 0.35), glassMat);
  glass.position.copy(cabin.position);
  glass.position.y += 0.02;
  group.add(glass);
  // Nose wedge
  const nose = new THREE.Mesh(buildNoseWedge(w * 0.96, h * 0.55, l * 0.22), bodyMat);
  nose.position.set(0, h * 0.40, l * 0.40);
  group.add(nose);
  // Front splitter
  const splitter = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.94, 0.04, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x0a0d18, metalness: 0.4, roughness: 0.6 })
  );
  splitter.position.set(0, h * 0.16, l * 0.50);
  group.add(splitter);
  // Side skirts
  const skirtMat = new THREE.MeshStandardMaterial({ color: 0x0a0d18, metalness: 0.3, roughness: 0.6 });
  for (const side of [-1, 1]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, l * 0.62), skirtMat);
    skirt.position.set(side * w * 0.50, h * 0.20, 0);
    group.add(skirt);
  }
  // Side mirrors (smaller, pulled in)
  for (const side of [-1, 1]) {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.10), bodyMat);
    mirror.position.set(side * (cabinW * 0.5 + 0.05), cabin.position.y + cabinH * 0.45, -l * 0.04 + cabinL * 0.32);
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
  // Tail lights — match player's full-width LED bar look.
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff315c });
  for (const side of [-1, 1]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.11, 0.08), tailMat);
    tail.position.set(side * w * 0.30, 0.62, -l * 0.50);
    group.add(tail);
  }
  const ledBar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, 0.04, 0.05), tailMat);
  ledBar.position.set(0, 0.62, -l * 0.50);
  group.add(ledBar);

  // HP bar — small backing + foreground that scales with HP. Hidden when
  // HP is full (>= 80). Stored in userData so tickRivals can update it.
  const hpBg = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 0.18),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthTest: false })
  );
  hpBg.position.set(0, h + 1.0, 0);
  hpBg.renderOrder = 999;
  hpBg.visible = false;
  group.add(hpBg);
  const hpFill = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.10),
    new THREE.MeshBasicMaterial({ color: 0x4adf80, depthTest: false })
  );
  hpFill.position.set(0, h + 1.0, 0.001);
  hpFill.renderOrder = 1000;
  hpFill.visible = false;
  group.add(hpFill);
  group.userData.hpBg = hpBg;
  group.userData.hpFill = hpFill;
  group.userData.hpFillBaseW = 1.5;

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

export function createRivals(track, count = 14, opts = {}) {
  const rivals = [];
  const bossVariant = opts.boss ? BOSS_VARIANTS[opts.boss] : null;
  for (let i = 0; i < count; i++) {
    // Boss takes slot 0 (front of grid) when present.
    const variant = (i === 0 && bossVariant) ? bossVariant : RIVAL_VARIANTS[i % RIVAL_VARIANTS.length];
    const personality = PERSONALITIES[i % PERSONALITIES.length];
    const mesh = makeRivalMesh(variant);
    // Grid placement.
    const row = Math.floor(i / 2) + 1;
    const col = i % 2 === 0 ? -1 : 1;
    const gridS = -row * ROW_SPACING;
    const gridLane = col * COL_OFFSET;
    const homeLane = ((i % 5) - 2) * 1.6;
    const isBoss = !!variant.boss;
    rivals.push({
      name: variant.name,
      mesh,
      personality,
      isBoss,
      s: gridS,
      lane: gridLane,
      homeLane,
      targetSpeed: isBoss ? variant.basePace + Math.random() * 4
                  : i < 4 ? 78 + Math.random() * 6
                  : i < 9 ? 70 + Math.random() * 6
                  : 60 + Math.random() * 6,
      baseTargetSpeed: 0,
      speed: 0,
      laps: 0,
      heading: 0,
      hp: isBoss ? 140 : 100,    // bosses take more hits to kill
      crashedT: 0,
      crashSpinV: 0
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
  // Project player position once per tick.
  const playerProj = (playerCar && track) ? track.project(playerCar.group.position) : null;

  for (let i = 0; i < rivals.length; i++) {
    const r = rivals[i];

    // ---- Pace + cornering: racing-line aware ----
    // Sample upcoming curvature at multiple look-aheads. The SIGNED curve
    // value tells us which way the corner bends, so we can target the
    // proper apex line (out-in-out): swing wide on entry, hug inside at apex,
    // exit wide.
    const sampleS = Math.max(0, r.s);
    const t0 = sampleS / trackLen;
    const here = track.sample(t0);
    const a1 = track.sample((t0 + 0.005) % 1);
    const a2 = track.sample((t0 + 0.015) % 1);
    const a3 = track.sample((t0 + 0.030) % 1);
    const c1signed = angularDelta(here.tangentAngle, a1.tangentAngle);
    const c2signed = angularDelta(here.tangentAngle, a2.tangentAngle);
    const c3signed = angularDelta(here.tangentAngle, a3.tangentAngle);
    const c1 = Math.abs(c1signed);
    const c2 = Math.abs(c2signed);
    const c3 = Math.abs(c3signed);
    const curveSeverity = Math.max(c1, c2 * 0.8, c3 * 0.6);
    const cornerDrag = Math.min(0.55, curveSeverity * 6.0);

    // Racing-line target lane: positive = right, negative = left.
    // Heuristic — apex on the inside of the upcoming turn; entry wide on the
    // outside; exit wide on the outside again.
    // c2signed > 0 means upcoming turn bends right → apex is right (positive).
    // The current lateral curvature c1signed tells us if we're IN a corner now.
    let racingLine = r.homeLane;
    if (curveSeverity > 0.012) {
      // We're approaching/in a corner. Bias lane toward outside on entry,
      // inside at apex (max curvature ahead now), outside on exit.
      const inApex = c1 > c2 * 0.8;       // current curve >= upcoming curve = at/just past apex
      const turnSign = Math.sign(c2signed || c1signed || 1);  // +1 right turn, -1 left turn
      if (inApex) {
        // Apex/exit phase — drift to the outside of the turn (opposite of turnSign).
        racingLine = -turnSign * 3.2;
      } else {
        // Entry phase — drive on the outside before the apex.
        racingLine = -turnSign * 4.0;
      }
    }

    // ---- Traffic awareness: scan ahead for slower cars + plan overtake ----
    let blockerSpeed = null;
    let blockerLane = null;
    let blockerDist = Infinity;
    let dodge = 0;
    for (let j = 0; j < rivals.length; j++) {
      if (j === i) continue;
      const other = rivals[j];
      let ds = other.s - r.s;
      if (ds < -trackLen * 0.5) ds += trackLen;
      // Look 30m ahead, with a tighter lane band to detect "in my line".
      if (ds < 0 || ds > 30) continue;
      const laneGap = Math.abs(other.lane - r.lane);
      // Closer cars matter more — early-warning on traffic 10-30m out.
      if (laneGap < 1.6 && ds < blockerDist) {
        blockerDist = ds;
        blockerSpeed = other.speed;
        blockerLane = other.lane;
      }
    }
    // Player is also traffic.
    if (playerProj) {
      let dsP = playerProj.s - r.s;
      if (dsP < -trackLen * 0.5) dsP += trackLen;
      if (dsP > 0 && dsP < 30 && Math.abs(playerProj.lateral - r.lane) < 1.6) {
        if (dsP < blockerDist) {
          blockerDist = dsP;
          blockerSpeed = playerCar.speed;
          blockerLane = playerProj.lateral;
        }
      }
    }
    // If there's traffic ahead, plan overtake: pick the side with more room.
    if (blockerLane != null && blockerDist < 25) {
      // Choose which side to dive to. Prefer the side AWAY from blocker's lane.
      const overtakeSide = blockerLane >= 0 ? -1 : 1;
      // Commitment scales with how close we are.
      const commit = Math.max(0.4, 1.0 - blockerDist / 25);
      dodge = overtakeSide * 3.6 * commit;
    }

    // ---- Defending: if a car is RIGHT BEHIND us, weave slightly to defend ----
    let defenderUrge = 0;
    for (let j = 0; j < rivals.length; j++) {
      if (j === i) continue;
      const other = rivals[j];
      let ds = r.s - other.s;
      if (ds < -trackLen * 0.5) ds += trackLen;
      if (ds < 0 || ds > 8) continue;
      // Closing speed > 4 m/s means they're an actual threat.
      if (other.speed - r.speed > 4) {
        // Personality: aggressive drivers actually defend, smooth ones don't.
        const pBlock = (r.personality?.blockChance ?? 0.3);
        if (pBlock > 0.4) defenderUrge = Math.sign(other.lane - r.lane) * -1.2;
      }
    }
    if (playerProj) {
      let dsB = r.s - playerProj.s;
      if (dsB < -trackLen * 0.5) dsB += trackLen;
      if (dsB > 0 && dsB < 8 && playerCar.speed - r.speed > 4) {
        const pBlock = (r.personality?.blockChance ?? 0.3);
        if (pBlock > 0.4) defenderUrge = Math.sign(playerProj.lateral - r.lane) * -1.2;
      }
    }

    // Combined target lane: racing line + overtake dodge + defender weave.
    // Clamp to track halfWidth so AI doesn't drive into barriers.
    const halfW = (track.halfWidth || 7) - 0.5;
    const targetLane = Math.max(-halfW, Math.min(halfW, racingLine + dodge + defenderUrge));
    r.lane += (targetLane - r.lane) * Math.min(1, dt * 2.4);

    // ---- Pace ----
    let pace = r.targetSpeed * (1 - cornerDrag);
    // If blocker is significantly slower AND we can't easily pass (no room),
    // tuck in their slipstream — slow to 96% of their speed for a draft setup.
    if (blockerSpeed != null && blockerSpeed < r.targetSpeed * 0.95 && Math.abs(dodge) < 1.0) {
      pace = Math.min(pace, blockerSpeed * 0.96);
    }
    // If we're committing to an overtake with room, take full pace.
    // (no extra slowdown from blocker)
    // Health-based pace dampener. Below 50% HP rival drives 30% slower; below
    // 20% it crawls and weaves. Hp recovers 4/sec when not crashed.
    const personality = r.personality || PERSONALITIES[0];
    if (r.crashedT > 0) {
      r.crashedT = Math.max(0, r.crashedT - dt);
      r.hp = Math.min(100, (r.hp || 0) + dt * 4);   // slow recovery while crashed
    } else {
      r.hp = Math.min(100, (r.hp || 100) + dt * 6); // fast passive heal
    }
    let hpMul = 1.0;
    if (r.hp < 20) hpMul = 0.42;
    else if (r.hp < 50) hpMul = 0.7;
    else if (r.hp < 80) hpMul = 0.92;
    pace *= hpMul;
    // Approaching a sharp upcoming turn? Brake harder than steady drag.
    const brakeUrgency = Math.min(1, c2 * 12.0);
    const brakeThreshold = 0.55 / personality.brakeBoldness;
    if (brakeUrgency > brakeThreshold && r.speed > pace) {
      r.speed -= dt * 18 * brakeUrgency;
    }
    // Lane jitter — wildcards weave a bit. Crashed rivals weave more.
    const jitter = personality.laneJitter * (r.crashedT > 0 ? 2.5 : 1);
    r.lane += Math.sin(performance.now() * 0.001 + r.s * 0.05) * jitter * dt * 0.4;
    r.speed += (pace - r.speed) * Math.min(1, dt * 2.4);

    // Crash visual: wobble the mesh slightly while recovering.
    if (r.crashedT > 0 && r.mesh) {
      const wobble = Math.sin(performance.now() * 0.018) * 0.10 * (r.crashedT / 1.5);
      r.mesh.rotation.z = wobble;
    } else if (r.mesh) {
      r.mesh.rotation.z = 0;
    }
    // HP bar: visible when damaged. Color: green > 60, gold > 30, red < 30.
    const hpBg = r.mesh?.userData?.hpBg;
    const hpFill = r.mesh?.userData?.hpFill;
    if (hpBg && hpFill) {
      const damaged = (r.hp ?? 100) < 80;
      hpBg.visible = damaged;
      hpFill.visible = damaged;
      if (damaged) {
        const frac = Math.max(0, Math.min(1, (r.hp || 0) / 100));
        const baseW = r.mesh.userData.hpFillBaseW;
        hpFill.scale.x = frac;
        hpFill.position.x = -(baseW * (1 - frac)) / 2;   // anchor left
        const col = frac > 0.6 ? 0x4adf80 : (frac > 0.3 ? 0xffd166 : 0xff315c);
        hpFill.material.color.setHex(col);
      }
    }

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
