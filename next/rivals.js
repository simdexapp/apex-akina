import * as THREE from "three";
import { buildSlopedCabin, buildNoseWedge, buildSleekBody, buildExtrudedCarBody, buildExtrudedGlass } from "./car.js?v=98";

// Lightweight 3D rival cars. Each rival follows the track at a target speed,
// holds a small lateral lane offset, and dodges nearby rivals + the player.
//
// Each rival drives along arclength `s` (0..track.length). Lateral offset comes from
// `homeLane` (varied per rival) blended with `dodge` (when there's traffic ahead).

// Each entry has its own livery + body proportions so rivals look distinct.
// `bio` is a 1-line characterization shown in tooltips/overlays.
const RIVAL_VARIANTS = [
  { name: "Rina",   bio: "Cold-blooded apex hunter. Never lifts.",                 body: 0xff315c, stripe: 0xffd166, w: 1.85, h: 0.80, l: 4.20, spoiler: "wing" },
  { name: "Mako",   bio: "Dad's mechanic, rich-kid attitude.",                     body: 0x2ee9ff, stripe: 0xfbfdff, w: 1.95, h: 0.55, l: 4.40, spoiler: "deck" },
  { name: "Ren",    bio: "Ex-circuit hot lapper turned street.",                   body: 0xffe156, stripe: 0x101525, w: 1.70, h: 0.75, l: 3.80, spoiler: "lip" },
  { name: "Kai",    bio: "Plays it safe until lap 3. Then he doesn't.",            body: 0xa66cff, stripe: 0xfbfdff, w: 1.95, h: 0.55, l: 4.40, spoiler: "deck" },
  { name: "Jun",    bio: "Quiet, methodical, unbeaten in time-trial.",             body: 0xfbfdff, stripe: 0xff315c, w: 1.78, h: 0.72, l: 3.95, spoiler: "ducktail" },
  { name: "Sora",   bio: "Drifts everywhere, even the straights.",                 body: 0x3cff9b, stripe: 0x101525, w: 1.70, h: 0.75, l: 3.80, spoiler: "lip" },
  { name: "Noa",    bio: "Never met a corner she didn't take wide.",               body: 0xff8f1f, stripe: 0xfbfdff, w: 1.85, h: 0.80, l: 4.20, spoiler: "wing" },
  { name: "Aki",    bio: "All gas, no brakes, somehow finishes top 3.",            body: 0xff61b6, stripe: 0x101525, w: 1.78, h: 0.72, l: 3.95, spoiler: "ducktail" },
  { name: "Tomo",   bio: "Calm voice on the radio, fastest on the track.",         body: 0x1aa6ff, stripe: 0xffd166, w: 1.80, h: 0.70, l: 4.00, spoiler: "ducktail" },
  { name: "Yuki",   bio: "Tiny car, terrifying commitment.",                       body: 0xcaff5e, stripe: 0x101525, w: 1.55, h: 0.85, l: 3.40, spoiler: null },
  { name: "Saki",   bio: "Long-haul racer. Always there at the end.",              body: 0x5b6dff, stripe: 0xfbfdff, w: 1.85, h: 0.80, l: 4.20, spoiler: "wing" },
  { name: "Riku",   bio: "Slid sideways into the championship by accident.",       body: 0xff7e1a, stripe: 0x101525, w: 1.70, h: 0.75, l: 3.80, spoiler: "lip" },
  { name: "Hina",   bio: "Three-time runner-up. This year is hers.",               body: 0xfbfdff, stripe: 0xff315c, w: 1.55, h: 0.85, l: 3.40, spoiler: null },
  { name: "Daichi", bio: "Old-school. Will pit-maneuver you and apologize later.", body: 0x0d2240, stripe: 0x2ee9ff, w: 1.80, h: 0.70, l: 4.00, spoiler: "ducktail" }
];

