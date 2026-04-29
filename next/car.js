import * as THREE from "three";

// ============================================================
// CAR — physics + 3D body builder
// ============================================================
//
// Architecture:
//   createCar(shapeId)            — builds the mesh + state.
//   car.tick(dt, input, track)    — top-level physics step. Calls phase fns:
//     stepInput()      input → steer + intent
//     stepDrivetrain() throttle / brake / drag / heat / boost / clamps
//     stepHeading()    yaw rotation from steering authority
//     stepDrift()      drift state machine + lateral kick
//     stepLateral()    lateral velocity decay (grip)
//     stepIntegrate()  apply forward + lateral motion to position
//     stepTrack()      barrier clamp / off-road / vertical settle
//     stepBody()       pitch + roll + bob for visible weight transfer
//
// Tuning constants live up top so balance is in one place.
// ============================================================

// ---- Tuning knobs (realism-leaning, slower acceleration curve) ----
const BASE_MAX_SPEED = 78;       // m/s top speed unchanged so chases still pop
const ACCEL = 13;                // m/s² peak (was 22 — feels much heavier now)
const BRAKE = 38;                // m/s² (was 42, slightly less so braking has weight)
const DRAG = 5;                  // m/s² coast-down (was 4, so car bleeds speed if you stop accelerating)
const OFF_ROAD_DRAG = 28;        // m/s² off-road (was 24, more punishing)
const STEER_RATE = 2.5;          // rad/s lock rate (slightly slower for weighty feel)
const STEER_MAX = 0.7;
const GRIP = 12;
const DRIFT_GRIP = 4.5;
const BOOST_MUL = 1.25;
const STEER_AUTHORITY = 1.85;

// Engine heat.
const HEAT_THRESHOLD = 0.97;
const HEAT_BUILD_RATE = 0.10;
const HEAT_VENT_RATE = 0.18;
const HEAT_VENT_BAND = 0.85;
const HEAT_OVERHEAT = 0.97;
const HEAT_RECOVER = 0.55;
const HEAT_CAP_MUL = 0.92;

// Gears — defaults per car. Each shape can override its gearCount/redline/etc.
const GEAR_COUNT_DEFAULT = 6;
const GEAR_REDLINE_RPM_DEFAULT = 7800;
const GEAR_SHIFT_RPM_DEFAULT = 7200;
const GEAR_DOWNSHIFT_RPM_DEFAULT = 2400;
const GEAR_SHIFT_TIME = 0.18;

// Per-shape gear profiles. kei has 5 fast gears with high redline (revs hard);
// muscle has 4 long gears (lazy revver, lots of low-end). super has 7 like a
// modern PDK box. Others use the default 6-speed.
const GEAR_PROFILES = {
  gt:    { count: 6, redline: 7800, shiftUp: 7200, shiftDown: 2400 },
  drift: { count: 6, redline: 8200, shiftUp: 7600, shiftDown: 2800 },   // revvier 2JZ vibes
  rally: { count: 6, redline: 7600, shiftUp: 7000, shiftDown: 2400 },
  super: { count: 7, redline: 8800, shiftUp: 8200, shiftDown: 2600 },   // PDK 7-speed
  kei:   { count: 5, redline: 9000, shiftUp: 8400, shiftDown: 3000 },   // K20-style screamer
  muscle:{ count: 4, redline: 6800, shiftUp: 6400, shiftDown: 1800 }    // long-geared brute
};

// Slipstream — when within DRAFT_RANGE behind a car, get a top-speed bump.
const DRAFT_RANGE = 22;            // metres
const DRAFT_BONUS_MAX = 0.10;      // up to +10% top-speed at peak draft

// Trail-braking — extra rear rotation when braking mid-corner.
const TRAIL_BRAKE_BOOST = 0.55;    // multiplies steering authority when both brake+steer

// Counter-steer assist — light auto-correct toward heading-of-motion in drift.
const COUNTERSTEER_ASSIST = 0.35;  // 0..1 strength

// Perfect-launch — throttle held with PERFECT_WINDOW seconds of GO grants extra surge.
const PERFECT_LAUNCH_WINDOW = 0.28;
const PERFECT_LAUNCH_BONUS = 0.55;

// Car proportions — tuned for sleek JDM silhouettes.
//   width   = max body width
//   height  = body box height; lower = slammed/aggressive (was 0.7-0.8 → 0.50-0.55 now)
//   length  = total length
//   cabin   = greenhouse dimensions; smaller h ratio + steeper slope = more aggressive
export const CAR_SHAPES = {
  gt: {
    label: "GT Coupe",
    description: "Smooth top-end weapon, planted in long sweepers.",
    body: 0xfbfdff, stripe: 0xff315c,
    width: 1.92, height: 0.52, length: 4.30,
    cabin: { w: 1.52, h: 0.48, l: 2.05, z: -0.25 },
    stats: { top: 1.04, accel: 1.0, handling: 1.0, grip: 1.05 },
    spoiler: "ducktail"
  },
  drift: {
    label: "Drift Coupe",
    description: "Loose rear, snappy steering. Slides easy.",
    body: 0xffe156, stripe: 0x101525,
    width: 1.84, height: 0.55, length: 4.10,
    cabin: { w: 1.46, h: 0.52, l: 1.85, z: -0.05 },
    stats: { top: 0.94, accel: 1.05, handling: 1.18, grip: 0.78 },
    spoiler: "lip"
  },
  rally: {
    label: "Rally Sedan",
    description: "AWD-ish grip. Punches out of corners and brakes hard.",
    body: 0xff315c, stripe: 0xffd166,
    width: 1.88, height: 0.62, length: 4.40,
    cabin: { w: 1.58, h: 0.58, l: 2.20, z: -0.15 },
    stats: { top: 0.98, accel: 1.04, handling: 0.98, grip: 1.18 },
    spoiler: "wing"
  },
  super: {
    label: "Wedge Super",
    description: "Top of the food chain. Massive top end.",
    body: 0xa66cff, stripe: 0xfbfdff,
    width: 2.02, height: 0.46, length: 4.55,         // very low + wide
    cabin: { w: 1.46, h: 0.36, l: 1.65, z: -0.35 },
    stats: { top: 1.10, accel: 1.06, handling: 0.92, grip: 1.10 },
    spoiler: "deck"
  },
  // Lightweight track-day kei coupe. Slow top end but agile + grippy.
  kei: {
    label: "Kei Sport",
    description: "Tiny featherweight. Diabolical grip + razor handling.",
    body: 0x3cff9b, stripe: 0x101525,
    width: 1.62, height: 0.66, length: 3.55,
    cabin: { w: 1.34, h: 0.56, l: 1.65, z: -0.05 },
    stats: { top: 0.86, accel: 1.10, handling: 1.28, grip: 1.20 },
    spoiler: "ducktail"
  },
  // Big-power muscle GT. Huge accel + top end, sluggish handling.
  muscle: {
    label: "Hyper GT",
    description: "Brutal acceleration, momentum-based corner approach.",
    body: 0x141828, stripe: 0xff315c,
    width: 2.10, height: 0.54, length: 4.75,
    cabin: { w: 1.62, h: 0.46, l: 1.95, z: -0.20 },
    stats: { top: 1.14, accel: 1.10, handling: 0.86, grip: 0.96 },
    spoiler: "wing"
  }
};

