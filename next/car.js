import * as THREE from "three";

// Arcade 3D car physics with per-shape stats.

const BASE_MAX_SPEED = 65;
const ACCEL = 18;
const BRAKE = 36;
const DRAG = 4;
const OFF_ROAD_DRAG = 24;
const STEER_RATE = 2.6;
const STEER_MAX = 0.7;
const GRIP = 12;
const DRIFT_GRIP = 4.5;
const BOOST_MUL = 1.22;
const STEER_AUTHORITY = 1.8;

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
    stats: { top: 0.92, accel: 1.05, handling: 1.18, grip: 0.78 },
    spoiler: "lip"
  },
  rally: {
    label: "Rally Sedan",
    description: "AWD-ish grip. Punches out of corners and brakes hard.",
    body: 0xff315c, stripe: 0xffd166,
    width: 1.85, height: 0.8, length: 4.2,
    cabin: { w: 1.6, h: 0.65, l: 2.1, z: -0.1 },
    stats: { top: 0.96, accel: 1.04, handling: 0.98, grip: 1.18 },
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

export function createCar(shapeId = "gt") {
  const shape = CAR_SHAPES[shapeId] || CAR_SHAPES.gt;
  const group = new THREE.Group();

  const bodyGeo = new THREE.BoxGeometry(shape.width, shape.height, shape.length);
  const bodyMat = new THREE.MeshStandardMaterial({ color: shape.body, metalness: 0.4, roughness: 0.5 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = shape.height * 0.85;
  group.add(body);

  // Cabin
  const cabinGeo = new THREE.BoxGeometry(shape.cabin.w, shape.cabin.h, shape.cabin.l);
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x121828, metalness: 0.2, roughness: 0.3 });
  const cabin = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.position.set(0, shape.height * 0.85 + shape.height * 0.5 + shape.cabin.h * 0.5 - 0.1, shape.cabin.z);
  group.add(cabin);

  // Glass
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x2ee9ff, metalness: 0.0, roughness: 0.1, transparent: true, opacity: 0.35 });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(shape.cabin.w * 0.95, shape.cabin.h * 0.92, shape.cabin.l * 0.92), glassMat);
  glass.position.copy(cabin.position);
  group.add(glass);

  // Stripe
  const stripeMat = new THREE.MeshStandardMaterial({ color: shape.stripe, metalness: 0.1, roughness: 0.4 });
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.30, shape.height + 0.02, shape.length + 0.02), stripeMat);
  stripe.position.y = shape.height * 0.85;
  group.add(stripe);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.40, 0.40, 0.30, 16);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0e18, roughness: 0.9 });
  const wx = shape.width * 0.5 - 0.06;
  const wzF = shape.length * 0.36;
  const wzR = -shape.length * 0.36;
  const wheelPositions = [
    [-wx, 0.40, wzF],
    [ wx, 0.40, wzF],
    [-wx, 0.40, wzR],
    [ wx, 0.40, wzR]
  ];
  for (const [x, y, z] of wheelPositions) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, y, z);
    group.add(w);
  }

  // Spoiler per shape.
  if (shape.spoiler === "wing") {
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x10131e, metalness: 0.4, roughness: 0.5 });
    const wing = new THREE.Mesh(new THREE.BoxGeometry(shape.width * 0.95, 0.06, 0.34), wingMat);
    wing.position.set(0, shape.height * 0.85 + shape.height * 0.5 + 0.5, -shape.length * 0.42);
    group.add(wing);
    // Risers
    for (const side of [-1, 1]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.46, 0.10), wingMat);
      r.position.set(side * shape.width * 0.32, shape.height * 0.85 + shape.height * 0.5 + 0.27, -shape.length * 0.42);
      group.add(r);
    }
  } else if (shape.spoiler === "ducktail") {
    const tailMat = new THREE.MeshStandardMaterial({ color: shape.body, metalness: 0.4, roughness: 0.5 });
    const tail = new THREE.Mesh(new THREE.BoxGeometry(shape.width * 0.85, 0.10, 0.36), tailMat);
    tail.position.set(0, shape.height * 0.85 + shape.height * 0.55, -shape.length * 0.40);
    group.add(tail);
  } else if (shape.spoiler === "deck") {
    const tailMat = new THREE.MeshStandardMaterial({ color: 0x10131e });
    const tail = new THREE.Mesh(new THREE.BoxGeometry(shape.width * 0.95, 0.06, 0.20), tailMat);
    tail.position.set(0, shape.height * 0.85 + shape.height * 0.5 + 0.12, -shape.length * 0.46);
    group.add(tail);
  } else if (shape.spoiler === "lip") {
    const lipMat = new THREE.MeshStandardMaterial({ color: 0x0a0d18 });
    const lip = new THREE.Mesh(new THREE.BoxGeometry(shape.width * 0.85, 0.05, 0.20), lipMat);
    lip.position.set(0, shape.height * 0.18, -shape.length * 0.44);
    group.add(lip);
  }

  // Headlights
  const headLightL = new THREE.SpotLight(0xfff5d4, 1.5, 60, Math.PI / 6, 0.4, 1.5);
  headLightL.position.set(-shape.width * 0.32, 0.5, shape.length * 0.46);
  headLightL.target.position.set(-shape.width * 0.32, 0.4, 25);
  group.add(headLightL);
  group.add(headLightL.target);
  const headLightR = new THREE.SpotLight(0xfff5d4, 1.5, 60, Math.PI / 6, 0.4, 1.5);
  headLightR.position.set(shape.width * 0.32, 0.5, shape.length * 0.46);
  headLightR.target.position.set(shape.width * 0.32, 0.4, 25);
  group.add(headLightR);
  group.add(headLightR.target);
  const lensMat = new THREE.MeshBasicMaterial({ color: 0xfff5d4 });
  for (const side of [-1, 1]) {
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.18, 0.10), lensMat);
    lens.position.set(side * shape.width * 0.32, 0.55, shape.length * 0.50);
    group.add(lens);
  }
  // Tail lights
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff315c });
  for (const side of [-1, 1]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.15, 0.10), tailMat);
    tail.position.set(side * shape.width * 0.30, 0.62, -shape.length * 0.50);
    group.add(tail);
  }

  const stats = shape.stats;
  const maxSpeed = BASE_MAX_SPEED * stats.top;

  const car = {
    group,
    shape: shapeId,
    maxSpeed,
    speed: 0,
    lateralV: 0,
    heading: 0,
    steer: 0,
    boostT: 0,
    // Drift state machine.
    driftActive: false,
    driftDuration: 0,
    driftCharge: 0,    // 0..1 — fills as you sustain a drift
    driftDir: 0,       // sign of yaw error during the drift
    boostMeter: 0.5,   // 0..1, displayable
    boostCooldown: 0,  // refractory between boost activations
    // Pitch / roll for visible weight transfer.
    pitch: 0,
    roll: 0,
    bodyY: 0,

    tick(dt, input, track) {
      // ---- Steering ----
      const targetSteer = -(input.steer || 0) * STEER_MAX;
      car.steer += (targetSteer - car.steer) * Math.min(1, dt * 16);

      // ---- Throttle / brake / coast ----
      let accelInput = 0; // for body pitch
      if (input.brake) {
        car.speed -= BRAKE * dt;
        accelInput = -1;
      } else if (input.throttle) {
        car.speed += ACCEL * stats.accel * dt;
        accelInput = 1;
      } else {
        car.speed -= Math.sign(car.speed) * DRAG * dt;
        if (Math.abs(car.speed) < DRAG * dt) car.speed = 0;
      }

      // ---- Boost ----
      car.boostCooldown = Math.max(0, car.boostCooldown - dt);
      const canBoost = input.boost && car.boostMeter > 0.05 && car.boostCooldown <= 0 && Math.abs(car.speed) > 12;
      if (canBoost) {
        car.speed += ACCEL * 0.85 * dt;
        car.boostT = 0.5;
        car.boostMeter = Math.max(0, car.boostMeter - 0.45 * dt);
        if (car.boostMeter <= 0.001) car.boostCooldown = 0.7; // force a refractory after burning out
      }
      car.boostT = Math.max(0, car.boostT - dt);

      const ceiling = maxSpeed * (car.boostT > 0 ? BOOST_MUL : 1);
      car.speed = Math.max(-maxSpeed * 0.5, Math.min(ceiling, car.speed));

      // ---- Heading change ----
      const speedPct = Math.abs(car.speed) / maxSpeed;
      const yaw = car.steer * STEER_RATE * stats.handling * (1 - speedPct * 0.45) * Math.sign(car.speed || 1) * dt;
      car.heading += yaw;

      // ---- Drift state machine ----
      const driftEligible = input.drift && Math.abs(car.steer) > 0.18 && car.speed > 18;
      if (driftEligible && !car.driftActive) {
        // Initiate drift — kick the rear out.
        car.driftActive = true;
        car.driftDuration = 0;
        car.driftCharge = 0;
        car.driftDir = Math.sign(car.steer || 1);
        car.lateralV += car.driftDir * 6;  // initiation kick
      } else if (!driftEligible && car.driftActive) {
        // Drift release — give a boost reward proportional to charge.
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
        // Charge fills with sustained drift; longer drift = more reward, capped.
        car.driftCharge = Math.min(1, car.driftCharge + dt * 0.7);
      }

      // ---- Lateral grip & slip ----
      const grip = (car.driftActive ? DRIFT_GRIP : GRIP) * stats.grip;
      const sideKick = car.steer * STEER_AUTHORITY * stats.handling * speedPct;
      car.lateralV += sideKick * dt * (car.driftActive ? 11 : 4);
      car.lateralV -= car.lateralV * Math.min(1, grip * dt);

      // ---- Move ----
      const sin = Math.sin(car.heading);
      const cos = Math.cos(car.heading);
      const fx = sin * car.speed * dt;
      const fz = cos * car.speed * dt;
      const lx = cos * car.lateralV * dt;
      const lz = -sin * car.lateralV * dt;
      car.group.position.x += fx + lx;
      car.group.position.z += fz + lz;

      // ---- Barrier clamp / off-road / track height ----
      if (track) {
        const proj = track.project(car.group.position);
        const limit = track.halfWidth + 0.85;
        if (Math.abs(proj.lateral) > limit) {
          const overshoot = Math.abs(proj.lateral) - limit;
          const dirSign = Math.sign(proj.lateral);
          const segIdx = proj.segmentIndex;
          const t = track.tangents[segIdx];
          const rightX = -t.z;
          const rightZ = t.x;
          car.group.position.x -= rightX * dirSign * (overshoot + 0.05);
          car.group.position.z -= rightZ * dirSign * (overshoot + 0.05);
          car.speed *= 0.86;
          car.lateralV = -car.lateralV * 0.4;
        } else if (Math.abs(proj.lateral) > track.halfWidth) {
          car.speed -= Math.sign(car.speed) * OFF_ROAD_DRAG * 0.4 * dt;
        }
        const target = track.points[proj.segmentIndex].y;
        car.group.position.y += (target + 0.4 - car.group.position.y) * Math.min(1, dt * 8);
      }

      // ---- Body weight transfer (visible pitch + roll) ----
      // Pitch: nose down on brake, up on accel.
      const pitchTarget = -accelInput * 0.05 * Math.min(1, speedPct * 1.6);
      car.pitch += (pitchTarget - car.pitch) * Math.min(1, dt * 6);
      // Roll: lean opposite to corner G-force; intensified during drift.
      const rollTarget = car.steer * 0.10 * speedPct * (car.driftActive ? 1.6 : 1.0);
      car.roll += (rollTarget - car.roll) * Math.min(1, dt * 8);
      // Subtle vertical bob from suspension.
      car.bodyY = Math.sin(performance.now() * 0.006) * 0.02 * speedPct;
      car.group.rotation.set(car.pitch, car.heading, car.roll);
    }
  };

  return car;
}
