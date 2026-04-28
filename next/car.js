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

// ---- Tuning knobs (rebalanced for faster overall feel) ----
const BASE_MAX_SPEED = 78;       // m/s
const ACCEL = 22;                // m/s² peak accel
const BRAKE = 42;                // m/s²
const DRAG = 4;                  // m/s² coast-down
const OFF_ROAD_DRAG = 24;        // m/s² off-road
const STEER_RATE = 2.7;          // rad/s lock rate
const STEER_MAX = 0.7;           // rad max
const GRIP = 12;                 // lateral velocity decay /s
const DRIFT_GRIP = 4.5;          // grip while drifting
const BOOST_MUL = 1.25;          // top-speed multiplier while boost engaged
const STEER_AUTHORITY = 1.85;    // lateral kick coefficient

// Engine heat.
const HEAT_THRESHOLD = 0.97;
const HEAT_BUILD_RATE = 0.10;
const HEAT_VENT_RATE = 0.18;
const HEAT_VENT_BAND = 0.85;
const HEAT_OVERHEAT = 0.97;
const HEAT_RECOVER = 0.55;
const HEAT_CAP_MUL = 0.92;

// Gears — RPM range per gear and shift thresholds.
const GEAR_COUNT = 6;
const GEAR_RATIOS = [3.6, 2.4, 1.8, 1.4, 1.1, 0.9];   // virtual ratios; not used for physics, only RPM display
const GEAR_REDLINE_RPM = 7800;
const GEAR_SHIFT_RPM = 7200;       // shift up at this RPM
const GEAR_DOWNSHIFT_RPM = 2400;   // shift down below this
const GEAR_SHIFT_TIME = 0.18;      // throttle cut window during shift

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

export const CAR_SHAPES = {
  gt: {
    label: "GT Coupe",
    description: "Smooth top-end weapon, planted in long sweepers.",
    body: 0xfbfdff, stripe: 0xff315c,
    width: 1.8, height: 0.7, length: 4.0,
    cabin: { w: 1.55, h: 0.55, l: 2.0, z: -0.2 },
    stats: { top: 1.04, accel: 1.0, handling: 1.0, grip: 1.05 },
    spoiler: "ducktail"
  },
  drift: {
    label: "Drift Coupe",
    description: "Loose rear, snappy steering. Slides easy.",
    body: 0xffe156, stripe: 0x101525,
    width: 1.7, height: 0.75, length: 3.8,
    cabin: { w: 1.45, h: 0.6, l: 1.8, z: 0 },
    stats: { top: 0.94, accel: 1.05, handling: 1.18, grip: 0.78 },
    spoiler: "lip"
  },
  rally: {
    label: "Rally Sedan",
    description: "AWD-ish grip. Punches out of corners and brakes hard.",
    body: 0xff315c, stripe: 0xffd166,
    width: 1.85, height: 0.8, length: 4.2,
    cabin: { w: 1.6, h: 0.65, l: 2.1, z: -0.1 },
    stats: { top: 0.98, accel: 1.04, handling: 0.98, grip: 1.18 },
    spoiler: "wing"
  },
  super: {
    label: "Wedge Super",
    description: "Top of the food chain. Massive top end.",
    body: 0xa66cff, stripe: 0xfbfdff,
    width: 1.95, height: 0.55, length: 4.4,
    cabin: { w: 1.5, h: 0.42, l: 1.7, z: -0.3 },
    stats: { top: 1.10, accel: 1.06, handling: 0.92, grip: 1.10 },
    spoiler: "deck"
  },
  // Lightweight track-day kei coupe. Slow top end but agile + grippy.
  kei: {
    label: "Kei Sport",
    description: "Tiny featherweight. Diabolical grip + razor handling.",
    body: 0x3cff9b, stripe: 0x101525,
    width: 1.55, height: 0.85, length: 3.4,
    cabin: { w: 1.30, h: 0.62, l: 1.6, z: 0 },
    stats: { top: 0.86, accel: 1.10, handling: 1.28, grip: 1.20 },
    spoiler: "ducktail"
  },
  // Big-power muscle GT. Huge accel + top end, sluggish handling.
  muscle: {
    label: "Hyper GT",
    description: "Brutal acceleration, momentum-based corner approach.",
    body: 0x141828, stripe: 0xff315c,
    width: 2.05, height: 0.62, length: 4.6,
    cabin: { w: 1.62, h: 0.50, l: 1.85, z: -0.15 },
    stats: { top: 1.14, accel: 1.10, handling: 0.86, grip: 0.96 },
    spoiler: "wing"
  }
};