// Helper for material consistency.
function pbr(color, metalness = 0.4, roughness = 0.5) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

// Build a sleeker car body — a 14-vertex chamfered prism with a beveled
// nose and tail, narrower waist than the wheel arches, and a slight
// shoulder line. Replaces the old BoxGeometry "boxy" body.
export function buildSleekBody(w, h, l) {
  const hw = w * 0.5;
  const hh = h * 0.5;
  const hl = l * 0.5;
  // Bevel ratios.
  const noseTaper = 0.78;   // front gets narrower
  const tailTaper = 0.86;   // rear narrows slightly less
  const bevelZ = l * 0.10;  // longitudinal bevel from nose tip
  const tailBevelZ = l * 0.06;
  // Vertices order (z + means front):
  //   0..3  front bottom rim (chamfered nose tip, expand to full width)
  //   4..7  front top rim
  //   8..11 rear bottom rim
  //   12..15 rear top rim
  // We'll build 16 vertices total.
  const v = new Float32Array([
    // Front-bottom chamfer (4 vertices in a trapezoid):
    -hw * noseTaper, -hh, hl - bevelZ * 0.4,   // 0: front bottom L
     hw * noseTaper, -hh, hl - bevelZ * 0.4,   // 1: front bottom R
    -hw * 0.55,      -hh, hl,                  // 2: nose tip L
     hw * 0.55,      -hh, hl,                  // 3: nose tip R
    // Front-top:
    -hw * 0.86,       hh, hl - bevelZ,          // 4: front top L
     hw * 0.86,       hh, hl - bevelZ,          // 5: front top R
    -hw * 0.50,       hh * 0.6, hl - bevelZ * 0.3, // 6: nose top L
     hw * 0.50,       hh * 0.6, hl - bevelZ * 0.3, // 7: nose top R
    // Rear-bottom:
    -hw * tailTaper, -hh, -hl + tailBevelZ * 0.4, // 8
     hw * tailTaper, -hh, -hl + tailBevelZ * 0.4, // 9
    -hw * 0.62,      -hh, -hl,                    // 10
     hw * 0.62,      -hh, -hl,                    // 11
    // Rear-top:
    -hw * 0.90,       hh, -hl + tailBevelZ,        // 12
     hw * 0.90,       hh, -hl + tailBevelZ,        // 13
    -hw * 0.62,       hh * 0.78, -hl,              // 14
     hw * 0.62,       hh * 0.78, -hl,              // 15
  ]);
  const idx = new Uint16Array([
    // Front nose face (between 2,3 nose tips and 6,7 nose top)
    2, 3, 7,  2, 7, 6,
    // Front nose top-bevels (between 6,7 nose top and 4,5 main top)
    6, 7, 5,  6, 5, 4,
    // Front nose-bottom-bevels (between 0,1 main bottom and 2,3 nose tips)
    0, 2, 3,  0, 3, 1,
    // Front face (between 0,1 main bottom and 4,5 main top)
    0, 1, 5,  0, 5, 4,
    // Front-bottom L bevel (0 to 2 + 6 to 4)
    0, 4, 6,  0, 6, 2,
    // Front-bottom R bevel
    1, 3, 7,  1, 7, 5,
    // Bottom (8,9,10,11 rear + 0,1,2,3 front)
    0, 1, 9,  0, 9, 8,
    8, 9, 11, 8, 11, 10,
    2, 0, 8,  2, 8, 10,    // left bottom strip
    1, 3, 11, 1, 11, 9,    // right bottom strip
    // Top (4,5,6,7 front + 12,13,14,15 rear)
    4, 5, 13, 4, 13, 12,
    12, 13, 15, 12, 15, 14,
    6, 4, 12, 6, 12, 14,    // left top strip
    5, 7, 15, 5, 15, 13,    // right top strip
    // Left side (0,4,8,12 + 2,6,10,14 zigzag)
    0, 8, 12,  0, 12, 4,
    // Right side
    1, 5, 13,  1, 13, 9,
    // Rear nose face (10,11 tip + 14,15 top)
    10, 11, 15,  10, 15, 14,
    // Rear top-bevels (14,15 to 12,13)
    14, 15, 13,  14, 13, 12,
    // Rear bottom-bevels (8,9 to 10,11)
    8, 10, 11,  8, 11, 9,
    // Rear main face (8,9,12,13)
    9, 8, 12,  9, 12, 13,
    // Rear-bottom L bevel
    8, 14, 10,  8, 12, 14,
    // Rear-bottom R bevel
    9, 11, 15,  9, 15, 13
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(v, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  return geo;
}

// Build a tapered cabin (sloped windshield + sloped rear glass) using a custom
// 8-vertex BufferGeometry. Front top and rear top are pulled inward along Z
// so the silhouette reads like a real coupe rather than a stacked box.
// Default slopes are now MORE aggressive (0.45 front, 0.35 rear) for a sleek
// JDM fastback profile.
export function buildSlopedCabin(w, h, l, zCenter, slopeFront = 0.45, slopeRear = 0.35) {
  // 8 corners: bottom (b) and top (t), with front/rear and left/right.
  const halfW = w * 0.5;
  const halfWTopFront = halfW * 0.86;     // narrow the roof slightly
  const halfWTopRear = halfW * 0.92;
  const zF = zCenter + l * 0.5;
  const zR = zCenter - l * 0.5;
  const zFTop = zF - l * slopeFront;       // pull top forward edge backward
  const zRTop = zR + l * slopeRear;        // pull top rear edge forward
  const yB = 0;
  const yT = h;
  // Vertices: BFL, BFR, BRL, BRR, TFL, TFR, TRL, TRR
  const v = new Float32Array([
    -halfW, yB, zF,           // 0 BFL
     halfW, yB, zF,           // 1 BFR
    -halfW, yB, zR,           // 2 BRL
     halfW, yB, zR,           // 3 BRR
    -halfWTopFront, yT, zFTop, // 4 TFL
     halfWTopFront, yT, zFTop, // 5 TFR
    -halfWTopRear,  yT, zRTop, // 6 TRL
     halfWTopRear,  yT, zRTop  // 7 TRR
  ]);
  // 12 triangles (2 per face × 6 faces).
  const idx = new Uint16Array([
    // bottom
    0, 1, 3,  0, 3, 2,
    // top
    4, 6, 7,  4, 7, 5,
    // front (windshield)
    0, 4, 5,  0, 5, 1,
    // rear (rear glass)
    2, 3, 7,  2, 7, 6,
    // left
    0, 2, 6,  0, 6, 4,
    // right
    1, 5, 7,  1, 7, 3
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(v, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  return geo;
}

// Rounded nose: a slim wedge that flares from a low front lip up to the bonnet line.
export function buildNoseWedge(w, h, l) {
  const halfW = w * 0.5;
  const v = new Float32Array([
    // front bottom (low + narrow)
    -halfW * 0.8, 0,         l * 0.5,
     halfW * 0.8, 0,         l * 0.5,
    // rear bottom (full width, where it meets the body)
    -halfW,       0,         -l * 0.5,
     halfW,       0,         -l * 0.5,
    // rear top (where the wedge tops out)
    -halfW * 0.92, h,        -l * 0.5,
     halfW * 0.92, h,        -l * 0.5
  ]);
  const idx = new Uint16Array([
    // bottom
    0, 1, 3,  0, 3, 2,
    // rear face (flat)
    2, 3, 5,  2, 5, 4,
    // left slope
    0, 2, 4,
    // right slope
    1, 5, 3,
    // top slope (front lip up to top)
    0, 4, 5,  0, 5, 1
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(v, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  return geo;
}

function buildBody(shape) {
  const group = new THREE.Group();

  const bodyGeo = buildSleekBody(shape.width, shape.height, shape.length * 0.94);
  const bodyMat = pbr(shape.body, 0.55, 0.30);  // higher metalness, lower roughness for richer reflections
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.set(0, shape.height * 0.85 + shape.height * 0.5, -shape.length * 0.03);
  group.add(body);

  // Sloped cabin (windshield + roof + rear glass tapered).
  const cabinH = shape.cabin.h * 1.05;
  const cabinGeo = buildSlopedCabin(shape.cabin.w, cabinH, shape.cabin.l, shape.cabin.z);
  const cabin = new THREE.Mesh(cabinGeo, pbr(0x101729, 0.25, 0.28));
  cabin.position.y = shape.height * 0.85 + shape.height * 0.5 - 0.05;
  group.add(cabin);

  // Glass: a slightly inset copy of the cabin, semi-transparent.
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x2ee9ff, metalness: 0.0, roughness: 0.1, transparent: true, opacity: 0.36
  });
  const glassGeo = buildSlopedCabin(shape.cabin.w * 0.96, cabinH * 0.94, shape.cabin.l * 0.96, shape.cabin.z);
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.copy(cabin.position);
  glass.position.y += 0.02;
  group.add(glass);

  // Window frames — thin chrome strips around the cabin top.
  const frameMat = pbr(shape.accent ?? 0xc8d4e6, 0.85, 0.22);
  const cabinTopY = cabin.position.y + cabinH;
  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(shape.cabin.w * 0.84, 0.04, shape.cabin.l * 0.45), frameMat);
  frameTop.position.set(0, cabinTopY, shape.cabin.z);
  group.add(frameTop);
  // Waistline strip — bottom of the windows.
  for (const side of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, shape.cabin.l * 0.94), frameMat);
    strip.position.set(side * (shape.cabin.w * 0.5 - 0.02), cabin.position.y, shape.cabin.z);
    group.add(strip);
  }

  // Side mirrors — small wedges on the front pillar.
  const mirrorMat = pbr(shape.body, 0.4, 0.5);
  for (const side of [-1, 1]) {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.10, 0.14), mirrorMat);
    mirror.position.set(
      side * (shape.cabin.w * 0.5 + 0.06),
      cabin.position.y + cabinH * 0.45,
      shape.cabin.z + shape.cabin.l * 0.32
    );
    group.add(mirror);
    // Mirror glass facet.
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.10), pbr(0x2ee9ff, 0.0, 0.2));
    lens.position.set(
      side * (shape.cabin.w * 0.5 + 0.16),
      cabin.position.y + cabinH * 0.45,
      shape.cabin.z + shape.cabin.l * 0.32
    );
    group.add(lens);
  }

  // Stripe
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.30, shape.height + 0.02, shape.length + 0.02),
    pbr(shape.stripe, 0.1, 0.4)
  );
  stripe.position.y = shape.height * 0.85;
  group.add(stripe);

  // Wheels with chrome hubs (color customizable via livery.accent).
  const wheelGeo = new THREE.CylinderGeometry(0.40, 0.40, 0.30, 18);
  const wheelMat = pbr(0x0a0e18, 0.0, 0.9);
  const hubGeo = new THREE.CylinderGeometry(0.20, 0.20, 0.32, 14);
  const hubMat = pbr(shape.accent ?? 0xc8d4e6, 0.85, 0.18);
  const lugMat = pbr(shape.accent ?? 0xc8d4e6, 0.92, 0.15);
  const wx = shape.width * 0.5 - 0.06;
  const wzF = shape.length * 0.36;
  const wzR = -shape.length * 0.36;
  for (const [x, z] of [[-wx, wzF], [wx, wzF], [-wx, wzR], [wx, wzR]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.40, z);
    group.add(w);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(x, 0.40, z);
    group.add(hub);
    // Lug detail — small chrome dots around the hub face on the outer side.
    const outX = x + (x < 0 ? -0.16 : 0.16);
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2;
      const lug = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), lugMat);
      lug.position.set(outX, 0.40 + Math.cos(ang) * 0.13, z + Math.sin(ang) * 0.13);
      group.add(lug);
    }
  }

  // Rounded nose wedge — wraps the front bumper down toward a thin lip.
  const noseMat = pbr(shape.body, 0.4, 0.5);
  const noseGeo = buildNoseWedge(shape.width * 0.96, shape.height * 0.55, shape.length * 0.22);
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.set(0, shape.height * 0.40, shape.length * 0.40);
  group.add(nose);

  // Front splitter — thin lip below the nose, sticks slightly forward.
  const splitter = new THREE.Mesh(
    new THREE.BoxGeometry(shape.width * 0.94, 0.04, 0.20),
    pbr(0x0a0d18, 0.4, 0.6)
  );
  splitter.position.set(0, shape.height * 0.16, shape.length * 0.50);
  group.add(splitter);

  // Side skirts — flat strakes along the lower edge, just above ground.
  const skirtMat = pbr(0x0a0d18, 0.3, 0.6);
  for (const side of [-1, 1]) {
    const skirt = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.10, shape.length * 0.62),
      skirtMat
    );
    skirt.position.set(side * shape.width * 0.50, shape.height * 0.20, 0);
    group.add(skirt);
  }

  // Fender flares — subtle bulges over each wheel for a wide-body look.
  const flareMat = pbr(shape.body, 0.4, 0.5);
  const flareGeo = new THREE.BoxGeometry(0.18, shape.height * 0.45, 0.66);
  const wxFlare = shape.width * 0.50;
  for (const z of [shape.length * 0.35, -shape.length * 0.36]) {
    for (const side of [-1, 1]) {
      const flare = new THREE.Mesh(flareGeo, flareMat);
      flare.position.set(side * wxFlare, shape.height * 0.55, z);
      group.add(flare);
    }
  }

  // Rear diffuser — angled fins under the rear bumper.
  const diffMat = pbr(0x0a0d18, 0.3, 0.6);
  for (let i = 0; i < 4; i++) {
    const xOff = (i - 1.5) * 0.30;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.40), diffMat);
    fin.position.set(xOff, shape.height * 0.20, -shape.length * 0.46);
    group.add(fin);
  }

  // Hood vents — on aggressive cars (drift, super, muscle, kei), small slits.
  if (["drift", "super", "muscle", "kei"].includes(shape.label?.toLowerCase()?.split(" ")[0] || "") || true) {
    const ventMat = pbr(0x05070d, 0.4, 0.7);
    for (const side of [-1, 1]) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.22), ventMat);
      vent.position.set(side * 0.30, shape.height * 0.85 + shape.height * 0.55, shape.length * 0.20);
      group.add(vent);
    }
  }

  // Exhaust tips — twin chrome cylinders at the rear.
  const exhaustMat = pbr(0xc8d4e6, 0.85, 0.18);
  for (const side of [-1, 1]) {
    const exh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.18, 10), exhaustMat);
    exh.rotation.x = Math.PI / 2;
    exh.position.set(side * shape.width * 0.30, shape.height * 0.32, -shape.length * 0.51);
    group.add(exh);
  }

  // Front grille — dark panel under the headlights.
  const grilleMat = pbr(0x05070d, 0.3, 0.7);
  const grille = new THREE.Mesh(new THREE.BoxGeometry(shape.width * 0.55, shape.height * 0.22, 0.04), grilleMat);
  grille.position.set(0, shape.height * 0.38, shape.length * 0.51);
  group.add(grille);
  // Two small intake slits on either side of the grille.
  for (const side of [-1, 1]) {
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.04), grilleMat);
    intake.position.set(side * shape.width * 0.42, shape.height * 0.30, shape.length * 0.51);
    group.add(intake);
  }
  // Rear bumper indent — dark strip across the back.
  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(shape.width * 0.82, shape.height * 0.18, 0.04), grilleMat);
  rearBumper.position.set(0, shape.height * 0.32, -shape.length * 0.51);
  group.add(rearBumper);

  // Hood detail (subtle).
  if (shape.spoiler === "wing" || shape.spoiler === "lip") {
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 0.36), pbr(0x05070d, 0.5, 0.6));
    scoop.position.set(0, shape.height * 0.85 + shape.height * 0.55, shape.length * 0.22);
    group.add(scoop);
  } else if (shape.spoiler === "deck") {
    for (const side of [-1, 1]) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.14), pbr(0x05070d));
      vent.position.set(side * 0.28, shape.height * 0.85 + shape.height * 0.55, shape.length * 0.28);
      group.add(vent);
    }
  }

  // Spoiler per shape.
  if (shape.spoiler === "wing") {
    const wingMat = pbr(0x10131e, 0.4, 0.5);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(shape.width * 0.95, 0.06, 0.34), wingMat);
    wing.position.set(0, shape.height * 0.85 + shape.height * 0.5 + 0.5, -shape.length * 0.42);
    group.add(wing);
    for (const side of [-1, 1]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.46, 0.10), wingMat);
      r.position.set(side * shape.width * 0.32, shape.height * 0.85 + shape.height * 0.5 + 0.27, -shape.length * 0.42);
      group.add(r);
    }
  } else if (shape.spoiler === "ducktail") {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(shape.width * 0.85, 0.10, 0.36), pbr(shape.body, 0.4, 0.5));
    tail.position.set(0, shape.height * 0.85 + shape.height * 0.55, -shape.length * 0.40);
    group.add(tail);
  } else if (shape.spoiler === "deck") {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(shape.width * 0.95, 0.06, 0.20), pbr(0x10131e));
    tail.position.set(0, shape.height * 0.85 + shape.height * 0.5 + 0.12, -shape.length * 0.46);
    group.add(tail);
  } else if (shape.spoiler === "lip") {
    const lip = new THREE.Mesh(new THREE.BoxGeometry(shape.width * 0.85, 0.05, 0.20), pbr(0x0a0d18));
    lip.position.set(0, shape.height * 0.18, -shape.length * 0.44);
    group.add(lip);
  }

  // Headlights — wide warm cones that wash the road.
  const headLightL = new THREE.SpotLight(0xfff5d4, 6.0, 110, Math.PI / 4.2, 0.35, 1.0);
  headLightL.position.set(-shape.width * 0.32, 0.55, shape.length * 0.46);
  headLightL.target.position.set(-shape.width * 0.20, -0.6, 50);
  group.add(headLightL, headLightL.target);
  const headLightR = new THREE.SpotLight(0xfff5d4, 6.0, 110, Math.PI / 4.2, 0.35, 1.0);
  headLightR.position.set(shape.width * 0.32, 0.55, shape.length * 0.46);
  headLightR.target.position.set(shape.width * 0.20, -0.6, 50);
  group.add(headLightR, headLightR.target);
  for (const side of [-1, 1]) {
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.18, 0.10), new THREE.MeshBasicMaterial({ color: 0xfff5d4 }));
    lens.position.set(side * shape.width * 0.32, 0.55, shape.length * 0.50);
    group.add(lens);
  }
  // Tail lights — modern full-width LED bar across the back. Two side blocks
  // PLUS a thin connecting strip read like a 2020s GT taillight.
  const tailLights = [];
  for (const side of [-1, 1]) {
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0xff315c,
      emissive: 0xff315c,
      emissiveIntensity: 0.8
    });
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.13, 0.10), tailMat);
    tail.position.set(side * shape.width * 0.32, 0.62, -shape.length * 0.50);
    group.add(tail);
    tailLights.push(tailMat);
  }
  // Center connecting LED bar.
  const ledBarMat = new THREE.MeshStandardMaterial({
    color: 0xff315c,
    emissive: 0xff315c,
    emissiveIntensity: 0.6
  });
  const ledBar = new THREE.Mesh(
    new THREE.BoxGeometry(shape.width * 0.55, 0.05, 0.06),
    ledBarMat
  );
  ledBar.position.set(0, 0.62, -shape.length * 0.50);
  group.add(ledBar);
  tailLights.push(ledBarMat);
  group.userData.tailMats = tailLights;

  // Side air vents — angled slits behind front wheels.
  const vMat = pbr(0x05070d, 0.4, 0.7);
  for (const side of [-1, 1]) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.10, 0.36), vMat);
    vent.position.set(side * shape.width * 0.51, shape.height * 0.55, shape.length * 0.18);
    vent.rotation.y = side * 0.15;
    group.add(vent);
    const vent2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.22), vMat);
    vent2.position.set(side * shape.width * 0.51, shape.height * 0.42, shape.length * 0.10);
    group.add(vent2);
  }

  // Hood scoop — bonnet-mounted air intake, prominent on muscle / drift /
  // super shapes. Skipped on small kei + GT for clean lines.
  if (["wing", "deck"].includes(shape.spoiler)) {
    const scoopMat = pbr(0x05070d, 0.45, 0.55);
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.10, 0.50), scoopMat);
    scoop.position.set(0, shape.height * 0.85 + shape.height * 0.55 + 0.04, shape.length * 0.20);
    group.add(scoop);
    // Open intake slot at front of scoop.
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 0.04), pbr(0x000000));
    slot.position.set(0, shape.height * 0.85 + shape.height * 0.55 + 0.04, shape.length * 0.20 + 0.24);
    group.add(slot);
  }

  // Steering wheel — small dark disc visible through the windshield.
  // Stored in userData so the runtime can rotate it with car.steer.
  const wheelGroup = new THREE.Group();
  const wheelDisc = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.025, 6, 16),
    pbr(0x05070d, 0.4, 0.6)
  );
  wheelDisc.rotation.x = Math.PI / 2 - 0.35;     // tilted toward driver
  wheelGroup.add(wheelDisc);
  // Center hub
  const hubM = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.04, 10),
    pbr(0x141828, 0.4, 0.6)
  );
  hubM.rotation.x = Math.PI / 2 - 0.35;
  wheelGroup.add(hubM);
  wheelGroup.position.set(
    -shape.cabin.w * 0.20,                                       // driver's side (left in JDM RHD = right; left for now)
    shape.height * 0.85 + shape.cabin.h * 0.55,
    shape.cabin.z + shape.cabin.l * 0.10
  );
  group.add(wheelGroup);
  group.userData.steeringWheel = wheelGroup;

  // Brake calipers — small colored boxes inside each wheel for detail.
  const caliperMat = new THREE.MeshStandardMaterial({ color: 0xff4a3a, metalness: 0.5, roughness: 0.4 });
  for (const [x, z] of [[-wx, wzF], [wx, wzF], [-wx, wzR], [wx, wzR]]) {
    const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.18), caliperMat);
    caliper.position.set(x + (x < 0 ? 0.06 : -0.06), 0.40, z);
    group.add(caliper);
  }

  return group;
}