// Boss rivals — special named drivers reserved for career-mode hard cups.
// Higher base pace, signature liveries, and a `boss: true` flag so the UI
// can mark them out (HP bar gold, name pill brighter).
export const BOSS_VARIANTS = [
  {
    name: "AKAGI ACE",
    bio: "Fastest driver to ever come down the pass. Has not lost on Akagi in two seasons.",
    homeTrack: "mountainpass",
    body: 0xff0033, stripe: 0xfbfdff, w: 1.98, h: 0.55, l: 4.45, spoiler: "wing",
    boss: true, basePace: 88
  },
  {
    name: "NEON KING",
    bio: "City prowler. Owns the Neon Highway after dark.",
    homeTrack: "neon",
    body: 0x9f00ff, stripe: 0x4ce8ff, w: 2.02, h: 0.46, l: 4.55, spoiler: "deck",
    boss: true, basePace: 90
  },
  {
    name: "DAIKOKU GOD",
    bio: "Enters every race. Wins half. Smokes after every one.",
    homeTrack: "drift",
    body: 0x141828, stripe: 0xff315c, w: 2.10, h: 0.54, l: 4.75, spoiler: "wing",
    boss: true, basePace: 86
  }
];

function makeRivalMesh(variant) {
  const group = new THREE.Group();
  const w = variant.w * 1.05;
  const h = variant.h * 0.74;
  const l = variant.l * 1.04;
  const bodyH = h * 1.25;
  // Single-extruded body matches the player car style.
  const bodyGeo = buildExtrudedCarBody(w, bodyH, l * 0.96);
  // Match player metalness — body color must read clearly at any distance.
  // envMapIntensity 0.45 means reflections add character but don't swallow
  // the body color into the dark sky.
  const bodyMat = new THREE.MeshStandardMaterial({ color: variant.body, metalness: 0.30, roughness: 0.42, envMapIntensity: 0.45 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.set(0, bodyH * 0.5 + 0.05, 0);
  body.userData.shadowCast = true;
  group.add(body);
  // Ground contact shadow — soft radial ellipse below the car.
  {
    const c = document.createElement("canvas");
    c.width = 128; c.height = 64;
    const x = c.getContext("2d");
    const grad = x.createRadialGradient(64, 32, 0, 64, 32, 64);
    grad.addColorStop(0,   "rgba(0,0,0,0.55)");
    grad.addColorStop(0.6, "rgba(0,0,0,0.20)");
    grad.addColorStop(1,   "rgba(0,0,0,0)");
    x.fillStyle = grad;
    x.fillRect(0, 0, c.width, c.height);
    const tex = new THREE.CanvasTexture(c);
    const shadowMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.4, l * 1.0), shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, 0.025, 0);
    shadow.renderOrder = 1;
    group.add(shadow);
  }
  // Glass — tinted dark, matches player.
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x050810, metalness: 0.20, roughness: 0.12, transparent: true, opacity: 0.85 });
  const glassGeo = buildExtrudedGlass(w * 0.94, bodyH, l * 0.96);
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.set(0, bodyH * 0.5 + 0.06, 0);
  group.add(glass);
  // Side accent stripes (subtle) instead of a thick roof stripe.
  const accentMat = new THREE.MeshStandardMaterial({ color: variant.stripe, metalness: 0.2, roughness: 0.4 });
  for (const side of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, l * 0.84), accentMat);
    stripe.position.set(side * w * 0.51, bodyH * 0.50, 0);
    group.add(stripe);
  }
  // Wheels — slim tire + matte rim. Chrome was reading orange under
  // sunset env reflection; matte gunmetal stays neutral.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.22, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x05070d, roughness: 0.95 });
  const hubGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.24, 10);
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x6a727a, metalness: 0.55, roughness: 0.45 });
  const wx = w * 0.5 - 0.16;
  const wzF = l * 0.36;
  const wzR = -l * 0.36;
  for (const [px, pz] of [[-wx, wzF], [wx, wzF], [-wx, wzR], [wx, wzR]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(px, 0.36, pz);
    wheel.userData.shadowCast = true;
    group.add(wheel);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(px, 0.36, pz);
    group.add(hub);
  }
  // Front grille panel.
  const grilleMat = new THREE.MeshStandardMaterial({ color: 0x05070d, metalness: 0.3, roughness: 0.7 });
  const grille = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.66, h * 0.22, 0.04),
    grilleMat
  );
  grille.position.set(0, bodyH * 0.20, l * 0.51);
  group.add(grille);
  // Rear bumper panel.
  const rearBumper = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.86, h * 0.20, 0.04),
    grilleMat
  );
  rearBumper.position.set(0, bodyH * 0.18, -l * 0.51);
  group.add(rearBumper);
  // Spoiler per variant — Y values rebased on bodyH.
  const roofY = bodyH * 0.95;
  const trunkY = bodyH * 0.50;
  if (variant.spoiler === "wing") {
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x10131e });
    const wing = new THREE.Mesh(new THREE.BoxGeometry(w * 0.95, 0.06, 0.30), wingMat);
    wing.position.set(0, trunkY + 0.52, -l * 0.42);
    group.add(wing);
    for (const side of [-1, 1]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, 0.10), wingMat);
      r.position.set(side * w * 0.32, trunkY + 0.28, -l * 0.42);
      group.add(r);
    }
  } else if (variant.spoiler === "ducktail") {
    const tailMat = new THREE.MeshStandardMaterial({ color: variant.body, metalness: 0.4 });
    const tail = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, 0.10, 0.32), tailMat);
    tail.position.set(0, trunkY + 0.10, -l * 0.40);
    group.add(tail);
  } else if (variant.spoiler === "deck") {
    const tailMat = new THREE.MeshStandardMaterial({ color: 0x10131e });
    const tail = new THREE.Mesh(new THREE.BoxGeometry(w * 0.95, 0.06, 0.18), tailMat);
    tail.position.set(0, trunkY + 0.05, -l * 0.46);
    group.add(tail);
  } else if (variant.spoiler === "lip") {
    const lipMat = new THREE.MeshStandardMaterial({ color: 0x0a0d18 });
    const lip = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, 0.05, 0.20), lipMat);
    lip.position.set(0, bodyH * 0.10, -l * 0.44);
    group.add(lip);
  }
  // Tail lights — slim emissive bars at body height (matches player car).
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xff315c,
    emissive: 0xff315c,
    emissiveIntensity: 0.95
  });
  const tailY = bodyH * 0.55;
  for (const side of [-1, 1]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(w * 0.32, 0.05, 0.04), tailMat);
    tail.position.set(side * w * 0.28, tailY, -l * 0.52);
    group.add(tail);
  }

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
  { id: "aggressive",  brakeBoldness: 1.20, blockChance: 0.65, laneJitter: 0.40, paceVariance: 0.05, attackBoldness: 1.30 },
  { id: "smooth",      brakeBoldness: 0.90, blockChance: 0.20, laneJitter: 0.10, paceVariance: 0.02, attackBoldness: 0.85 },
  { id: "consistent",  brakeBoldness: 1.00, blockChance: 0.35, laneJitter: 0.18, paceVariance: 0.01, attackBoldness: 1.00 },
  { id: "wildcard",    brakeBoldness: 1.10, blockChance: 0.50, laneJitter: 0.55, paceVariance: 0.10, attackBoldness: 1.20 }
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
      bio: variant.bio || "",
      homeTrack: variant.homeTrack || null,
      mesh,
      variant,                        // expose for HUD coloring
      personality,
      isBoss,
      s: gridS,
      lane: gridLane,
      homeLane,
      // Rivals match player top speed (player BASE_MAX_SPEED = 78 m/s).
      // Front pack runs at the player's max — no handicap. Bosses and
      // mid-pack get small spreads so the field has natural variation
      // but every rival can keep up on a straight.
      targetSpeed: isBoss ? variant.basePace + Math.random() * 4
                  : i < 5 ? 78 + Math.random() * 2
                  : i < 10 ? 76 + Math.random() * 3
                  : 73 + Math.random() * 3,
      baseTargetSpeed: 0,
      speed: 0,
      laps: 0,
      heading: 0,
      hp: isBoss ? 140 : 100,    // bosses take more hits to kill
      crashedT: 0,
      crashSpinV: 0,
      // Mistake state — bosses + smooth drivers rarely err; aggressive +
      // wildcards make occasional mistakes (overshoot a corner, brake too
      // late). Mistake duration counts down; while mistake > 0, pace drops.
      mistakeT: 0,
      // Cooldown until next eligible mistake — randomized per rival so
      // they don't all err at the same time.
      mistakeCooldown: 8 + Math.random() * 14
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
  easy:    { paceMul: 0.92, rubberCatchup: 1.05, rubberEase: 0.85, rubberMode: "soft" },
  normal:  { paceMul: 1.04, rubberCatchup: 1.15, rubberEase: 0.94, rubberMode: "soft" },
  hard:    { paceMul: 1.14, rubberCatchup: 1.22, rubberEase: 0.98, rubberMode: "tight" },
  brutal:  { paceMul: 1.24, rubberCatchup: 1.00, rubberEase: 1.00, rubberMode: "none" }
};