// Helper for material consistency.
function pbr(color, metalness = 0.4, roughness = 0.5) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

// Build a tapered cabin (sloped windshield + sloped rear glass) using a custom
// 8-vertex BufferGeometry. Front top and rear top are pulled inward along Z so
// the silhouette reads like a real coupe rather than a stacked box.
export function buildSlopedCabin(w, h, l, zCenter, slopeFront = 0.30, slopeRear = 0.25) {
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

  const body = new THREE.Mesh(new THREE.BoxGeometry(shape.width, shape.height, shape.length * 0.94), pbr(shape.body, 0.4, 0.5));
  body.position.set(0, shape.height * 0.85, -shape.length * 0.03);
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
  const noseGeo = buildNoseWedge(shape.width * 0.96, shape.height * 0.6, shape.length * 0.22);
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.set(0, shape.height * 0.45, shape.length * 0.40);
  group.add(nose);

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
  // Tail lights.
  for (const side of [-1, 1]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.15, 0.10), new THREE.MeshBasicMaterial({ color: 0xff315c }));
    tail.position.set(side * shape.width * 0.30, 0.62, -shape.length * 0.50);
    group.add(tail);
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
  // Per-gear RPM = mapped from speedPct within band per gear.
  // Approximation: each gear handles speedPct band [g/COUNT, (g+1)/COUNT].
  const gear = Math.max(1, Math.min(GEAR_COUNT, car.gear || 1));
  const gearLo = (gear - 1) / GEAR_COUNT;
  const gearHi = gear / GEAR_COUNT;
  const inGear = Math.max(0, Math.min(1, (speedPctTop - gearLo) / Math.max(0.001, gearHi - gearLo)));
  car.rpm = 900 + inGear * (GEAR_REDLINE_RPM - 900);
  if (car.shiftCooldown <= 0) {
    if (car.rpm > GEAR_SHIFT_RPM && gear < GEAR_COUNT) {
      car.gear = gear + 1;
      car.shiftCooldown = GEAR_SHIFT_TIME;
      car.shiftEvent = 1;       // rising-edge — main loop reads + clears
    } else if (car.rpm < GEAR_DOWNSHIFT_RPM && gear > 1) {
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
  const sideKick = car.steer * STEER_AUTHORITY * trailFactor * car.stats.handling * speedPct;
  car.lateralV += sideKick * dt * (car.driftActive ? 11 : 4);
  car.lateralV -= car.lateralV * Math.min(1, grip * dt);
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
  if (Math.abs(proj.lateral) > limit) {
    const overshoot = Math.abs(proj.lateral) - limit;
    const dirSign = Math.sign(proj.lateral);
    const t = track.tangents[proj.segmentIndex];
    car.group.position.x -= -t.z * dirSign * (overshoot + 0.05);
    car.group.position.z -= t.x * dirSign * (overshoot + 0.05);
    car.speed *= 0.86;
    car.lateralV = -car.lateralV * 0.4;
  } else if (Math.abs(proj.lateral) > track.halfWidth) {
    car.speed -= Math.sign(car.speed) * OFF_ROAD_DRAG * 0.4 * dt;
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

  const car = {
    group,
    shape: shapeId,
    stats,
    livery: { body: shape.body, stripe: shape.stripe },
    maxSpeed,
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