// ============================================================
// Physics — phase functions
// ============================================================

function stepInput(car, input, dt) {
  const targetSteer = -(input.steer || 0) * STEER_MAX;
  car.steer += (targetSteer - car.steer) * Math.min(1, dt * 16);
  car._lastInput = input;
}

function stepDrivetrain(car, input, dt) {
  const stats = car.stats;

  // ---- Gear shift state machine (RPM is a derived display value) ----
  // RPM is computed from speed-fraction within the current gear's window.
  // Shift up when RPM > GEAR_SHIFT_RPM, shift down when RPM < GEAR_DOWNSHIFT_RPM.
  // During a shift, throttle is briefly cut.
  car.shiftCooldown = Math.max(0, (car.shiftCooldown || 0) - dt);
  const speedAbs = Math.abs(car.speed);
  const speedPctTop = speedAbs / car.maxSpeed;
  const gp = car._gearProfile || GEAR_PROFILES.gt;
  const COUNT = gp.count;
  const REDLINE = gp.redline;
  const SHIFT_UP = gp.shiftUp;
  const SHIFT_DOWN = gp.shiftDown;
  const gear = Math.max(1, Math.min(COUNT, car.gear || 1));
  const gearLo = (gear - 1) / COUNT;
  const gearHi = gear / COUNT;
  const inGear = Math.max(0, Math.min(1, (speedPctTop - gearLo) / Math.max(0.001, gearHi - gearLo)));
  car.rpm = 900 + inGear * (REDLINE - 900);
  if (car.shiftCooldown <= 0) {
    if (car.rpm > SHIFT_UP && gear < COUNT) {
      car.gear = gear + 1;
      car.shiftCooldown = GEAR_SHIFT_TIME;
      car.shiftEvent = 1;
    } else if (car.rpm < SHIFT_DOWN && gear > 1) {
      car.gear = gear - 1;
      car.shiftCooldown = GEAR_SHIFT_TIME;
      car.shiftEvent = -1;
    }
  }
  const shifting = car.shiftCooldown > 0;

  // Throttle / brake / coast. Throttle authority dips during a shift.
  const throttleAuthority = shifting ? 0.18 : 1.0;
  if (input.brake) {
    car.speed -= BRAKE * dt;
    car._accelInput = -1;
  } else if (input.throttle) {
    car.speed += ACCEL * stats.accel * throttleAuthority * dt;
    car._accelInput = 1;
  } else {
    car.speed -= Math.sign(car.speed) * DRAG * dt;
    if (Math.abs(car.speed) < DRAG * dt) car.speed = 0;
    car._accelInput = 0;
  }

  // Perfect-launch: if throttle is held within PERFECT_LAUNCH_WINDOW of the
  // race becoming live (input.raceJustStarted ticks for one frame), grant a
  // surge. main.js sets car.raceLiveTime each tick after lights-out.
  if (input.throttle && car.raceLiveTime != null && car.raceLiveTime < PERFECT_LAUNCH_WINDOW && !car._launchUsed && car.speed < 8) {
    car.speed += PERFECT_LAUNCH_BONUS * car.maxSpeed;
    car.boostMeter = Math.min(1, (car.boostMeter || 0) + 0.35);
    car.boostT = 0.6;
    car._launchUsed = true;
    car.launchEvent = true;
  }

  // Boost (refractory + meter + activation surge).
  car.boostCooldown = Math.max(0, car.boostCooldown - dt);
  const canBoost = input.boost && car.boostMeter > 0.05 && car.boostCooldown <= 0 && Math.abs(car.speed) > 12;
  car.boostJustFired = false;
  if (canBoost) {
    if (!car._wasBoosting) {
      const surge = car.maxSpeed * 0.18;
      car.speed = Math.min(car.maxSpeed * BOOST_MUL, car.speed + surge);
      car.boostJustFired = true;
    }
    car.speed += ACCEL * 1.05 * dt;
    car.boostT = 0.5;
    car.boostMeter = Math.max(0, car.boostMeter - 0.45 * dt);
    if (car.boostMeter <= 0.001) car.boostCooldown = 0.7;
  }
  car._wasBoosting = canBoost;
  car.boostT = Math.max(0, car.boostT - dt);

  // Engine heat.
  const speedFraction = Math.abs(car.speed) / car.maxSpeed;
  if (speedFraction > HEAT_THRESHOLD && input.throttle) {
    car.engineHeat = Math.min(1, car.engineHeat + dt * HEAT_BUILD_RATE);
  } else if (speedFraction < HEAT_VENT_BAND || !input.throttle) {
    car.engineHeat = Math.max(0, car.engineHeat - dt * HEAT_VENT_RATE);
  }
  if (car.engineHeat >= HEAT_OVERHEAT) car.overheating = true;
  if (car.engineHeat < HEAT_RECOVER) car.overheating = false;

  // Slipstream / draft — main loop sets car.draftAmount [0..1] each tick based
  // on the closest rival ahead. We add a small top-speed bonus when in a draft.
  const draft = Math.max(0, Math.min(1, car.draftAmount || 0));
  const draftMul = 1 + draft * DRAFT_BONUS_MAX;

  // Apply ceiling.
  const heatCap = car.overheating ? HEAT_CAP_MUL : 1.0;
  const ceiling = car.maxSpeed * heatCap * draftMul * (car.boostT > 0 ? BOOST_MUL : 1);
  car.speed = Math.max(-car.maxSpeed * 0.5, Math.min(ceiling, car.speed));
}

