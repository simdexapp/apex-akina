import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { buildTrack, getTrackList } from "./track.js";
import { createCar, CAR_SHAPES } from "./car.js";
import { createInput } from "./input.js";
import { createRivals, tickRivals } from "./rivals.js";
import { ensureAudio, updateAudio, setAudioMuted, isAudioMuted } from "./audio.js";

// ---- Renderer / scene setup ----
const canvas = document.getElementById("game");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x1a1240, 60, 350);

// Sky shader.
const skyUniforms = {
  topColor: { value: new THREE.Color("#0a0f2c") },
  midColor: { value: new THREE.Color("#3a1656") },
  bottomColor: { value: new THREE.Color("#ff5f4c") },
  offset: { value: 200 }
};
{
  const skyGeo = new THREE.SphereGeometry(800, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: skyUniforms,
    vertexShader: `varying vec3 vWorld; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 topColor; uniform vec3 midColor; uniform vec3 bottomColor; uniform float offset; varying vec3 vWorld;
      void main() {
        float h = normalize(vWorld + vec3(0.0, offset, 0.0)).y;
        vec3 col = mix(bottomColor, midColor, smoothstep(-0.1, 0.4, h));
        col = mix(col, topColor, smoothstep(0.4, 1.0, h));
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
}

// Lighting (set up once, recolored per track).
const moonLight = new THREE.DirectionalLight(0xb6c8ff, 1.4);
moonLight.position.set(60, 110, 40);
scene.add(moonLight);
const hemi = new THREE.HemisphereLight(0x6688ff, 0x150828, 0.5);
scene.add(hemi);
const fillRed = new THREE.PointLight(0xff315c, 1.6, 260);
fillRed.position.set(-60, 40, -40);
scene.add(fillRed);
const fillCyan = new THREE.PointLight(0x2ee9ff, 1.2, 220);
fillCyan.position.set(60, 30, 80);
scene.add(fillCyan);

// Stars.
{
  const starCount = 500;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 350 + Math.random() * 200;
    const phi = Math.random() * Math.PI * 2;
    const theta = Math.random() * 0.6;
    positions[i * 3]     = Math.cos(phi) * Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.sin(theta) * r + 100;
    positions[i * 3 + 2] = Math.sin(phi) * Math.cos(theta) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xfbfdff, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0.85 });
  scene.add(new THREE.Points(geo, mat));
}

// ---- Track + car + rivals (loaded per track id) ----
const TRACKS_LIST = getTrackList();
const TRACK_KEY = "apex-akina-3d:track";
const initialTrackId = (() => {
  try {
    const saved = localStorage.getItem(TRACK_KEY);
    return saved && TRACKS_LIST.find((t) => t.id === saved) ? saved : "lakeside";
  } catch (_) { return "lakeside"; }
})();

let track = null;
let startPoint = null;

// ---- Player car (replaceable per shape) ----
const CAR_KEY = "apex-akina-3d:car";
const initialCarShape = (() => {
  try {
    const saved = localStorage.getItem(CAR_KEY);
    return saved && CAR_SHAPES[saved] ? saved : "gt";
  } catch (_) { return "gt"; }
})();

let boostFlame = null;
let car = createCar(initialCarShape);
scene.add(car.group);
attachBoostFlame();

function swapCar(shapeId) {
  if (!CAR_SHAPES[shapeId]) return;
  if (car) {
    scene.remove(car.group);
    if (boostFlame) car.group.remove(boostFlame);
  }
  car = createCar(shapeId);
  scene.add(car.group);
  attachBoostFlame();
  if (startPoint) {
    car.group.position.set(startPoint.x, startPoint.y + 0.8, startPoint.z);
    car.heading = startPoint.tangentAngle;
  }
  try { localStorage.setItem(CAR_KEY, shapeId); } catch (_) {}
}

// Boost flame: an emissive cone (or two) behind the rear bumper, pulsing on boost.
function attachBoostFlame() {
  const flame1 = new THREE.Mesh(
    new THREE.ConeGeometry(0.30, 1.6, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.0 })
  );
  flame1.rotation.x = Math.PI / 2;
  flame1.position.set(-0.6, 0.5, -2.3);
  const flame2 = flame1.clone();
  flame2.material = flame2.material.clone();
  flame2.position.x = 0.6;
  const inner1 = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 1.0, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x2ee9ff, transparent: true, opacity: 0.0 })
  );
  inner1.rotation.x = Math.PI / 2;
  inner1.position.set(-0.6, 0.5, -2.0);
  const inner2 = inner1.clone();
  inner2.material = inner2.material.clone();
  inner2.position.x = 0.6;
  boostFlame = new THREE.Group();
  boostFlame.add(flame1, flame2, inner1, inner2);
  car.group.add(boostFlame);
  boostFlame.userData = { flame1, flame2, inner1, inner2 };
}

let rivals = [];

function loadTrack(id) {
  if (track) {
    scene.remove(track.group);
  }
  track = buildTrack(id);
  scene.add(track.group);
  startPoint = track.sample(0);
  // Update sky + fog + lights from palette.
  skyUniforms.topColor.value.set(track.palette.sky.top);
  skyUniforms.midColor.value.set(track.palette.sky.mid);
  skyUniforms.bottomColor.value.set(track.palette.sky.bottom);
  scene.fog.color.setHex(track.palette.fog);
  moonLight.color.setHex(track.palette.moonLight);
  fillRed.color.setHex(track.palette.fillRed);
  fillCyan.color.setHex(track.palette.fillCyan);
  // Reset rivals.
  for (const r of rivals) scene.remove(r.mesh);
  rivals = createRivals(track, 8);
  for (const r of rivals) scene.add(r.mesh);
  // Place player.
  car.group.position.set(startPoint.x, startPoint.y + 0.8, startPoint.z);
  car.heading = startPoint.tangentAngle;
  try { localStorage.setItem(TRACK_KEY, id); } catch (_) {}
}

loadTrack(initialTrackId);

// ---- Camera ----
const BASE_FOV = 70;
const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.5, 1500);
let cameraShake = 0;       // current shake intensity, decays to 0
let fovPunch = 0;          // current fov delta over base, decays to 0
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
// Restrained bloom — keep the lights glowing but stop everything from looking neon-soaked.
const bloomPass = new UnrealBloomPass(new THREE.Vector2(canvas.clientWidth, canvas.clientHeight), 0.42, 0.55, 0.78);
composer.addPass(bloomPass);

function resize() {
  const rect = canvas.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  composer.setSize(rect.width, rect.height);
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener("resize", resize);

let cameraInitialised = false;
const CAMERA_PRESETS = {
  chase:   { offset: new THREE.Vector3(0, 4.5, -12), look: new THREE.Vector3(0, 1.5, 8) },
  hood:    { offset: new THREE.Vector3(0, 1.4, 0.5), look: new THREE.Vector3(0, 1.4, 30) },
  cinema:  { offset: new THREE.Vector3(-3.5, 2.5, -7), look: new THREE.Vector3(0, 1.0, 14) }
};
let cameraMode = "chase";
const cameraOffset = new THREE.Vector3();
const cameraLookOffset = new THREE.Vector3();
function applyCameraMode() {
  cameraOffset.copy(CAMERA_PRESETS[cameraMode].offset);
  cameraLookOffset.copy(CAMERA_PRESETS[cameraMode].look);
  cameraInitialised = false;
}
applyCameraMode();
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyC") {
    const order = ["chase", "hood", "cinema"];
    cameraMode = order[(order.indexOf(cameraMode) + 1) % order.length];
    applyCameraMode();
  }
});
const cameraTarget = new THREE.Vector3();
const cameraDesired = new THREE.Vector3();
const cameraSmoothPos = new THREE.Vector3();

function updateCamera(dt) {
  const sin = Math.sin(car.heading);
  const cos = Math.cos(car.heading);
  const ox = cameraOffset.x * cos + cameraOffset.z * sin;
  const oz = -cameraOffset.x * sin + cameraOffset.z * cos;
  cameraDesired.set(
    car.group.position.x + ox,
    car.group.position.y + cameraOffset.y,
    car.group.position.z + oz
  );
  if (!cameraInitialised) {
    cameraSmoothPos.copy(cameraDesired);
    cameraInitialised = true;
  } else {
    cameraSmoothPos.lerp(cameraDesired, Math.min(1, dt * 6));
  }
  // Apply camera shake + FOV punch (decay).
  if (cameraShake > 0) {
    const shake = cameraShake;
    cameraSmoothPos.x += (Math.random() - 0.5) * shake;
    cameraSmoothPos.y += (Math.random() - 0.5) * shake * 0.5;
    cameraShake = Math.max(0, cameraShake - dt * 4);
  }
  camera.position.copy(cameraSmoothPos);
  const lx = cameraLookOffset.x * cos + cameraLookOffset.z * sin;
  const lz = -cameraLookOffset.x * sin + cameraLookOffset.z * cos;
  cameraTarget.set(
    car.group.position.x + lx,
    car.group.position.y + cameraLookOffset.y,
    car.group.position.z + lz
  );
  camera.lookAt(cameraTarget);

  // FOV punch — subtle widen on boost activation, decays back to base.
  if (fovPunch > 0.01) {
    camera.fov = BASE_FOV + fovPunch;
    camera.updateProjectionMatrix();
    fovPunch = Math.max(0, fovPunch - dt * 22);
  } else if (camera.fov !== BASE_FOV) {
    camera.fov = BASE_FOV;
    camera.updateProjectionMatrix();
  }
}

// ---- Particle system (sparks + drift smoke) ----
const PARTICLE_CAP = 80;
const particles = [];
const particlePool = new THREE.Group();
scene.add(particlePool);

function spawnSpark(x, y, z, side) {
  if (particles.length >= PARTICLE_CAP) return;
  const geo = new THREE.SphereGeometry(0.18, 4, 4);
  const mat = new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? 0xffd166 : 0xff315c });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  particlePool.add(mesh);
  particles.push({
    mesh,
    vx: side * (4 + Math.random() * 6),
    vy: 2 + Math.random() * 4,
    vz: (Math.random() - 0.5) * 2,
    life: 0.4,
    type: "spark"
  });
}

function spawnSmoke(x, y, z) {
  if (particles.length >= PARTICLE_CAP) return;
  const geo = new THREE.SphereGeometry(0.5, 6, 6);
  const mat = new THREE.MeshBasicMaterial({ color: 0xeaeef5, transparent: true, opacity: 0.4 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  particlePool.add(mesh);
  particles.push({
    mesh, mat,
    vx: (Math.random() - 0.5) * 2,
    vy: 0.6 + Math.random() * 0.8,
    vz: (Math.random() - 0.5) * 2,
    life: 0.6,
    type: "smoke"
  });
}

function tickParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.life -= dt;
    if (p.type === "smoke") {
      p.mat.opacity = Math.max(0, p.life * 0.7);
      p.mesh.scale.multiplyScalar(1 + dt * 1.4);
    }
    if (p.life <= 0) {
      particlePool.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      particles.splice(i, 1);
    }
  }
}

// Boost meter is owned by the car module now (car.boostMeter). Keep this here
// for backwards-compat with HUD code: read from the car each frame.
function readBoost() { return car?.boostMeter ?? 0; }

// ---- Skid marks (drift trails) ----
const skidGroup = new THREE.Group();
scene.add(skidGroup);
const SKID_MAX = 200;
const skidQueue = [];

function spawnSkidPair() {
  // Two short black quads behind the rear wheels.
  const sin = Math.sin(car.heading);
  const cos = Math.cos(car.heading);
  // Local rear-axle position offset.
  const rearOffsetZ = -1.6;
  const rearWorldX = car.group.position.x + sin * rearOffsetZ;
  const rearWorldZ = car.group.position.z + cos * rearOffsetZ;
  // Right vector (perpendicular to heading) for tire offset.
  const rightX = cos;
  const rightZ = -sin;
  for (const side of [-1, 1]) {
    const tireX = rearWorldX + rightX * side * 0.85;
    const tireZ = rearWorldZ + rightZ * side * 0.85;
    const geo = new THREE.PlaneGeometry(0.20, 1.2);
    const mat = new THREE.MeshBasicMaterial({ color: 0x05060c, transparent: true, opacity: 0.55 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = car.heading;
    mesh.position.set(tireX, 0.06, tireZ);
    skidGroup.add(mesh);
    skidQueue.push({ mesh, mat, life: 4.0 });
    while (skidQueue.length > SKID_MAX) {
      const old = skidQueue.shift();
      skidGroup.remove(old.mesh);
      old.mesh.geometry.dispose();
      old.mat.dispose();
    }
  }
}

function tickSkids(dt) {
  for (let i = skidQueue.length - 1; i >= 0; i--) {
    const s = skidQueue[i];
    s.life -= dt;
    s.mat.opacity = Math.max(0, s.life * 0.14);
    if (s.life <= 0) {
      skidGroup.remove(s.mesh);
      s.mesh.geometry.dispose();
      s.mat.dispose();
      skidQueue.splice(i, 1);
    }
  }
}

function clearSkids() {
  while (skidQueue.length) {
    const s = skidQueue.shift();
    skidGroup.remove(s.mesh);
    s.mesh.geometry.dispose();
    s.mat.dispose();
  }
}

// ---- Combo / streak ----
let combo = 0;
let comboTimer = 0;
const COMBO_DECAY = 4.0;

function bumpCombo(amount, label) {
  const before = combo;
  combo += amount;
  comboTimer = COMBO_DECAY;
  if (Math.floor(combo / 5) > Math.floor(before / 5)) {
    if (car) car.boostMeter = Math.min(1, car.boostMeter + 0.25);
    flashCallout(`x${Math.floor(combo / 5) * 5}!`, 1100);
  } else if (label) {
    flashCallout(label, 700);
  }
}

// Lightweight callout shown briefly in centre of screen.
let calloutEl = null;
function flashCallout(text, ms) {
  if (!calloutEl) {
    calloutEl = document.createElement("div");
    calloutEl.className = "race-callout";
    document.querySelector(".game-frame")?.appendChild(calloutEl);
  }
  calloutEl.textContent = text;
  calloutEl.classList.add("is-visible");
  clearTimeout(calloutEl._t);
  calloutEl._t = setTimeout(() => calloutEl.classList.remove("is-visible"), ms);
}

// Near-miss tracking per rival.
const nearMissArmed = new WeakMap();
const lastDz = new WeakMap();
const NEAR_MISS_OUTER = 4.0; // metres lateral
const NEAR_MISS_INNER = 2.4; // inside this is a real collision

// ---- Loop ----
const input = createInput();
let lastTime = performance.now();
let running = false;
const FIXED_DT = 1 / 60;
let acc = 0;

const LAPS_TOTAL = 3;
let lap = 1;
let lastTrackS = 0;
let raceTime = 0;
let lapStartTime = 0;
let bestLapPerTrack = loadBestLaps();

function loadBestLaps() {
  try { return JSON.parse(localStorage.getItem("apex-akina-3d:bestLap") || "{}"); } catch (_) { return {}; }
}
function saveBestLaps() {
  try { localStorage.setItem("apex-akina-3d:bestLap", JSON.stringify(bestLapPerTrack)); } catch (_) {}
}

function tick(dt) {
  const i = input.read();
  car.tick(dt, i, track);
  // Boost mechanic — input.boost drains fuel, gives speed bump.
  // Boost is now driven inside car.tick — passive regen happens here.
  if (running && !i.boost && !car.driftActive) {
    car.boostMeter = Math.min(1, car.boostMeter + 0.06 * dt);
  }

  // Boost activation kick.
  if (car.boostJustFired) {
    cameraShake = Math.max(cameraShake, 0.30);
    fovPunch = Math.max(fovPunch, 9);
    flashCallout("BOOST", 380);
  }

  // Player's total race distance for rubber-band scaling.
  const playerProj = track.project(car.group.position);
  const playerTotal = lap * track.length + playerProj.s;
  tickRivals(rivals, dt, track, car, playerTotal);

  // Player–rival bump collisions + near-miss detection.
  for (const r of rivals) {
    const dx = car.group.position.x - r.mesh.position.x;
    const dz = car.group.position.z - r.mesh.position.z;
    const distSq = dx * dx + dz * dz;
    const dist = Math.sqrt(distSq);

    if (distSq < 6.5) {
      // Real collision.
      const safeDist = Math.max(0.5, dist);
      const push = 0.20 / safeDist;
      car.group.position.x += dx * push;
      car.group.position.z += dz * push;
      r.mesh.position.x -= dx * push * 0.6;
      r.mesh.position.z -= dz * push * 0.6;
      const closingFactor = Math.max(0, (car.speed - r.speed) / 60);
      car.speed *= 1 - 0.20 * closingFactor;
      const px = (car.group.position.x + r.mesh.position.x) * 0.5;
      const py = car.group.position.y + 0.6;
      const pz = (car.group.position.z + r.mesh.position.z) * 0.5;
      for (let k = 0; k < 4; k++) spawnSpark(px, py, pz, dx > 0 ? -1 : 1);
      combo = 0;
      nearMissArmed.set(r, false);
    } else if (dist < NEAR_MISS_OUTER && dist > NEAR_MISS_INNER) {
      // Inside the near-miss ring.
      // Compute signed dz along player heading (positive = rival ahead).
      const sin = Math.sin(car.heading);
      const cos = Math.cos(car.heading);
      // Player-forward dot (rival - player) in world space.
      const toRivalX = -dx;
      const toRivalZ = -dz;
      const forwardDot = toRivalX * sin + toRivalZ * cos;
      if (forwardDot > 0) {
        nearMissArmed.set(r, true);
      }
      const prevDot = lastDz.get(r) ?? forwardDot;
      // Pass detection: was ahead, now behind.
      if (prevDot > 0 && forwardDot <= 0 && nearMissArmed.get(r)) {
        const proximity = 1 - (dist - NEAR_MISS_INNER) / (NEAR_MISS_OUTER - NEAR_MISS_INNER);
        const intensity = Math.max(0.4, Math.min(1, proximity));
        car.speed = Math.min(car.maxSpeed * 1.3, car.speed + 4 * intensity);
        car.boostMeter = Math.min(1, car.boostMeter + 0.12 * intensity);
        bumpCombo(intensity > 0.7 ? 2 : 1, intensity > 0.7 ? "INCH" : "Close");
        nearMissArmed.set(r, false);
      }
      lastDz.set(r, forwardDot);
    } else {
      lastDz.set(r, undefined);
    }
  }

  // Skid marks while drifting (Space held + lateral velocity active).
  if (i.drift && Math.abs(car.lateralV) > 4 && Math.abs(car.speed) > 12) {
    spawnSkidPair();
  }
  tickSkids(dt);

  // Combo decay.
  if (comboTimer > 0) {
    comboTimer = Math.max(0, comboTimer - dt);
    if (comboTimer === 0) combo = 0;
  }

  // Drift smoke on hard slip.
  if (Math.abs(car.lateralV) > 8 && Math.random() < 0.6) {
    spawnSmoke(car.group.position.x, 0.4, car.group.position.z);
  }

  tickParticles(dt);
  raceTime += dt;
}


function computeStandings() {
  const trackLen = track.length;
  const playerProj = track.project(car.group.position);
  const playerTotal = lap * trackLen + playerProj.s;
  const entries = [{ name: "You", total: playerTotal, isPlayer: true }];
  for (const r of rivals) {
    entries.push({ name: r.name, total: r.laps * trackLen + r.s, isPlayer: false });
  }
  entries.sort((a, b) => b.total - a.total);
  const place = entries.findIndex((e) => e.isPlayer) + 1;
  return { place, entries };
}

function loop(now) {
  const dt = Math.min(0.25, (now - lastTime) / 1000);
  lastTime = now;
  if (running) {
    acc += dt;
    while (acc >= FIXED_DT) {
      tick(FIXED_DT);
      acc -= FIXED_DT;
    }
  }
  updateCamera(dt);

  // Lap detection: when projected.s wraps from near end back to near start.
  const projected = track.project(car.group.position);
  if (projected.s < lastTrackS - track.length * 0.5 && running) {
    const lapTime = raceTime - lapStartTime;
    if (lap >= 1) {
      const prev = bestLapPerTrack[track.id];
      if (!prev || lapTime < prev) {
        bestLapPerTrack[track.id] = lapTime;
        saveBestLaps();
      }
    }
    lap = Math.min(LAPS_TOTAL, lap + 1);
    lapStartTime = raceTime;
  }
  lastTrackS = projected.s;

  // Audio.
  const lastInput = input.read();
  updateAudio({
    speed: car.speed,
    maxSpeed: 65,
    lateralSlip: car.lateralV / 25,
    throttle: lastInput.throttle,
    brake: lastInput.brake,
    racing: running
  });

  // Boost flame opacity reflects boost state.
  if (boostFlame) {
    const boostOn = car.boostT > 0;
    const flicker = 0.7 + Math.sin(performance.now() * 0.03) * 0.25 + Math.random() * 0.1;
    const target = boostOn ? flicker : 0;
    boostFlame.userData.flame1.material.opacity += (target * 0.78 - boostFlame.userData.flame1.material.opacity) * Math.min(1, dt * 18);
    boostFlame.userData.flame2.material.opacity = boostFlame.userData.flame1.material.opacity;
    boostFlame.userData.inner1.material.opacity = boostFlame.userData.flame1.material.opacity * 0.85;
    boostFlame.userData.inner2.material.opacity = boostFlame.userData.flame1.material.opacity * 0.85;
  }

  // HUD.
  const standings = computeStandings();
  document.getElementById("speed").textContent = Math.round(Math.abs(car.speed) * 3.6);
  document.getElementById("lap").textContent = `${Math.min(lap, LAPS_TOTAL)}/${LAPS_TOTAL}`;
  document.getElementById("time").textContent = formatTime(raceTime);
  document.getElementById("place").textContent = ordinal(standings.place);
  const best = bestLapPerTrack[track.id];
  document.getElementById("best").textContent = best ? formatTime(best) : "—";
  document.getElementById("boost-bar").style.width = `${Math.round(readBoost() * 100)}%`;
  // Engine heat HUD.
  const heatBar = document.getElementById("heat-bar");
  if (heatBar) heatBar.style.width = `${Math.round((car.engineHeat || 0) * 100)}%`;
  const heatMeter = document.querySelector(".heat-meter");
  if (heatMeter) heatMeter.classList.toggle("is-overheating", !!car.overheating);

  // Combo HUD
  const comboStack = document.getElementById("combo-stack");
  if (comboStack) {
    if (combo > 0) {
      comboStack.hidden = false;
      document.getElementById("combo-value").textContent = `x${combo}`;
      comboStack.classList.toggle("is-hot", combo >= 5);
    } else {
      comboStack.hidden = true;
    }
  }

  renderStandings(standings.entries.slice(0, 5), standings.place);
  drawMinimap(standings);

  if (running && lap > LAPS_TOTAL && !finishShown) {
    finishShown = true;
    running = false;
    showFinish(standings);
  }

  composer.render();
  requestAnimationFrame(loop);
}

function ordinal(n) {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

function renderStandings(top, playerPlace) {
  const ol = document.getElementById("standings");
  let html = "";
  top.forEach((e, i) => {
    const cls = e.isPlayer ? ' class="is-player"' : "";
    const place = e.isPlayer ? playerPlace : i + 1;
    html += `<li${cls}><span>${place}</span><span>${e.name}</span></li>`;
  });
  ol.innerHTML = html;
}

// Mini-map: top-down projection of track centerline + dot for each car.
const minimapCanvas = document.getElementById("minimap");
const minimapCtx = minimapCanvas?.getContext("2d");
function drawMinimap() {
  if (!minimapCtx || !track) return;
  const w = minimapCanvas.width;
  const h = minimapCanvas.height;
  minimapCtx.clearRect(0, 0, w, h);
  // Compute bounds of the track points.
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of track.controlPoints) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  const pad = 12;
  const sx = (w - pad * 2) / (maxX - minX || 1);
  const sz = (h - pad * 2) / (maxZ - minZ || 1);
  const s = Math.min(sx, sz);
  const cx = (x) => pad + (x - minX) * s;
  const cz = (z) => pad + (z - minZ) * s;

  // Track outline.
  minimapCtx.strokeStyle = "rgba(46, 233, 255, 0.65)";
  minimapCtx.lineWidth = 2;
  minimapCtx.beginPath();
  for (let i = 0; i < track.points.length; i++) {
    const p = track.points[i];
    if (i === 0) minimapCtx.moveTo(cx(p.x), cz(p.z));
    else minimapCtx.lineTo(cx(p.x), cz(p.z));
  }
  minimapCtx.closePath();
  minimapCtx.stroke();

  // Rival dots.
  for (const r of rivals) {
    minimapCtx.fillStyle = "rgba(255, 209, 102, 0.85)";
    minimapCtx.beginPath();
    minimapCtx.arc(cx(r.mesh.position.x), cz(r.mesh.position.z), 2.5, 0, Math.PI * 2);
    minimapCtx.fill();
  }
  // Player dot.
  minimapCtx.fillStyle = "#ff315c";
  minimapCtx.shadowColor = "#ff315c";
  minimapCtx.shadowBlur = 6;
  minimapCtx.beginPath();
  minimapCtx.arc(cx(car.group.position.x), cz(car.group.position.z), 4, 0, Math.PI * 2);
  minimapCtx.fill();
  minimapCtx.shadowBlur = 0;
}

let finishShown = false;
function showFinish(standings) {
  const overlay = document.getElementById("finish-overlay");
  document.getElementById("finish-title").textContent = standings.place === 1 ? "Victory" : "Race Complete";
  const best = bestLapPerTrack[track.id];
  document.getElementById("finish-stats").textContent =
    `${ordinal(standings.place)} of ${standings.entries.length} · ${formatTime(raceTime)}` +
    (best ? ` · best lap ${formatTime(best)}` : "");
  overlay.hidden = false;
}

function formatTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const c = Math.floor((t % 1) * 100);
  return `${m}:${String(s).padStart(2, "0")}.${String(c).padStart(2, "0")}`;
}

// ---- Title overlay → start ----
const overlay = document.getElementById("title-overlay");
const finishOverlay = document.getElementById("finish-overlay");

function startRace() {
  overlay.hidden = true;
  finishOverlay.hidden = true;
  ensureAudio();
  car.group.position.set(startPoint.x, startPoint.y + 0.8, startPoint.z);
  car.heading = startPoint.tangentAngle;
  car.speed = 0;
  car.lateralV = 0;
  car.steer = 0;
  for (let i = 0; i < rivals.length; i++) {
    const r = rivals[i];
    r.s = -((i + 1) * 14);
    r.laps = 0;
    r.speed = 0;
    r.lane = r.homeLane;
  }
  running = false; // wait for countdown
  finishShown = false;
  lastTime = performance.now();
  raceTime = 0;
  lapStartTime = 0;
  lap = 1;
  acc = 0;
  cameraInitialised = false;
  if (car) car.boostMeter = 0.5;
  combo = 0;
  comboTimer = 0;
  clearSkids();
  runStartLights();
}

const startLightsEl = document.getElementById("start-lights");
function runStartLights() {
  if (!startLightsEl) { running = true; return; }
  startLightsEl.hidden = false;
  const bulbs = Array.from(startLightsEl.children);
  bulbs.forEach((b) => b.classList.remove("is-lit"));
  let i = 0;
  const interval = setInterval(() => {
    if (i < bulbs.length) {
      bulbs[i].classList.add("is-lit");
      i++;
    } else {
      // GO — extinguish all and start the race.
      clearInterval(interval);
      bulbs.forEach((b) => b.classList.remove("is-lit"));
      setTimeout(() => { startLightsEl.hidden = true; }, 220);
      running = true;
      flashCallout("GO", 700);
    }
  }, 600);
}

document.getElementById("start").addEventListener("click", startRace);
document.getElementById("restart").addEventListener("click", startRace);

// ---- Track picker ----
function renderTrackPicker() {
  const wrap = document.getElementById("track-picker");
  if (!wrap) return;
  if (wrap.children.length !== TRACKS_LIST.length) {
    wrap.innerHTML = "";
    for (const t of TRACKS_LIST) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "track-card";
      btn.setAttribute("role", "radio");
      btn.dataset.track = t.id;
      btn.innerHTML = `
        <span class="name">${t.name}</span>
        <p class="desc">${t.description}</p>
        <div class="swatch" aria-hidden="true">
          <span style="background:${t.palette.sky.top}"></span>
          <span style="background:${t.palette.sky.mid}"></span>
          <span style="background:${t.palette.sky.bottom}"></span>
          <span style="background:#${t.palette.kerbA.toString(16).padStart(6, "0")}"></span>
        </div>`;
      btn.addEventListener("click", () => {
        loadTrack(t.id);
        renderTrackPicker();
      });
      wrap.appendChild(btn);
    }
  }
  for (const card of wrap.querySelectorAll(".track-card")) {
    card.setAttribute("aria-checked", card.dataset.track === track.id ? "true" : "false");
  }
}
renderTrackPicker();

// ---- Car picker ----
function renderCarPicker() {
  const wrap = document.getElementById("car-picker");
  if (!wrap) return;
  const shapes = Object.keys(CAR_SHAPES);
  if (wrap.children.length !== shapes.length) {
    wrap.innerHTML = "";
    for (const id of shapes) {
      const s = CAR_SHAPES[id];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "track-card";
      btn.setAttribute("role", "radio");
      btn.dataset.car = id;
      const bodyHex = "#" + s.body.toString(16).padStart(6, "0");
      const stripeHex = "#" + s.stripe.toString(16).padStart(6, "0");
      btn.innerHTML = `
        <span class="name">${s.label}</span>
        <p class="desc">${s.description}</p>
        <div class="swatch" aria-hidden="true">
          <span style="background:${bodyHex}"></span>
          <span style="background:${stripeHex}"></span>
        </div>`;
      btn.addEventListener("click", () => {
        swapCar(id);
        renderCarPicker();
      });
      wrap.appendChild(btn);
    }
  }
  for (const card of wrap.querySelectorAll(".track-card")) {
    if (card.dataset.car) {
      card.setAttribute("aria-checked", card.dataset.car === car.shape ? "true" : "false");
    }
  }
}
renderCarPicker();

// Mute toggle, persisted.
const MUTE_KEY = "apex-akina-3d:muted";
const muteBtn = document.getElementById("mute-btn");
const initialMute = (() => { try { return localStorage.getItem(MUTE_KEY) === "1"; } catch (_) { return false; } })();
setAudioMuted(initialMute);
if (muteBtn) {
  muteBtn.textContent = initialMute ? "✕" : "♪";
  muteBtn.setAttribute("aria-pressed", initialMute ? "true" : "false");
  muteBtn.addEventListener("click", () => {
    ensureAudio();
    const next = !isAudioMuted();
    setAudioMuted(next);
    muteBtn.textContent = next ? "✕" : "♪";
    muteBtn.setAttribute("aria-pressed", next ? "true" : "false");
    try { localStorage.setItem(MUTE_KEY, next ? "1" : "0"); } catch (_) {}
  });
}

requestAnimationFrame(loop);
