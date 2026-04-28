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
const BASE_MAX_SPEED = 78;       // m/s, was 65 — gives the player more headroom
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

// Engine heat — much more forgiving than before.
const HEAT_THRESHOLD = 0.97;     // only above 97% of max
const HEAT_BUILD_RATE = 0.10;    // /s
const HEAT_VENT_RATE = 0.18;     // /s
const HEAT_VENT_BAND = 0.85;     // vent if speed below 85% or off-throttle
const HEAT_OVERHEAT = 0.97;
const HEAT_RECOVER = 0.55;
const HEAT_CAP_MUL = 0.92;       // heat-tripped top speed = 92% (was 88)

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
  }
};

// Helper for material consistency.
function pbr(color, metalness = 0.4, roughness = 0.5) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

function buildBody(shape) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(shape.width, shape.height, shape.length), pbr(shape.body, 0.4, 0.5));
  body.position.y = shape.height * 0.85;
  group.add(body);

  // Cabin
  const cabinGeo = new THREE.BoxGeometry(shape.cabin.w, shape.cabin.h, shape.cabin.l);
  const cabin = new THREE.Mesh(cabinGeo, pbr(0x121828, 0.2, 0.3));
  cabin.position.set(0, shape.height * 0.85 + shape.height * 0.5 + shape.cabin.h * 0.5 - 0.1, shape.cabin.z);
  group.add(cabin);

  // Glass
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x2ee9ff, metalness: 0.0, roughness: 0.1, transparent: true, opacity: 0.32
  });
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(shape.cabin.w * 0.95, shape.cabin.h * 0.92, shape.cabin.l * 0.92),
    glassMat
  );
  glass.position.copy(cabin.position);
  group.add(glass);

  // Stripe
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.30, shape.height + 0.02, shape.length + 0.02),
    pbr(shape.stripe, 0.1, 0.4)
  );
  stripe.position.y = shape.height * 0.85;
  group.add(stripe);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.40, 0.40, 0.30, 16);
  const wheelMat = pbr(0x0a0e18, 0.0, 0.9);
  const wx = shape.width * 0.5 - 0.06;
  const wzF = shape.length * 0.36;
  const wzR = -shape.length * 0.36;
  for (const [x, z] of [[-wx, wzF], [wx, wzF], [-wx, wzR], [wx, wzR]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.40, z);
    group.add(w);
  }

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

  // Throttle / brake / coast.
  if (input.brake) {
    car.speed -= BRAKE * dt;
    car._accelInput = -1;
  } else if (input.throttle) {
    car.speed += ACCEL * stats.accel * dt;
    car._accelInput = 1;
  } else {
    car.speed -= Math.sign(car.speed) * DRAG * dt;
    if (Math.abs(car.speed) < DRAG * dt) car.speed = 0;
    car._accelInput = 0;
  }

  // Boost (refractory + meter).
  car.boostCooldown = Math.max(0, car.boostCooldown - dt);
  const canBoost = input.boost && car.boostMeter > 0.05 && car.boostCooldown <= 0 && Math.abs(car.speed) > 12;
  if (canBoost) {
    car.speed += ACCEL * 1.0 * dt;
    car.boostT = 0.5;
    car.boostMeter = Math.max(0, car.boostMeter - 0.45 * dt);
    if (car.boostMeter <= 0.001) car.boostCooldown = 0.7;
  }
  car.boostT = Math.max(0, car.boostT - dt);

  // Engine heat — much more forgiving now.
  const speedFraction = Math.abs(car.speed) / car.maxSpeed;
  if (speedFraction > HEAT_THRESHOLD && input.throttle) {
    car.engineHeat = Math.min(1, car.engineHeat + dt * HEAT_BUILD_RATE);
  } else if (speedFraction < HEAT_VENT_BAND || !input.throttle) {
    car.engineHeat = Math.max(0, car.engineHeat - dt * HEAT_VENT_RATE);
  }
  if (car.engineHeat >= HEAT_OVERHEAT) car.overheating = true;
  if (car.engineHeat < HEAT_RECOVER) car.overheating = false;

  // Apply ceiling.
  const heatCap = car.overheating ? HEAT_CAP_MUL : 1.0;
  const ceiling = car.maxSpeed * heatCap * (car.boostT > 0 ? BOOST_MUL : 1);
  car.speed = Math.max(-car.maxSpeed * 0.5, Math.min(ceiling, car.speed));
}

function stepHeading(car, dt) {
  const speedPct = Math.abs(car.speed) / car.maxSpeed;
  const yaw = car.steer * STEER_RATE * car.stats.handling
            * (1 - speedPct * 0.45) * Math.sign(car.speed || 1) * dt;
  car.heading += yaw;
}

function stepDrift(car, input, dt) {
  const driftEligible = input.drift && Math.abs(car.steer) > 0.18 && car.speed > 18;
  if (driftEligible && !car.driftActive) {
    car.driftActive = true;
    car.driftDuration = 0;
    car.driftCharge = 0;
    car.driftDir = Math.sign(car.steer || 1);
    car.lateralV += car.driftDir * 6;
  } else if (!driftEligible && car.driftActive) {
    car.driftActive = false;
    if (car.driftDuration > 0.5) {
      const reward = Math.min(0.35, car.driftCharge * 0.5);
      car.boostMeter = Math.min(1, car.boostMeter + reward);
      car.boostT = 0.4;
    }
    car.driftDuration = 0;
    car.driftCharge = 0;
  }
  if (car.driftActive) {
    car.driftDuration += dt;
    car.driftCharge = Math.min(1, car.driftCharge + dt * 0.7);
  }
}

function stepLateral(car, dt) {
  const grip = (car.driftActive ? DRIFT_GRIP : GRIP) * car.stats.grip;
  const speedPct = Math.abs(car.speed) / car.maxSpeed;
  const sideKick = car.steer * STEER_AUTHORITY * car.stats.handling * speedPct;
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
  const pitchTarget = -car._accelInput * 0.05 * Math.min(1, speedPct * 1.6);
  car.pitch += (pitchTarget - car.pitch) * Math.min(1, dt * 6);
  const rollTarget = car.steer * 0.10 * speedPct * (car.driftActive ? 1.6 : 1.0);
  car.roll += (rollTarget - car.roll) * Math.min(1, dt * 8);
  car.bodyY = Math.sin(performance.now() * 0.006) * 0.02 * speedPct;
  car.group.rotation.set(car.pitch, car.heading, car.roll);
}

// ============================================================
export function createCar(shapeId = "gt") {
  const shape = CAR_SHAPES[shapeId] || CAR_SHAPES.gt;
  const group = buildBody(shape);
  const stats = shape.stats;
  const maxSpeed = BASE_MAX_SPEED * stats.top;

  const car = {
    group,
    shape: shapeId,
    stats,
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
    // Visual body weight transfer.
    pitch: 0,
    roll: 0,
    bodyY: 0,
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