function stepHeading(car, dt) {
  const speedPct = Math.abs(car.speed) / car.maxSpeed;
  const yaw = car.steer * STEER_RATE * car.stats.handling
            * (1 - speedPct * 0.45) * Math.sign(car.speed || 1) * dt;
  car.heading += yaw;
  // Counter-steer assist: while drifting, drag the heading slightly toward the
  // direction of motion so the player doesn't spin out unrecoverably.
  if (car.driftActive && Math.abs(car.lateralV) > 4) {
    const motionAngle = Math.atan2(car.lateralV, Math.abs(car.speed) + 0.001);
    const correction = motionAngle * COUNTERSTEER_ASSIST * dt;
    car.heading -= correction;
  }
}

// Drift mechanics — locks in the initial direction on entry and lets the
// player modulate the slip angle with steering. Holding the drift button +
// steering same direction as drift keeps the slide; flicking the opposite
// direction snaps out cleanly. Reward scales with sustained duration.
function stepDrift(car, input, dt) {
  const speedPctNow = Math.abs(car.speed) / car.maxSpeed;
  // Use raw input.steer for direction sense — car.steer carries an internal
  // sign flip (see stepInput) so it would invert the drift direction.
  const inputSteer = input.steer || 0;
  const inputSign = Math.sign(inputSteer);
  // Entry threshold: drift held + meaningful steering + decent speed.
  const driftEligible = input.drift && Math.abs(inputSteer) > 0.18 && car.speed > 16;

  if (driftEligible && !car.driftActive) {
    // Enter drift — lock the slide into the direction the player kicked it.
    // Player presses RIGHT (input.steer = +1) → driftDir = +1 → lateralV +ve
    // (which moves the car +X, i.e. its right side in world space — correct).
    car.driftActive = true;
    car.driftDuration = 0;
    car.driftCharge = 0;
    car.driftDir = inputSign || 1;
    // Stronger initial kick so the back end actually breaks loose.
    car.lateralV += car.driftDir * 8.5;
    // Mild speed dip on entry — like a Scandinavian flick.
    car.speed *= 0.97;
  } else if (car.driftActive) {
    // While drifting, modulate the slide based on raw input direction.
    const counterFlick = inputSign && inputSign !== car.driftDir && Math.abs(inputSteer) > 0.55;
    if (!input.drift || counterFlick) {
      // Exit — counter-flick or release. Reward scales with duration.
      const minDur = 0.35;
      if (car.driftDuration > minDur) {
        const reward = Math.min(0.45, car.driftCharge * 0.55);
        car.boostMeter = Math.min(1, car.boostMeter + reward);
        car.boostT = 0.5;
        car.driftExitReward = reward;        // main.js reads + clears for popup
      }
      car.driftActive = false;
      car.driftDuration = 0;
      car.driftCharge = 0;
    } else {
      // Continue the slide. Steer-with extends slip; steer-against pulls tight.
      const sameDir = inputSign === car.driftDir;
      const angleHold = sameDir ? 1.0 : 0.55;
      car.lateralV += car.driftDir * angleHold * 14 * dt * Math.max(0.2, Math.abs(inputSteer));
      const maxLateral = 22 * speedPctNow;
      if (Math.abs(car.lateralV) > maxLateral) car.lateralV = Math.sign(car.lateralV) * maxLateral;
    }
  }

  if (car.driftActive) {
    car.driftDuration += dt;
    const sameDir = inputSign === car.driftDir;
    car.driftCharge = Math.min(1, car.driftCharge + dt * (sameDir ? 0.95 : 0.5));
  }
}