export function tickRivals(rivals, dt, track, playerCar, playerTotal = 0, difficulty = "normal", rivalDtScale = 1.0) {
  dt = dt * rivalDtScale;
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
    // If there's traffic ahead, plan overtake: pick the side with more room
    // and commit hard. Aggressive personalities dive deeper.
    if (blockerLane != null && blockerDist < 28) {
      const overtakeSide = blockerLane >= 0 ? -1 : 1;
      const commit = Math.max(0.45, 1.0 - blockerDist / 28);
      const aggression = (r.personality?.attackBoldness ?? 1.0);
      dodge = overtakeSide * 4.2 * commit * aggression;
    }
    // Slipstream attack — when behind a slower or comparable car within 14m,
    // bursts get a temporary +6% pace boost (simulating draft + commit).
    let attackBoost = 1.0;
    if (blockerSpeed != null && blockerDist < 14 && blockerSpeed > r.targetSpeed * 0.8) {
      attackBoost = 1.06;
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

    // ---- Mistakes ----
    // Mistakes drop pace for ~1.5 sec at sharp corner entries. Both the
    // start and end of the mistake fade in/out smoothly via an easing
    // curve so the car doesn't snap to/from slow pace.
    if (r.crashedT <= 0) {
      r.mistakeCooldown -= dt;
      if (r.mistakeT > 0) r.mistakeT -= dt;
      else if (r.mistakeCooldown <= 0) {
        const cornerSharp = curveSeverity > 0.022;
        const baseChance = (r.personality?.id === "smooth") ? 0.03
                         : (r.personality?.id === "aggressive") ? 0.10
                         : (r.personality?.id === "wildcard") ? 0.13 : 0.06;
        const mistakeChance = (r.isBoss ? baseChance * 0.30 : baseChance) * dt;
        if (cornerSharp && Math.random() < mistakeChance) {
          r.mistakeT = 1.0 + Math.random() * 0.6;
          r.mistakeFullDur = r.mistakeT;
          r.mistakeCooldown = 14 + Math.random() * 18;
        }
      }
    }
    // Smooth mistake factor: fade in over first 30% of duration,
    // hold for middle 40%, fade back out for last 30%. Only -22% pace
    // at peak (was -38% — too aggressive).
    let mistakeFactor = 1.0;
    if (r.mistakeT > 0 && r.mistakeFullDur > 0) {
      const elapsed = r.mistakeFullDur - r.mistakeT;
      const total = r.mistakeFullDur;
      const phase = elapsed / total;
      let strength;
      if (phase < 0.30)      strength = phase / 0.30;
      else if (phase < 0.70) strength = 1.0;
      else                   strength = (1.0 - phase) / 0.30;
      mistakeFactor = 1.0 - 0.22 * Math.max(0, Math.min(1, strength));
    }

    // ---- Pace ----
    // Smooth attackBoost — lerp the cached value toward the new target so
    // overtake commits don't snap pace by 6% per frame.
    const targetAttack = attackBoost;
    r._attackSmooth = (r._attackSmooth ?? 1.0) + (targetAttack - (r._attackSmooth ?? 1.0)) * Math.min(1, dt * 4);
    let pace = r.targetSpeed * (1 - cornerDrag) * r._attackSmooth * mistakeFactor;
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
    // Crucially, never decelerate BELOW pace — that creates a visible
    // stutter as the car re-accelerates back up to where it should be.
    const brakeUrgency = Math.min(1, c2 * 12.0);
    const brakeThreshold = 0.55 / personality.brakeBoldness;
    if (brakeUrgency > brakeThreshold && r.speed > pace) {
      const decel = dt * 18 * brakeUrgency;
      r.speed = Math.max(pace, r.speed - decel);
    }
    // Lane jitter — wildcards weave a bit. Crashed rivals weave more.
    const jitter = personality.laneJitter * (r.crashedT > 0 ? 2.5 : 1);
    r.lane += Math.sin(performance.now() * 0.001 + r.s * 0.05) * jitter * dt * 0.4;
    // Speed lerp toward pace — slightly slower so brakeUrgency events
    // don't fight the pace target on the way back up.
    r.speed += (pace - r.speed) * Math.min(1, dt * 2.0);

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
