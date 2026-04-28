import * as THREE from "three";

// Arcade 3D car physics. State lives on the returned object so it can be inspected.
//
// Coordinates: Y is up. Heading is measured clockwise from +Z (so heading=0 points along +Z).
// Forward velocity travels along (sin(heading), 0, cos(heading)). Lateral is perpendicular.

const MAX_SPEED = 65;       // m/s, ~234 km/h displayed
const ACCEL = 18;           // m/s²
const BRAKE = 36;           // m/s²
const DRAG = 4;             // m/s² coast-down
const OFF_ROAD_DRAG = 24;   // m/s² off-road
const STEER_RATE = 2.6;     // rad/s lock rate
const STEER_MAX = 0.7;      // rad max steering input
const GRIP = 12;            // lateral velocity decay /s
const DRIFT_GRIP = 4.5;     // grip while drifting
const BOOST_MUL = 1.22;
const STEER_AUTHORITY = 1.8;

export function createCar() {
  const group = new THREE.Group();

  // Body — block with chamfered top.
  const bodyGeo = new THREE.BoxGeometry(1.8, 0.7, 4.0);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xfbfdff, metalness: 0.4, roughness: 0.5 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.6;
  group.add(body);

  // Cabin/greenhouse.
  const cabinGeo = new THREE.BoxGeometry(1.55, 0.55, 2.0);
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x121828, metalness: 0.2, roughness: 0.3 });
  const cabin = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.position.set(0, 1.1, -0.2);
  group.add(cabin);

  // Windshield reflection plate — slight cyan tint.
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x2ee9ff, metalness: 0.0, roughness: 0.1, transparent: true, opacity: 0.35 });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.5, 1.85), glassMat);
  glass.position.set(0, 1.12, -0.2);
  group.add(glass);

  // Stripe down the centre.
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xff315c, metalness: 0.1, roughness: 0.4 });
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.71, 4.02), stripeMat);
  stripe.position.y = 0.6;
  group.add(stripe);

  // Wheels — 4 cylinders.
  const wheelGeo = new THREE.CylinderGeometry(0.40, 0.40, 0.30, 16);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0e18, roughness: 0.9 });
  const wheelPositions = [
    [-0.95, 0.40,  1.4],
    [ 0.95, 0.40,  1.4],
    [-0.95, 0.40, -1.4],
    [ 0.95, 0.40, -1.4]
  ];
  for (const [x, y, z] of wheelPositions) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, y, z);
    group.add(w);
  }

  // Headlights as point sources + glowy lenses.
  const headLightL = new THREE.SpotLight(0xfff5d4, 1.5, 60, Math.PI / 6, 0.4, 1.5);
  headLightL.position.set(-0.6, 0.5, 1.95);
  headLightL.target.position.set(-0.6, 0.4, 25);
  group.add(headLightL);
  group.add(headLightL.target);
  const headLightR = headLightL.clone();
  headLightR.position.set(0.6, 0.5, 1.95);
  headLightR.target.position.set(0.6, 0.4, 25);
  group.add(headLightR);
  group.add(headLightR.target);
  // Headlight lenses (visible light cones).
  const lensMat = new THREE.MeshBasicMaterial({ color: 0xfff5d4 });
  for (const side of [-1, 1]) {
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.18, 0.10), lensMat);
    lens.position.set(side * 0.6, 0.55, 2.0);
    group.add(lens);
  }
  // Tail lights.
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff315c });
  for (const side of [-1, 1]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.15, 0.10), tailMat);
    tail.position.set(side * 0.55, 0.62, -2.0);
    group.add(tail);
  }

  const car = {
    group,
    speed: 0,             // m/s along heading
    lateralV: 0,          // m/s perpendicular to heading (slide)
    heading: 0,           // radians, around Y axis
    steer: 0,             // current steering input -1..1
    boostT: 0,            // boost decay timer

    // Tick advances physics by dt seconds based on input { steer, throttle, brake, drift, boost }.
    tick(dt, input, track) {
      // Steer is inverted relative to input convention so pressing right turns visually right.
      const targetSteer = -(input.steer || 0) * STEER_MAX;
      car.steer += (targetSteer - car.steer) * Math.min(1, dt * 14);

      // Throttle / brake / coast.
      if (input.brake) {
        car.speed -= BRAKE * dt;
      } else if (input.throttle) {
        car.speed += ACCEL * dt;
      } else {
        // Coast-down toward 0.
        car.speed -= Math.sign(car.speed) * DRAG * dt;
        if (Math.abs(car.speed) < DRAG * dt) car.speed = 0;
      }

      // Boost.
      if (input.boost) {
        car.speed += ACCEL * 0.6 * dt;
        car.boostT = 0.4;
      }
      car.boostT = Math.max(0, car.boostT - dt);

      const ceiling = MAX_SPEED * (car.boostT > 0 ? BOOST_MUL : 1);
      car.speed = Math.max(-MAX_SPEED * 0.5, Math.min(ceiling, car.speed));

      // Heading change scales with speed (low-speed full lock, high-speed reduced).
      const speedPct = Math.abs(car.speed) / MAX_SPEED;
      const yaw = car.steer * STEER_RATE * (1 - speedPct * 0.45) * Math.sign(car.speed || 1) * dt;
      car.heading += yaw;

      // Lateral grip — drifts let the rear slide.
      const grip = input.drift ? DRIFT_GRIP : GRIP;
      // Steering also injects lateral velocity (the car pushes outward in turns).
      const sideKick = car.steer * STEER_AUTHORITY * speedPct;
      car.lateralV += sideKick * dt * (input.drift ? 9 : 4);
      // Decay lateral toward 0 at grip rate.
      car.lateralV -= car.lateralV * Math.min(1, grip * dt);

      // Move.
      const sin = Math.sin(car.heading);
      const cos = Math.cos(car.heading);
      const fx = sin * car.speed * dt;
      const fz = cos * car.speed * dt;
      // Lateral component is perpendicular to forward (right-hand rule with Y up).
      const lx = cos * car.lateralV * dt;
      const lz = -sin * car.lateralV * dt;
      car.group.position.x += fx + lx;
      car.group.position.z += fz + lz;

      // Track stickiness + barrier clamp: bounce off the wall if you reach the edge.
      if (track) {
        const proj = track.project(car.group.position);
        const limit = track.halfWidth + 0.7;  // matches barrier offset
        if (Math.abs(proj.lateral) > limit) {
          // Snap player back inside the road and scrub speed (hit the wall).
          const overshoot = Math.abs(proj.lateral) - limit;
          const dirSign = Math.sign(proj.lateral);
          // Compute the right vector at this segment to push back inward.
          const segIdx = proj.segmentIndex;
          const t = track.tangents[segIdx];
          const rightX = -t.z;  // right = (-tz, 0, tx) in this convention
          const rightZ = t.x;
          car.group.position.x -= rightX * dirSign * (overshoot + 0.05);
          car.group.position.z -= rightZ * dirSign * (overshoot + 0.05);
          // Speed loss on wall scrape, scaled by impact angle.
          car.speed *= 0.86;
          // Lateral velocity flipped + reduced — bounces off.
          car.lateralV = -car.lateralV * 0.4;
        } else if (Math.abs(proj.lateral) > track.halfWidth) {
          // On the kerb / shoulder: subtle drag, no clamp yet.
          car.speed -= Math.sign(car.speed) * OFF_ROAD_DRAG * 0.4 * dt;
        }
        // Settle vertical position to match track height.
        const target = track.points[proj.segmentIndex].y;
        car.group.position.y += (target + 0.4 - car.group.position.y) * Math.min(1, dt * 8);
      }

      // Apply rotation. Banking roll matches the now-inverted steering convention.
      car.group.rotation.set(0, car.heading, car.steer * 0.06);
    }
  };

  return car;
}