function stepLateral(car, dt) {
  const grip = (car.driftActive ? DRIFT_GRIP : GRIP) * car.stats.grip;
  const speedPct = Math.abs(car.speed) / car.maxSpeed;
  // Trail-braking: holding brake while turning amplifies steering authority,
  // letting the rear rotate into the corner.
  const input = car._lastInput || {};
  const trailFactor = (input.brake && Math.abs(car.steer) > 0.18) ? (1 + TRAIL_BRAKE_BOOST) : 1;
  // Tire load transfer — front grip increases under braking (more steering
  // authority), decreases under throttle. Subtle but adds "fluid" feel.
  let loadFactor = 1.0;
  if (input.brake) loadFactor = 1.18;
  else if (input.throttle) loadFactor = 0.94;
  const sideKick = car.steer * STEER_AUTHORITY * trailFactor * car.stats.handling * speedPct * loadFactor;
  car.lateralV += sideKick * dt * (car.driftActive ? 11 : 4);
  // Grip damping — slightly stronger when not drifting so the car settles
  // smoothly toward 0 lateral instead of feeling jittery on straights.
  const dampMul = car.driftActive ? 1.0 : 1.18;
  car.lateralV -= car.lateralV * Math.min(1, grip * dt * dampMul);
}

function stepIntegrate(car, dt) {
  const sin = Math.sin(car.heading);
  const cos = Math.cos(car.heading);
  car.group.position.x += sin * car.speed * dt + cos * car.lateralV * dt;
  car.group.position.z += cos * car.speed * dt + (-sin) * car.lateralV * dt;
}

function stepTrack(car, dt, track) {
  if (!track) return;
  const proj = track.project(car.group.position);
  const limit = track.halfWidth + 0.85;
  car.barrierHit = false;
  if (Math.abs(proj.lateral) > limit) {
    const overshoot = Math.abs(proj.lateral) - limit;
    const dirSign = Math.sign(proj.lateral);
    const t = track.tangents[proj.segmentIndex];
    // Push the car back to the limit, then add a slight bounce-velocity
    // INWARD so we don't get "stuck" against the wall every frame.
    car.group.position.x -= -t.z * dirSign * (overshoot + 0.02);
    car.group.position.z -= t.x * dirSign * (overshoot + 0.02);
    if (Math.abs(car.speed) > 22 && !car._lastBarrier) {
      car.barrierHit = true;
      car.speed *= 0.74;     // bigger initial speed bleed on first contact
      car.lateralV = -car.lateralV * 0.55 - dirSign * 4;   // bounce inward
    } else {
      // Continuous scrape — gentler drag so the player can recover by steering away.
      car.speed *= 0.97;
      car.lateralV = -dirSign * 2;     // push inward gently
    }
    car._lastBarrier = true;
  } else if (Math.abs(proj.lateral) > track.halfWidth) {
    car.speed -= Math.sign(car.speed) * OFF_ROAD_DRAG * 0.4 * dt;
    car._lastBarrier = false;
  } else {
    car._lastBarrier = false;
  }
  const target = track.points[proj.segmentIndex].y;
  car.group.position.y += (target + 0.4 - car.group.position.y) * Math.min(1, dt * 8);
}

function stepBody(car, dt) {
  const speedPct = Math.abs(car.speed) / car.maxSpeed;

  // Pitch: nose down on brake, lift on accel.
  const pitchTarget = -car._accelInput * 0.06 * Math.min(1, speedPct * 1.6);
  car.pitch += (pitchTarget - car.pitch) * Math.min(1, dt * 6);

  // Roll: lean opposite to corner G. car.steer carries the internal sign
  // flip (steer +ve = LEFT turn), so positive car.steer should produce
  // negative Z roll (lean right). Pass car.steer directly — three.js Z
  // rotation negative = clockwise looking forward = right lean. The internal
  // sign aligns this naturally with input direction.
  const rollTarget = -car.steer * 0.10 * speedPct * (car.driftActive ? 1.6 : 1.0);
  car.roll += (rollTarget - car.roll) * Math.min(1, dt * 8);

  // Drift slip-angle yaw: car visibly rotates so the front points INTO the
  // corner while the rear washes outward. If lateralV is positive (sliding
  // world +X i.e. car's right), the front should aim slightly LEFT of motion
  // — which in three.js Y-rotation is +ve.
  let yawTarget = 0;
  if (car.driftActive) {
    yawTarget = Math.sign(car.lateralV) * Math.min(0.5, Math.abs(car.lateralV) * 0.045);
  }
  car.bodyYaw += (yawTarget - car.bodyYaw) * Math.min(1, dt * 7);

  car.bodyY = Math.sin(performance.now() * 0.006) * 0.02 * speedPct;
  car.group.rotation.set(car.pitch, car.heading + car.bodyYaw, car.roll);
}

// ============================================================
export const SPOILER_OPTIONS = ["none", "lip", "ducktail", "deck", "wing"];

export function createCar(shapeId = "gt", livery = null) {
  const baseShape = CAR_SHAPES[shapeId] || CAR_SHAPES.gt;
  const shape = {
    ...baseShape,
    body: livery?.body ?? baseShape.body,
    stripe: livery?.stripe ?? baseShape.stripe,
    accent: livery?.accent ?? 0xc8d4e6,
    spoiler: (livery?.spoiler && SPOILER_OPTIONS.includes(livery.spoiler))
      ? (livery.spoiler === "none" ? null : livery.spoiler)
      : baseShape.spoiler
  };
  const group = buildBody(shape);
  const stats = shape.stats;
  const maxSpeed = BASE_MAX_SPEED * stats.top;
  const _gearProfile = GEAR_PROFILES[shapeId] || GEAR_PROFILES.gt;

  const car = {
    group,
    shape: shapeId,
    stats,
    livery: { body: shape.body, stripe: shape.stripe },
    maxSpeed,
    _gearProfile,
    // Kinematic state.
    speed: 0,
    lateralV: 0,
    heading: 0,
    steer: 0,
    // Boost state.
    boostT: 0,
    boostMeter: 0.5,
    boostCooldown: 0,
    // Drift state machine.
    driftActive: false,
    driftDuration: 0,
    driftCharge: 0,
    driftDir: 0,
    // Engine heat.
    engineHeat: 0,
    overheating: false,
    // Gears.
    gear: 1,
    rpm: 900,
    shiftCooldown: 0,
    shiftEvent: 0,         // -1 = downshift, +1 = upshift, 0 = none. Cleared by main loop.
    // Slipstream + perfect-launch.
    draftAmount: 0,        // 0..1, set externally each tick by main loop.
    raceLiveTime: null,    // seconds since lights-out, set by main loop.
    launchEvent: false,    // rising edge for perfect-launch surge — read+clear in main.
    _launchUsed: false,
    // Visual body weight transfer.
    pitch: 0,
    roll: 0,
    bodyY: 0,
    bodyYaw: 0,
    // Hidden scratch.
    _accelInput: 0,
    _lastInput: null,

    tick(dt, input, track) {
      stepInput(car, input, dt);
      stepDrivetrain(car, input, dt);
      stepHeading(car, dt);
      stepDrift(car, input, dt);
      stepLateral(car, dt);
      stepIntegrate(car, dt);
      stepTrack(car, dt, track);
      stepBody(car, dt);
    }
  };
  return car;
}
