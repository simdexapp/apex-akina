import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { buildTrack, getTrackList } from "./track.js?v=37";
import { buildScenery, tickAmbient } from "./scenery.js?v=37";
import { createCar, CAR_SHAPES, SPOILER_OPTIONS } from "./car.js?v=37";
import { createInput, initTouchControls, vibrate } from "./input.js?v=37";
import { createRivals, tickRivals, placeRivalsOnGrid } from "./rivals.js?v=37";
import { ensureAudio, updateAudio, setAudioMuted, isAudioMuted,
  setMasterVolume, setMusicVolume, setSfxVolume,
  updateWind, playCountdownBeep, playShift, setMusicProfile,
  playTurboWhoosh, playBrakeHiss } from "./audio.js?v=37";
import { MUSIC_PROFILES, TRACKS } from "./tracks-data.js?v=37";
import { createGhost, createGhostMesh } from "./ghost.js?v=37";
import { createReplay } from "./replay.js?v=37";
import { CHAMPIONSHIPS, getCareerState, startChampionship, currentRound, recordRound, isComplete, reset as resetCareer } from "./career.js?v=37";
import { checkAchievements, onToast as onAchievementToast, ACHIEVEMENTS, isEarned as isAchEarned } from "./achievements.js?v=37";
import { getTodaysChallenge, checkDailyChallenge } from "./challenge.js?v=37";
import { computeRank, detectRankUp, TIERS } from "./rank.js?v=37";
import {
  loadProfile, saveProfile, setName, setCarColors, setCarAccent, setCarSpoiler,
  getCarLivery, bumpStats, bumpCarStats, recordRaceResult, recordBestLap, hex, parseHex
} from "./profile.js?v=37";

// ---- Renderer / scene setup ----
const canvas = document.getElementById("game");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.55;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x2a1c5a, 120, 480);

// Sky shader — dawn / dusk gradient with a hot horizon band so the world reads
// luminous instead of black.
const skyUniforms = {
  topColor: { value: new THREE.Color("#1a1a4e") },
  midColor: { value: new THREE.Color("#7a2c8e") },
  bottomColor: { value: new THREE.Color("#ff8a4c") },
  offset: { value: 220 }
};
{
  const skyGeo = new THREE.SphereGeometry(900, 48, 24);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: skyUniforms,
    vertexShader: `varying vec3 vWorld; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 topColor; uniform vec3 midColor; uniform vec3 bottomColor; uniform float offset; varying vec3 vWorld;
      // Quick hash for sky stipple noise (subtle horizon haze).
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        float h = normalize(vWorld + vec3(0.0, offset, 0.0)).y;
        // Hot horizon band: amplify bottom color near horizon.
        vec3 horizon = mix(bottomColor * 1.2, midColor, smoothstep(-0.05, 0.35, h));
        vec3 col = mix(horizon, topColor, smoothstep(0.35, 0.95, h));
        // Soft horizon haze noise.
        float n = hash(floor(vWorld.xz * 0.04));
        col += vec3(0.04, 0.02, 0.05) * n * (1.0 - smoothstep(0.0, 0.4, h));
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
}

// Strong ambient so the world isn't pitch-black even with no direct light.
const ambient = new THREE.AmbientLight(0x9bb6ff, 0.35);
scene.add(ambient);

// Lighting (set up once, recolored per track).
const moonLight = new THREE.DirectionalLight(0xfde2c4, 2.4);
moonLight.position.set(60, 110, 40);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(2048, 2048);
moonLight.shadow.camera.near = 10;
moonLight.shadow.camera.far = 320;
moonLight.shadow.camera.left = -90;
moonLight.shadow.camera.right = 90;
moonLight.shadow.camera.top = 90;
moonLight.shadow.camera.bottom = -90;
moonLight.shadow.bias = -0.0008;
moonLight.shadow.normalBias = 0.04;
// Move the shadow camera with the player so it always covers the active area.
const shadowTargetGroup = new THREE.Group();
moonLight.target = shadowTargetGroup;
scene.add(shadowTargetGroup);
const hemi = new THREE.HemisphereLight(0xa8c8ff, 0x4a3060, 1.2);
scene.add(hemi);
// Warm horizon fill — simulates the orange sun band hitting everything.
const horizonFill = new THREE.DirectionalLight(0xff9a4c, 0.9);
horizonFill.position.set(-200, 8, 0);
scene.add(horizonFill);
const fillRed = new THREE.PointLight(0xff315c, 3.2, 280);
fillRed.position.set(-60, 40, -40);
scene.add(fillRed);
const fillCyan = new THREE.PointLight(0x2ee9ff, 2.4, 240);
fillCyan.position.set(60, 30, 80);
scene.add(fillCyan);

// Stars — denser + slightly tinted for sparkle.
{
  const starCount = 1400;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 480 + Math.random() * 240;
    const phi = Math.random() * Math.PI * 2;
    const theta = Math.random() * 0.7;
    positions[i * 3]     = Math.cos(phi) * Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.sin(theta) * r + 120;
    positions[i * 3 + 2] = Math.sin(phi) * Math.cos(theta) * r;
    // Tint about 20% of stars cyan / pink for visual variety.
    const t = Math.random();
    if (t < 0.10) { colors.set([0.55, 0.85, 1.0], i * 3); }
    else if (t < 0.18) { colors.set([1.0, 0.7, 0.85], i * 3); }
    else if (t < 0.26) { colors.set([1.0, 0.92, 0.65], i * 3); }
    else { colors.set([1.0, 1.0, 1.0], i * 3); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({ size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0.95, vertexColors: true });
  scene.add(new THREE.Points(geo, mat));
}

// Nebula band — a couple of large soft glow planes high in the sky.
{
  const nebulaMat1 = new THREE.MeshBasicMaterial({
    color: 0xa64cff, transparent: true, opacity: 0.16, depthWrite: false
  });
  const nebulaMat2 = new THREE.MeshBasicMaterial({
    color: 0x2ee9ff, transparent: true, opacity: 0.12, depthWrite: false
  });
  for (const [mat, ang] of [[nebulaMat1, 0.6], [nebulaMat2, -0.3]]) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(700, 240), mat);
    plane.position.set(Math.cos(ang) * 380, 240, Math.sin(ang) * 380);
    plane.lookAt(0, 240, 0);
    scene.add(plane);
  }
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

// Walk a Three.js subtree and flag meshes as shadow casters / receivers.
// Skip MeshBasic (lamps, lights) — they shouldn't cast.
function applyShadows(root, { cast = true, receive = false } = {}) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const isBasic = obj.material && obj.material.isMeshBasicMaterial;
    if (cast && !isBasic) obj.castShadow = true;
    if (receive) obj.receiveShadow = true;
  });
}

let boostFlame = null;
let car = createCar(initialCarShape, getCarLivery(initialCarShape));
scene.add(car.group);
applyShadows(car.group, { cast: true, receive: true });
attachBoostFlame();

function swapCar(shapeId) {
  if (!CAR_SHAPES[shapeId]) return;
  if (car) {
    scene.remove(car.group);
    if (boostFlame) car.group.remove(boostFlame);
  }
  car = createCar(shapeId, getCarLivery(shapeId));
  scene.add(car.group);
  applyShadows(car.group, { cast: true, receive: true });
  attachBoostFlame();
  if (startPoint) {
    car.group.position.set(startPoint.x, startPoint.y + 0.8, startPoint.z);
    car.heading = startPoint.tangentAngle;
    car.group.rotation.set(0, car.heading, 0);
  }
  setupGhostFor(track?.id || initialTrackId, shapeId);
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

// Game mode + ghost state.
const MODE_KEY = "apex-akina-3d:mode";
let gameMode = (localStorage.getItem(MODE_KEY) === "timeTrial") ? "timeTrial" : "race";
let ghost = null;        // ghost recorder/playback for current track+car
const replay = createReplay();
let replayPlaying = false;
let replayProgress = 0;
let ghostMesh = null;
let lapStartedAt = 0;    // performance.now() when current lap started
let bestLapDisplay = null;

function setupGhostFor(trackId, carShape) {
  if (ghostMesh) {
    scene.remove(ghostMesh);
    ghostMesh = null;
  }
  ghost = createGhost(trackId, carShape);
  ghostMesh = createGhostMesh(carShape, CAR_SHAPES);
  scene.add(ghostMesh);
  bestLapDisplay = ghost.bestTime();
}

let scenery = null;
function loadTrack(id) {
  if (track) {
    scene.remove(track.group);
  }
  if (scenery) {
    scene.remove(scenery);
    scenery = null;
  }
  track = buildTrack(id);
  scene.add(track.group);
  applyShadows(track.group, { cast: true, receive: true });
  // Build per-track scenery (mountains + trees / buildings / billboards).
  scenery = buildScenery(id, track);
  scene.add(scenery);
  applyShadows(scenery, { cast: false, receive: false });
  startPoint = track.sample(0);
  // Update sky + fog + lights from palette.
  skyUniforms.topColor.value.set(track.palette.sky.top);
  skyUniforms.midColor.value.set(track.palette.sky.mid);
  skyUniforms.bottomColor.value.set(track.palette.sky.bottom);
  scene.fog.color.setHex(track.palette.fog);
  moonLight.color.setHex(track.palette.moonLight);
  fillRed.color.setHex(track.palette.fillRed);
  fillCyan.color.setHex(track.palette.fillCyan);
  // Reset rivals. Career mode rounds can flag a boss race; slot 0 then
  // becomes a named boss with stronger pace + signature livery.
  for (const r of rivals) scene.remove(r.mesh);
  const careerRound = (gameMode === "career") ? currentRound() : null;
  const bossIdx = (careerRound && typeof careerRound.boss === "number") ? careerRound.boss : null;
  rivals = createRivals(track, 14, bossIdx != null ? { boss: bossIdx } : {});
  if (bossIdx != null) {
    setTimeout(() => flashCallout(`Boss: ${rivals[0].name}`, 2200), 1200);
  }
  for (const r of rivals) {
    scene.add(r.mesh);
    applyShadows(r.mesh, { cast: true, receive: false });
  }
  placeRivalsOnGrid(rivals, track);
  // Place player.
  car.group.position.set(startPoint.x, startPoint.y + 0.8, startPoint.z);
  car.heading = startPoint.tangentAngle;
  car.group.rotation.set(0, car.heading, 0);
  setupGhostFor(id, car.shape);
  // Swap to this track's music profile if defined.
  if (MUSIC_PROFILES[id]) setMusicProfile(MUSIC_PROFILES[id]);
  // Apply time-of-day override (if user picked dawn/day/sunset/night).
  if (typeof applyTimeOfDay === "function") applyTimeOfDay();
  try { localStorage.setItem(TRACK_KEY, id); } catch (_) {}
}

// Time-of-day color recipes — applied as a tint over the track's palette.
// Defined here (before loadTrack call) so applyTimeOfDay can run during init.
// Values for `settings.time` are read lazily so settings can load after.
const TOD_RECIPES = {
  auto:   null,
  dawn:   { sky: { top: "#1a2c5e", mid: "#9c5878", bottom: "#ffd2a4" }, fog: 0x6a4a78, ambient: 0x9bb6ff, ambientI: 0.42, moon: 0xfde8c8, moonI: 2.2, hemiSky: 0xc8d8ff, hemiGround: 0x7a4a60, hemiI: 1.4 },
  day:    { sky: { top: "#3a72c8", mid: "#76b8e8", bottom: "#e8eef8" }, fog: 0x9cb0c8, ambient: 0xeef4ff, ambientI: 0.65, moon: 0xffffff, moonI: 3.6, hemiSky: 0xa8c8ff, hemiGround: 0x6a7080, hemiI: 1.6 },
  sunset: { sky: { top: "#1a1a4e", mid: "#a04088", bottom: "#ff7838" }, fog: 0x4a1a52, ambient: 0xb098cc, ambientI: 0.40, moon: 0xff9c5c, moonI: 2.6, hemiSky: 0xa8c8ff, hemiGround: 0x4a3060, hemiI: 1.0 },
  night:  { sky: { top: "#080a1a", mid: "#1a1a3a", bottom: "#3a4070" }, fog: 0x10122a, ambient: 0x6088b8, ambientI: 0.30, moon: 0x9cb6ff, moonI: 1.6, hemiSky: 0x6688ff, hemiGround: 0x150828, hemiI: 0.7 }
};

function applyTimeOfDay() {
  let tod = "auto";
  try { tod = settings.time || "auto"; } catch (_) { /* settings still in TDZ on first call */ }
  const recipe = TOD_RECIPES[tod] || null;
  if (!recipe || !track) {
    if (track) {
      skyUniforms.topColor.value.set(track.palette.sky.top);
      skyUniforms.midColor.value.set(track.palette.sky.mid);
      skyUniforms.bottomColor.value.set(track.palette.sky.bottom);
      scene.fog.color.setHex(track.palette.fog);
      moonLight.color.setHex(track.palette.moonLight);
      ambient.intensity = 0.35;
      hemi.intensity = 1.2;
      moonLight.intensity = 2.4;
    }
    return;
  }
  skyUniforms.topColor.value.set(recipe.sky.top);
  skyUniforms.midColor.value.set(recipe.sky.mid);
  skyUniforms.bottomColor.value.set(recipe.sky.bottom);
  scene.fog.color.setHex(recipe.fog);
  ambient.color.setHex(recipe.ambient);
  ambient.intensity = recipe.ambientI;
  moonLight.color.setHex(recipe.moon);
  moonLight.intensity = recipe.moonI;
  hemi.color.setHex(recipe.hemiSky);
  hemi.groundColor.setHex(recipe.hemiGround);
  hemi.intensity = recipe.hemiI;
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
const bloomPass = new UnrealBloomPass(new THREE.Vector2(canvas.clientWidth, canvas.clientHeight), 0.55, 0.6, 0.85);
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
  // Tighter chase — sits ~5.5m behind, 2.6m up, looking 8m ahead. Reads as
  // a real "behind the spoiler" shot, not a drone follow.
  chase:   { offset: new THREE.Vector3(0, 2.6, -5.5), look: new THREE.Vector3(0, 1.0, 8) },
  hood:    { offset: new THREE.Vector3(0, 1.3, 0.5), look: new THREE.Vector3(0, 1.3, 30) },
  cinema:  { offset: new THREE.Vector3(-2.0, 1.7, -4.5), look: new THREE.Vector3(0, 0.9, 12) }
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

let shakeMultiplier = 1;

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
  // Drag the directional-light source + target with the player so the shadow
  // map's view frustum always covers the active area.
  shadowTargetGroup.position.set(car.group.position.x, car.group.position.y, car.group.position.z);
  moonLight.position.set(car.group.position.x + 60, car.group.position.y + 110, car.group.position.z + 40);
  if (!cameraInitialised) {
    cameraSmoothPos.copy(cameraDesired);
    cameraInitialised = true;
  } else {
    cameraSmoothPos.lerp(cameraDesired, Math.min(1, dt * 6));
  }
  // Apply camera shake + FOV punch (decay).
  if (cameraShake > 0) {
    const shake = cameraShake * (typeof shakeMultiplier === "number" ? shakeMultiplier : 1);
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
  const baseFov = settings.fov ?? BASE_FOV;
  if (fovPunch > 0.01) {
    camera.fov = baseFov + fovPunch;
    camera.updateProjectionMatrix();
    fovPunch = Math.max(0, fovPunch - dt * 22);
  } else if (camera.fov !== baseFov) {
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
  }
}

// ---- Particle system (sparks + drift smoke) ----
// Per-quality particle cap. Overridden each tick by activeQualityPreset.
const PARTICLE_CAP_DEFAULT = 80;
function particleCap() { return activeQualityPreset?.particleCap ?? PARTICLE_CAP_DEFAULT; }
const particles = [];
const particlePool = new THREE.Group();
scene.add(particlePool);

function spawnSpark(x, y, z, side) {
  if (particles.length >= particleCap()) return;
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
  if (particles.length >= particleCap()) return;
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
const SKID_MAX = 360;
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
    skidQueue.push({ mesh, mat, life: 8.0 });
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
  if (combo > (raceCtx.maxCombo || 0)) raceCtx.maxCombo = combo;
  if (Math.floor(combo / 5) > Math.floor(before / 5)) {
    if (car) car.boostMeter = Math.min(1, car.boostMeter + 0.25);
    flashCallout(`x${Math.floor(combo / 5) * 5}!`, 1100);
  } else if (label) {
    flashCallout(label, 700);
  }
}

// Lightweight callout shown briefly in centre of screen.
let calloutEl = null;
// Drift score popup — float a number above the player car, drifting up + fading.
function spawnDriftPopup(value) {
  const wrap = document.querySelector(".game-frame");
  if (!wrap) return;
  // Project the player car position to screen.
  _projVec.set(car.group.position.x, car.group.position.y + 1.4, car.group.position.z);
  _projVec.project(camera);
  const rect = canvas.getBoundingClientRect();
  const x = (_projVec.x * 0.5 + 0.5) * rect.width;
  const y = (-_projVec.y * 0.5 + 0.5) * rect.height;
  const el = document.createElement("div");
  el.className = "drift-popup";
  el.textContent = `+${value}`;
  el.style.left = x + "px";
  el.style.top = y + "px";
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

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
initTouchControls();

// Bump session count on launch.
bumpStats({ sessions: 1 });

// Pre-race rotating tip.
const RACE_TIPS = [
  "Tail an AI within 22m to draft. Hold the line for a top-speed bump.",
  "Hold throttle the moment GO drops for a Perfect Launch surge.",
  "Brake INTO a corner to rotate the rear — trail-braking is fast.",
  "Drift charge scales with duration. Long clean slides = bigger boost.",
  "Steer-with the drift to extend; counter-flick to snap out.",
  "Press C to cycle camera modes (chase / hood / cinema).",
  "P enters Photo Mode — orbit cam, perfect for screenshots.",
  "V switches to Spectator Cam during a race.",
  "Esc pauses. F3 toggles the FPS counter.",
  "Customize spoilers + chrome accents per car in the Garage.",
  "Career Mode runs a full championship across multiple tracks.",
  "Master the Drift Coupe to unlock effortless slides.",
  "The Hyper GT punishes corners but eats straights.",
  "Difficulty: Brutal removes rubber-band. AI runs full pace.",
  "Replays save each race — hit Watch Replay on the finish screen."
];
{
  const tipEl = document.getElementById("race-tip");
  if (tipEl) tipEl.textContent = RACE_TIPS[Math.floor(Math.random() * RACE_TIPS.length)];
}

function renderDailyChallenge() {
  const card = document.getElementById("daily-challenge");
  const text = document.getElementById("dc-text");
  const status = document.getElementById("dc-status");
  if (!card || !text || !status) return;
  const today = getTodaysChallenge();
  card.hidden = false;
  text.textContent = today.text;
  status.textContent = today.completed ? "✓ Done" : "Pending";
  status.classList.toggle("is-done", today.completed);
}
renderDailyChallenge();

function renderRank() {
  const profile = loadProfile();
  const rank = computeRank(profile.stats);
  const badge = document.getElementById("rank-badge");
  const tierName = document.getElementById("rank-tier-name");
  const points = document.getElementById("rank-points");
  const fill = document.getElementById("rank-bar-fill");
  const next = document.getElementById("rank-next");
  if (!badge) return;
  badge.style.setProperty("--rank-color", rank.tier.color);
  if (tierName) tierName.textContent = rank.tier.name;
  if (points) points.textContent = `${rank.points} pts`;
  if (fill) fill.style.width = (rank.progress * 100).toFixed(0) + "%";
  if (next) {
    if (rank.nextTier) {
      next.textContent = `Next: ${rank.nextTier.name} · ${rank.nextTier.threshold} pts (${rank.nextTier.threshold - rank.points} to go)`;
    } else {
      next.textContent = "Top tier reached — drive forever";
    }
  }
}
renderRank();

// Achievement toast renderer.
onAchievementToast((ach) => {
  const stack = document.getElementById("toast-stack");
  if (!stack) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<span class="label">Achievement unlocked</span><strong>${ach.name}</strong><small>${ach.desc}</small>`;
  stack.appendChild(el);
  setTimeout(() => { el.remove(); }, 5000);
});

// Track per-race context for achievement checks.
const raceCtx = { topSpeedKmh: 0, nearMisses: 0, longestDrift: 0 };
let lastPlayerPlace = 15;
let _aiLastOrder = [];
let _aiCalloutCooldown = 0;

// Sector splits — three sectors at 0..1/3, 1/3..2/3, 2/3..1 of arclength.
const SECTORS_KEY = "apex-akina-3d:sectorsBest";
let sectorsBest = (() => {
  try { return JSON.parse(localStorage.getItem(SECTORS_KEY) || "{}"); }
  catch (_) { return {}; }
})();
const sectorState = { current: 1, lapStart: 0, splits: [null, null, null] };

function resetSectors() {
  sectorState.current = 1;
  sectorState.lapStart = performance.now() / 1000;
  sectorState.splits = [null, null, null];
  for (let i = 1; i <= 3; i++) {
    const t = document.getElementById(`sector-${i}`);
    const d = document.getElementById(`sector-${i}-delta`);
    if (t) t.textContent = "—";
    if (d) { d.textContent = ""; d.className = "sector-delta"; }
  }
  document.querySelectorAll(".sector-row").forEach((row, i) => {
    row.classList.toggle("is-active", i === 0);
  });
}

function recordSector(idx, time) {
  const trackId = track?.id;
  if (!trackId) return;
  sectorState.splits[idx - 1] = time;
  const t = document.getElementById(`sector-${idx}`);
  if (t) t.textContent = time.toFixed(2);
  const best = sectorsBest[trackId] || {};
  const key = `s${idx}`;
  const prev = best[key];
  const d = document.getElementById(`sector-${idx}-delta`);
  if (d && prev != null) {
    const delta = time - prev;
    d.textContent = (delta >= 0 ? "+" : "") + delta.toFixed(2);
    d.className = "sector-delta " + (delta < 0 ? "is-faster" : "is-slower");
  }
  if (prev == null || time < prev) {
    best[key] = time;
    sectorsBest[trackId] = best;
    try { localStorage.setItem(SECTORS_KEY, JSON.stringify(sectorsBest)); } catch (_) {}
  }
  document.querySelectorAll(".sector-row").forEach((row, i) => {
    row.classList.toggle("is-active", i === idx);
  });
}

let lastTime = performance.now();
let running = false;
const FIXED_DT = 1 / 60;
let acc = 0;

const LAPS_TOTAL_DEFAULT = 3;
let raceLapsOverride = null;
function lapsTotal() { return raceLapsOverride || LAPS_TOTAL_DEFAULT; }
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

// Local time-trial leaderboard — top 5 lap times per track.
const TT_KEY = "apex-akina-3d:ttBoard";
let ttBoard = (() => {
  try { return JSON.parse(localStorage.getItem(TT_KEY) || "{}"); }
  catch (_) { return {}; }
})();
function recordTTLap(trackId, carShape, seconds) {
  if (!ttBoard[trackId]) ttBoard[trackId] = [];
  ttBoard[trackId].push({ time: seconds, car: carShape, when: Date.now() });
  ttBoard[trackId].sort((a, b) => a.time - b.time);
  ttBoard[trackId] = ttBoard[trackId].slice(0, 5);
  try { localStorage.setItem(TT_KEY, JSON.stringify(ttBoard)); } catch (_) {}
}

function tick(dt) {
  const i = input.read();

  // Slipstream — find closest rival ahead and compute draft amount.
  // (Done before car.tick so the speed ceiling reflects current draft.)
  let draft = 0;
  if (rivals && rivals.length) {
    const sin = Math.sin(car.heading);
    const cos = Math.cos(car.heading);
    let bestDraft = 0;
    for (const r of rivals) {
      const dx = r.mesh.position.x - car.group.position.x;
      const dz = r.mesh.position.z - car.group.position.z;
      const forward = dx * sin + dz * cos;        // dot with heading vector
      if (forward < 1 || forward > 22) continue;
      const lateral = dx * cos - dz * sin;
      if (Math.abs(lateral) > 2.6) continue;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const proximity = 1 - dist / 22;
      if (proximity > bestDraft) bestDraft = proximity;
    }
    draft = bestDraft;
  }
  car.draftAmount = draft;
  document.body.classList.toggle("is-drafting", draft > 0.5);

  // Race-live time for perfect-launch detection.
  if (running) {
    car.raceLiveTime = (car.raceLiveTime ?? 0) + dt;
  }

  car.tick(dt, i, track);

  // Boost mechanic — passive regen happens here while not boosting/drifting.
  if (running && !i.boost && !car.driftActive) {
    car.boostMeter = Math.min(1, car.boostMeter + 0.06 * dt);
  }
  // Draft also tops up boost meter slowly — rewards staying in tow.
  if (running && draft > 0.4) {
    car.boostMeter = Math.min(1, car.boostMeter + draft * 0.10 * dt);
  }
  // Shift audio cue — rising edge.
  if (car.shiftEvent) {
    playShift(car.shiftEvent);
    if (car.shiftEvent > 0) flashCallout(`▲ ${car.gear}`, 360);
    car.shiftEvent = 0;
  }
  if (car.launchEvent) {
    flashCallout("PERFECT LAUNCH", 900);
    car.launchEvent = false;
  }

  // Boost activation kick.
  if (car.boostJustFired) {
    cameraShake = Math.max(cameraShake, 0.30);
    fovPunch = Math.max(fovPunch, 9);
    flashCallout("BOOST", 380);
    playTurboWhoosh();
    vibrate(0.6, 0.4, 200);
    raceCtx.boostUsed = true;
  }
  // Brake hiss on first brake-press at speed.
  if (i.brake && !car._wasBraking && Math.abs(car.speed) > 30) {
    playBrakeHiss();
    vibrate(0.30, 0.08, 90);
  }
  car._wasBraking = i.brake;

  // Steering-wheel mesh inside cabin rotates with input (visible from cinema cam).
  const sw = car.group?.userData?.steeringWheel;
  if (sw) {
    const target = -(i.steer || 0) * 1.6;
    sw._cur = (sw._cur ?? 0) + (target - (sw._cur ?? 0)) * Math.min(1, dt * 14);
    sw.rotation.z = sw._cur;
  }

  // Brake light intensity — bump when braking, fade otherwise.
  const tailMats = car.group?.userData?.tailMats;
  if (tailMats) {
    const targetEm = i.brake ? 2.8 : 0.6;
    for (const m of tailMats) {
      m.emissiveIntensity += (targetEm - m.emissiveIntensity) * Math.min(1, dt * 16);
    }
  }

  // Damage flash on barrier hit (rising-edge only, max once per ~half-sec).
  if (car.barrierHit) {
    document.body.classList.remove("is-damaged");
    void document.body.offsetWidth;
    document.body.classList.add("is-damaged");
    cameraShake = Math.max(cameraShake, 0.45);
    setTimeout(() => document.body.classList.remove("is-damaged"), 460);
    vibrate(0.8, 1.0, 280);
  }

  // Drift score popup — when a drift exits with reward, show points.
  if (car.driftExitReward) {
    spawnDriftPopup(Math.round(car.driftExitReward * 1000));
    car.driftExitReward = 0;
  }

  // Accumulate km driven for the per-car stat (race + time-trial both count).
  raceCtx.kmDriven = (raceCtx.kmDriven || 0) + (Math.abs(car.speed) * dt) / 1000;

  // Track per-race context for achievements.
  const speedKmh = Math.abs(car.speed) * 3.6;
  if (speedKmh > raceCtx.topSpeedKmh) raceCtx.topSpeedKmh = speedKmh;
  if (car.driftActive && car.driftDuration > raceCtx.longestDrift) {
    raceCtx.longestDrift = car.driftDuration;
  }

  // Player's total race distance for rubber-band scaling.
  const playerProj = track.project(car.group.position);
  const playerTotal = lap * track.length + playerProj.s;

  if (gameMode === "race") {
    tickRivals(rivals, dt, track, car, playerTotal, settings.difficulty || "normal");
  }

  // Replay — always record while racing.
  {
    const now = performance.now() / 1000;
    replay.record(now, car.group.position.x, car.group.position.y, car.group.position.z, car.heading, car.speed, car.gear || 1);
  }

  // Ghost — record current pose, play back saved best.
  if (ghost && gameMode === "timeTrial") {
    const now = performance.now() / 1000;
    ghost.tickRecord(now, car.group.position.x, car.group.position.y, car.group.position.z, car.heading);
    if (ghost.hasGhost() && ghostMesh) {
      const lapT = now - lapStartedAt;
      const pose = ghost.poseAt(lapT);
      if (pose) {
        ghostMesh.visible = true;
        ghostMesh.position.set(pose.x, pose.y, pose.z);
        ghostMesh.rotation.y = pose.heading;
      } else {
        ghostMesh.visible = false;
      }
    } else if (ghostMesh) {
      ghostMesh.visible = false;
    }
  } else if (ghostMesh) {
    ghostMesh.visible = false;
  }

  // Player–rival bump collisions + near-miss detection.
  for (const r of rivals) {
    const dx = car.group.position.x - r.mesh.position.x;
    const dz = car.group.position.z - r.mesh.position.z;
    const distSq = dx * dx + dz * dz;
    const dist = Math.sqrt(distSq);

    if (distSq < 6.5) {
      // Real collision — momentum exchange: faster car loses less, slower
      // car (or stationary AI) takes more of the hit. Apply damage to
      // BOTH cars proportional to closing speed.
      const safeDist = Math.max(0.5, dist);
      const closingV = Math.abs(car.speed - r.speed);
      const closingFactor = Math.max(0, closingV / 60);
      // Player damage — bigger spread on hard hits.
      const playerHitFactor = 0.18 + closingFactor * 0.30;
      car.speed *= 1 - playerHitFactor;
      // Push player slightly off-line, AI gets pushed harder.
      const push = 0.22 / safeDist;
      car.group.position.x += dx * push;
      car.group.position.z += dz * push;
      r.mesh.position.x -= dx * push * 1.10;
      r.mesh.position.z -= dz * push * 1.10;
      // AI takes HP damage; rear-end > side-swipe.
      const damage = 18 + closingV * 1.4;
      r.hp = Math.max(0, (r.hp ?? 100) - damage);
      r.crashedT = Math.max(r.crashedT || 0, 1.5);
      r.speed *= 1 - 0.40 * closingFactor;     // AI bleeds more speed than player
      // Player feedback.
      cameraShake = Math.max(cameraShake, 0.55);
      vibrate(0.95, 1.0, 320);
      // Sparks.
      const px = (car.group.position.x + r.mesh.position.x) * 0.5;
      const py = car.group.position.y + 0.6;
      const pz = (car.group.position.z + r.mesh.position.z) * 0.5;
      for (let k = 0; k < 8; k++) spawnSpark(px, py, pz, dx > 0 ? -1 : 1);
      // Spawn smoke if AI is crippled.
      if (r.hp < 20) {
        for (let k = 0; k < 6; k++) spawnSmoke(r.mesh.position.x, 0.5, r.mesh.position.z);
        flashCallout(`${r.name} is wrecked!`, 800);
      }
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
        raceCtx.nearMisses++;
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


// Rival name labels — project each rival's world position into screen space
// and update an HTML label sitting above their car. Only shows labels for
// rivals roughly visible (in front of the camera, within 80m).
const _projVec = new THREE.Vector3();
const rivalLabelEls = new Map();
function updateRivalLabels() {
  const wrap = document.getElementById("rival-labels");
  if (!wrap || !rivals) return;
  // Cleanup labels for rivals that no longer exist.
  for (const [name, el] of rivalLabelEls) {
    if (!rivals.find((r) => r.name === name)) {
      el.remove();
      rivalLabelEls.delete(name);
    }
  }
  const rect = canvas.getBoundingClientRect();
  for (const r of rivals) {
    if (!r.mesh) continue;
    _projVec.set(r.mesh.position.x, r.mesh.position.y + 1.6, r.mesh.position.z);
    _projVec.project(camera);
    const inFront = _projVec.z > -1 && _projVec.z < 1;
    const x = (_projVec.x * 0.5 + 0.5) * rect.width;
    const y = (-_projVec.y * 0.5 + 0.5) * rect.height;
    const dx = r.mesh.position.x - car.group.position.x;
    const dz = r.mesh.position.z - car.group.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    let el = rivalLabelEls.get(r.name);
    if (!el) {
      el = document.createElement("div");
      el.className = "rival-label";
      el.textContent = r.name;
      wrap.appendChild(el);
      rivalLabelEls.set(r.name, el);
    }
    if (inFront && dist < 80) {
      el.style.display = "block";
      el.style.left = x + "px";
      el.style.top = y + "px";
      el.classList.toggle("is-near", dist < 20);
      el.classList.toggle("is-far", dist > 50);
    } else {
      el.style.display = "none";
    }
  }
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

// Slow-mo for the final 12% of the last lap — racing-game classic. Defaults
// to 1.0; the lap-detection block ramps to 0.55 when player crosses the
// final-lap "slow zone" line.
let slowMoFactor = 1.0;

function loop(now) {
  const dt = Math.min(0.25, (now - lastTime) / 1000);
  lastTime = now;
  if (running && !paused) {
    // Final-lap slow-mo: when on the last lap and past the start of sector 3,
    // ramp slowMoFactor toward 0.55 for cinematic finish.
    if (running && lap === lapsTotal() && track) {
      const proj = track.project(car.group.position);
      const finalZone = proj.s >= track.length * 0.88;
      const target = finalZone ? 0.55 : 1.0;
      slowMoFactor += (target - slowMoFactor) * Math.min(1, dt * 4);
    } else {
      slowMoFactor += (1.0 - slowMoFactor) * Math.min(1, dt * 6);
    }
    acc += dt * slowMoFactor;
    while (acc >= FIXED_DT) {
      tick(FIXED_DT);
      acc -= FIXED_DT;
    }
  }
  if (!introActive && !spectatorMode && !photoMode && !replayPlaying) updateCamera(dt);

  // Lap detection: when projected.s wraps from near end back to near start.
  const projected = track.project(car.group.position);
  // Sector detection: cross 1/3 and 2/3 of arclength. Sector 3 ends with the lap.
  const sectorBoundaries = [track.length / 3, (track.length * 2) / 3];
  const nowS = performance.now() / 1000;
  if (running && sectorState.current < 3) {
    const boundary = sectorBoundaries[sectorState.current - 1];
    if (lastTrackS < boundary && projected.s >= boundary) {
      recordSector(sectorState.current, nowS - sectorState.lapStart);
      sectorState.current++;
    }
  }
  if (projected.s < lastTrackS - track.length * 0.5 && running) {
    const lapTime = raceTime - lapStartTime;
    if (lap >= 1) {
      const prev = bestLapPerTrack[track.id];
      if (!prev || lapTime < prev) {
        bestLapPerTrack[track.id] = lapTime;
        saveBestLaps();
      }
      // Final sector record at lap end.
      recordSector(3, nowS - sectorState.lapStart);
      // Ghost finish lap (time-trial / hot-lap).
      if ((gameMode === "timeTrial" || gameMode === "hotlap") && ghost) {
        const result = ghost.finishLap(performance.now() / 1000);
        if (result.isBest) flashCallout("New PB", 1200);
        bestLapDisplay = ghost.bestTime();
        if (lapTime > 1) recordTTLap(track.id, car.shape, lapTime);
      }
    }
    lap = Math.min(lapsTotal(), lap + 1);
    lapStartTime = raceTime;
    lapStartedAt = performance.now() / 1000;
    if (ghost) ghost.startLap(lapStartedAt);
    // Reset sectors for new lap.
    resetSectors();
  }
  lastTrackS = projected.s;

  // Audio.
  const lastInput = input.read();
  updateAudio({
    speed: car.speed,
    maxSpeed: car.maxSpeed,
    lateralSlip: car.lateralV / 25,
    throttle: lastInput.throttle,
    brake: lastInput.brake,
    racing: running,
    gear: car.gear,
    gearCount: car._gearProfile?.count || 6,
    rpm: car.rpm
  });
  updateWind(Math.abs(car.speed) / car.maxSpeed);

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
  document.getElementById("lap").textContent = `${Math.min(lap, lapsTotal())}/${lapsTotal()}`;
  document.getElementById("time").textContent = formatTime(raceTime);
  document.getElementById("place").textContent = ordinal(standings.place);
  // Show ghost best in time trial (per car), generic best in race mode.
  const bestSeconds = gameMode === "timeTrial" ? bestLapDisplay : bestLapPerTrack[track.id];
  document.getElementById("best").textContent = bestSeconds ? formatTime(bestSeconds) : "—";
  document.getElementById("boost-bar").style.width = `${Math.round(readBoost() * 100)}%`;

  // Speedometer arc fill — pathLength=100, dasharray "<fill> 100".
  const fillEl = document.getElementById("speedo-fill");
  if (fillEl) {
    const speedKmh = Math.round(Math.abs(car.speed) * 3.6);
    const ceilingKmh = Math.round(car.maxSpeed * 1.25 * 3.6); // boost-able ceiling
    const fillPct = Math.min(100, Math.round((speedKmh / ceilingKmh) * 100));
    fillEl.setAttribute("stroke-dasharray", `${fillPct} 100`);
    document.getElementById("speedo-num").textContent = speedKmh;
    const gearEl = document.getElementById("gear-pill");
    if (gearEl) {
      gearEl.textContent = car.gear || 1;
      if (car._lastShownGear !== car.gear) {
        gearEl.classList.add("is-shifting");
        setTimeout(() => gearEl.classList.remove("is-shifting"), 200);
        car._lastShownGear = car.gear;
      }
    }
    const rpmEl = document.getElementById("rpm-readout");
    if (rpmEl) rpmEl.textContent = (Math.round(car.rpm || 0) | 0) + " rpm";
  }
  // Boost FX overlay.
  const boostFxEl = document.getElementById("boost-fx");
  if (boostFxEl) {
    boostFxEl.classList.toggle("is-active", car.boostT > 0 && running);
  }
  // Draft HUD.
  const draftStack = document.getElementById("draft-stack");
  if (draftStack) {
    const d = Math.round((car.draftAmount || 0) * 100);
    if (d > 35) {
      draftStack.hidden = false;
      document.getElementById("draft-value").textContent = `${d}%`;
    } else {
      draftStack.hidden = true;
    }
  }
  // Final-lap badge glow.
  const lapBadge = document.getElementById("lap")?.parentElement;
  if (lapBadge) {
    lapBadge.classList.toggle("is-final", lap === lapsTotal() && running);
  }
  // Tire grip indicator — high when planted, drops while sliding/drifting.
  const gripEl = document.getElementById("grip-bar");
  if (gripEl) {
    if (running) {
      gripEl.hidden = false;
      const slipMag = Math.min(1, Math.abs(car.lateralV) / 18);
      const grip = Math.max(0.05, 1 - slipMag);
      const fill = document.getElementById("grip-fill");
      if (fill) fill.style.width = (grip * 100).toFixed(0) + "%";
    } else {
      gripEl.hidden = true;
    }
  }
  // Live lap-delta vs personal best — only meaningful from lap 2 onward.
  const lapDeltaEl = document.getElementById("lap-delta");
  if (lapDeltaEl) {
    const pb = bestLapPerTrack[track.id];
    if (running && pb && lap > 1) {
      const lapElapsed = raceTime - lapStartTime;
      // Predict full-lap time = current elapsed × (PB / current-fraction). Simpler:
      // just show running delta — the elapsed minus the same-fraction of PB. For
      // a clean signal, use sectorState.splits[i] vs best where available.
      const delta = lapElapsed - pb;
      lapDeltaEl.hidden = false;
      const valEl = document.getElementById("lap-delta-value");
      if (valEl) valEl.textContent = (delta >= 0 ? "+" : "") + delta.toFixed(2);
      lapDeltaEl.classList.toggle("is-faster", delta < 0);
      lapDeltaEl.classList.toggle("is-slower", delta >= 0);
    } else {
      lapDeltaEl.hidden = true;
    }
  }
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
  if (running) updateRivalLabels();

  // AI vs AI position-change tracking — only when player isn't immediately
  // adjacent so we don't double-up with the player overtake message.
  if (running && rivals && rivals.length) {
    if (!_aiLastOrder.length) _aiLastOrder = standings.entries.map((e) => e.name);
    else {
      const newOrder = standings.entries.map((e) => e.name);
      // Find first rival pair that swapped at the front of the field.
      for (let i = 0; i < Math.min(8, newOrder.length - 1); i++) {
        const a = newOrder[i], b = newOrder[i + 1];
        const oldA = _aiLastOrder[i], oldB = _aiLastOrder[i + 1];
        if (a === oldB && b === oldA && a !== "You" && b !== "You") {
          _aiCalloutCooldown = (_aiCalloutCooldown || 0);
          if (_aiCalloutCooldown <= 0) {
            flashCallout(`${a} passed ${b}`, 700);
            _aiCalloutCooldown = 4.0;
          }
          break;
        }
      }
      _aiLastOrder = newOrder;
    }
    if (_aiCalloutCooldown > 0) _aiCalloutCooldown -= dt;
  }

  // Overtake detection — show callout when player's place changes.
  if (running && lastPlayerPlace !== standings.place) {
    if (lastPlayerPlace > standings.place) {
      // Player moved up — find who they overtook.
      const overtaken = standings.entries[standings.place];   // 1 spot below now
      if (overtaken && !overtaken.isPlayer) {
        flashCallout(`Overtook ${overtaken.name}`, 700);
      }
    } else if (lastPlayerPlace > 0 && lastPlayerPlace < standings.place) {
      const passer = standings.entries[standings.place - 2];   // 1 spot above
      if (passer && !passer.isPlayer) {
        flashCallout(`${passer.name} passed you`, 700);
      }
    }
    lastPlayerPlace = standings.place;
  }

  if (running && lap > lapsTotal() && !finishShown) {
    finishShown = true;
    running = false;
    showFinish(standings);
    // Bump profile stats — race counted, podium / win flag, lap count.
    if (gameMode === "race" || gameMode === "career") {
      const isWin = standings.place === 1;
      const isPodium = standings.place <= 3;
      const prevStats = { ...loadProfile().stats };
      bumpStats({ races: 1, wins: isWin ? 1 : 0, podiums: isPodium ? 1 : 0, laps: lapsTotal() });
      // Detect rank-up.
      const newStats = loadProfile().stats;
      const rankedUp = detectRankUp(prevStats, newStats);
      if (rankedUp) {
        flashCallout(`Promoted to ${rankedUp.name}!`, 2000);
        const stack = document.getElementById("toast-stack");
        if (stack) {
          const el = document.createElement("div");
          el.className = "toast";
          el.style.borderColor = rankedUp.color;
          el.innerHTML = `<span class="label" style="color:${rankedUp.color}">Rank Up</span><strong>${rankedUp.name}</strong><small>You climbed the ladder</small>`;
          stack.appendChild(el);
          setTimeout(() => el.remove(), 5500);
        }
      }
      renderRank();
      // Per-car stats.
      bumpCarStats(car.shape, { races: 1, wins: isWin ? 1 : 0 });
      // Streak.
      const newStreak = recordRaceResult(isWin);
      if (isWin && newStreak >= 3) flashCallout(`${newStreak}-race streak`, 1400);
    } else {
      bumpStats({ laps: lapsTotal() });
    }
    // Per-car km accumulator → flushed to profile.
    if (raceCtx.kmDriven > 0) bumpCarStats(car.shape, { kmDriven: raceCtx.kmDriven });
    // Longest single race tracker.
    {
      const ms = Math.floor(raceTime * 1000);
      const profile = loadProfile();
      if (ms > (profile.stats.longestRaceMs || 0)) {
        profile.stats.longestRaceMs = ms;
        saveProfile();
      }
    }
    // Record best lap to profile too (separate from canvas/legacy bestLapPerTrack).
    if (bestLapDisplay && car) recordBestLap(track.id, car.shape, bestLapDisplay);
    // Career: record this round's standings + advance to next.
    let championshipWin = null;
    if (gameMode === "career") {
      recordRound(standings.entries.map((e) => ({ name: e.name, isPlayer: e.isPlayer })));
      const state = getCareerState();
      if (state.finalStandings && state.finalStandings[0]?.isPlayer) {
        championshipWin = state.championshipId;
      }
    }
    // Check achievements with per-race context.
    const profile = loadProfile();
    const ctx = {
      lapTime: bestLapDisplay || bestLapPerTrack[track.id],
      topSpeedKmh: raceCtx.topSpeedKmh,
      driftDuration: raceCtx.longestDrift,
      nearMisses: raceCtx.nearMisses,
      championshipWin,
      // Daily-challenge context.
      won: standings.place === 1,
      place: standings.place,
      trackId: track.id,
      car: car.shape,
      mode: gameMode,
      difficulty: settings.difficulty || "normal",
      maxCombo: raceCtx.maxCombo || 0,
      boostUsed: raceCtx.boostUsed === true
    };
    checkAchievements(profile, ctx);
    // Daily challenge check.
    const dc = checkDailyChallenge(ctx);
    if (dc) {
      flashCallout("Challenge complete!", 1400);
      // Toast with daily-challenge styling.
      const stack = document.getElementById("toast-stack");
      if (stack) {
        const el = document.createElement("div");
        el.className = "toast";
        el.style.borderColor = "var(--gold)";
        el.innerHTML = `<span class="label">Daily Challenge</span><strong>Complete!</strong><small>${dc.text}</small>`;
        stack.appendChild(el);
        setTimeout(() => el.remove(), 5000);
      }
    }
    renderDailyChallenge();
  }

  // Spectator mode — orbit the race leader.
  if (spectatorMode && rivals && rivals.length) {
    spectatorYaw += dt * 0.4;
    // Find the leader (most laps × trackLen + arclength).
    const trackLen = track.length;
    let leader = car;
    let leaderTotal = lap * trackLen + track.project(car.group.position).s;
    for (const r of rivals) {
      const total = (r.laps || 0) * trackLen + r.s;
      if (total > leaderTotal) { leader = r.mesh ? r : null; leaderTotal = total; }
    }
    const target = leader === car ? car.group.position : leader.mesh.position;
    const dist = 18;
    camera.position.set(
      target.x + Math.sin(spectatorYaw) * dist,
      target.y + 6,
      target.z + Math.cos(spectatorYaw) * dist
    );
    camera.lookAt(target.x, target.y + 1.2, target.z);
  }
  // Photo mode camera + replay playback + FPS overlay.
  if (photoMode) tickPhotoMode(dt);
  if (replayPlaying) tickReplay(dt);
  if (fpsOverlayEnabled) {
    fpsFrameCount++;
    const now2 = performance.now();
    if (now2 - fpsLastSample >= 500) {
      fpsValue = Math.round(fpsFrameCount * 1000 / (now2 - fpsLastSample));
      fpsLastSample = now2;
      fpsFrameCount = 0;
      const el = document.getElementById("fps-value");
      if (el) el.textContent = fpsValue;
    }
  }

  if (scenery) tickAmbient(scenery, dt);

  // Billboard rival HP bars to face the camera.
  if (rivals) {
    for (const r of rivals) {
      const bg = r.mesh?.userData?.hpBg;
      const fill = r.mesh?.userData?.hpFill;
      if (bg && bg.visible) {
        bg.lookAt(camera.position);
        if (fill) fill.lookAt(camera.position);
      }
    }
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
  // Bounds.
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of track.controlPoints) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  const pad = 14;
  const sx = (w - pad * 2) / (maxX - minX || 1);
  const sz = (h - pad * 2) / (maxZ - minZ || 1);
  const s = Math.min(sx, sz);
  const cx = (x) => pad + (x - minX) * s;
  const cz = (z) => pad + (z - minZ) * s;

  // Track outline glow + line.
  minimapCtx.strokeStyle = "rgba(46, 233, 255, 0.18)";
  minimapCtx.lineWidth = 6;
  minimapCtx.beginPath();
  for (let i = 0; i < track.points.length; i++) {
    const p = track.points[i];
    if (i === 0) minimapCtx.moveTo(cx(p.x), cz(p.z));
    else minimapCtx.lineTo(cx(p.x), cz(p.z));
  }
  minimapCtx.closePath();
  minimapCtx.stroke();
  minimapCtx.strokeStyle = "rgba(46, 233, 255, 0.85)";
  minimapCtx.lineWidth = 1.5;
  minimapCtx.stroke();

  // Start marker — hot pink dot at point 0.
  const sp = track.points[0];
  minimapCtx.fillStyle = "#ff315c";
  minimapCtx.beginPath();
  minimapCtx.arc(cx(sp.x), cz(sp.z), 2.5, 0, Math.PI * 2);
  minimapCtx.fill();

  // Rival dots — color by personality, fade for far-back rivals.
  const PERSONALITY_COLORS = {
    aggressive: "#ff5e3a", smooth: "#4adf80", consistent: "#ffd166", wildcard: "#a66cff"
  };
  for (const r of rivals) {
    const col = PERSONALITY_COLORS[r.personality?.id] || "#ffd166";
    minimapCtx.fillStyle = col;
    minimapCtx.beginPath();
    minimapCtx.arc(cx(r.mesh.position.x), cz(r.mesh.position.z), 2.4, 0, Math.PI * 2);
    minimapCtx.fill();
  }

  // Player — triangle pointing in heading direction.
  const px = cx(car.group.position.x);
  const py = cz(car.group.position.z);
  const yaw = car.heading;
  minimapCtx.save();
  minimapCtx.translate(px, py);
  minimapCtx.rotate(-yaw);            // canvas Y is inverted vs world Z
  minimapCtx.fillStyle = "#fbfdff";
  minimapCtx.shadowColor = "#fbfdff";
  minimapCtx.shadowBlur = 8;
  minimapCtx.beginPath();
  minimapCtx.moveTo(0, -5);            // tip
  minimapCtx.lineTo(-3.5, 4);
  minimapCtx.lineTo(3.5, 4);
  minimapCtx.closePath();
  minimapCtx.fill();
  minimapCtx.shadowBlur = 0;
  minimapCtx.restore();
}

let finishShown = false;
function showFinish(standings) {
  const overlay = document.getElementById("finish-overlay");
  document.getElementById("finish-title").textContent = standings.place === 1 ? "Victory" : "Race Complete";
  // Victory flourish — body class drives a CSS confetti animation.
  if (standings.place === 1) {
    document.body.classList.add("is-victory");
    setTimeout(() => document.body.classList.remove("is-victory"), 4000);
  }
  const best = bestLapPerTrack[track.id];
  let extra = "";
  if (gameMode === "career") {
    const state = getCareerState();
    if (state.finalStandings) {
      const me = state.finalStandings.findIndex((e) => e.isPlayer) + 1;
      extra = ` · Championship: ${ordinal(me)} (${state.points.player} pts)`;
    } else {
      const round = currentRound();
      if (round) extra = ` · Round ${round.idx + 1}/${round.total} next: ${round.trackId.toUpperCase()}`;
      else extra = ` · Championship complete`;
    }
  }
  document.getElementById("finish-stats").textContent =
    `${ordinal(standings.place)} of ${standings.entries.length} · ${formatTime(raceTime)}` +
    (best ? ` · best lap ${formatTime(best)}` : "") + extra;
  // Time-trial / hot-lap leaderboard (top 5 saved laps for this track).
  if (gameMode === "timeTrial" || gameMode === "hotlap") {
    const board = ttBoard[track.id] || [];
    const html = board.length
      ? board.map((e, i) => `<li><span>${i + 1}</span><span>${formatTime(e.time)}</span><span>${e.car}</span></li>`).join("")
      : `<li class="empty">No times yet — set one!</li>`;
    let lbEl = document.getElementById("finish-lb");
    if (!lbEl) {
      lbEl = document.createElement("ol");
      lbEl.id = "finish-lb";
      lbEl.className = "finish-leaderboard";
      document.querySelector("#finish-overlay .title-card")?.insertBefore(lbEl, document.querySelector("#finish-overlay .prerace-actions"));
    }
    lbEl.innerHTML = html;
    lbEl.hidden = false;
  } else {
    const lbEl = document.getElementById("finish-lb");
    if (lbEl) lbEl.hidden = true;
  }
  overlay.hidden = false;
  // Stop replay recording at finish so playback shows just the race.
  replay.stop();
  // Hide sector splits.
  const sectorsEl = document.getElementById("sectors");
  if (sectorsEl) sectorsEl.hidden = true;
}

// Replay playback — drive a virtual car (the player's group) along recorded
// poses. Hides HUD, runs at 1.5× speed for snappier viewing.
let replayStartReal = 0;
let replayDuration = 0;
function startReplay() {
  if (replay.sampleCount() < 5) return;
  replayPlaying = true;
  replayProgress = 0;
  replayStartReal = performance.now() / 1000;
  replayDuration = replay.duration();
  finishOverlay.hidden = true;
  document.body.classList.add("is-replay");
  running = false;
}
function stopReplay() {
  replayPlaying = false;
  document.body.classList.remove("is-replay");
  finishOverlay.hidden = false;
}
function tickReplay(dt) {
  if (!replayPlaying) return;
  const elapsed = (performance.now() / 1000) - replayStartReal;
  const t = Math.min(1, (elapsed * 1.5) / replayDuration);
  const pose = replay.sampleAt(t);
  if (!pose) return;
  car.group.position.set(pose.x, pose.y, pose.z);
  car.group.rotation.set(0, pose.heading, 0);
  car.heading = pose.heading;
  car.speed = pose.speed;
  if (t >= 1) stopReplay();
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
  // Hot lap — 1 lap, no rivals.
  if (gameMode === "hotlap") {
    raceLapsOverride = 1;
  }
  // If career mode is active, force the round's track + laps.
  if (gameMode === "career") {
    const round = currentRound();
    if (round) {
      if (track?.id !== round.trackId) loadTrack(round.trackId);
      raceLapsOverride = round.laps;
      // Show interstitial callout: "ROUND 2 / 5"
      flashCallout(`Round ${round.idx + 1} / ${round.total}`, 1400);
    } else {
      raceLapsOverride = null;
    }
  } else {
    raceLapsOverride = null;
  }
  car.group.position.set(startPoint.x, startPoint.y + 0.8, startPoint.z);
  car.heading = startPoint.tangentAngle;
  car.group.rotation.set(0, car.heading, 0);
  car.pitch = 0;
  car.roll = 0;
  car.bodyYaw = 0;
  car.speed = 0;
  car.lateralV = 0;
  car.steer = 0;
  // Re-place rivals onto the grid (matches createRivals layout).
  const ROW_SPACING = 6, COL_OFFSET = 3;
  for (let i = 0; i < rivals.length; i++) {
    const r = rivals[i];
    const row = Math.floor(i / 2) + 1;
    const col = i % 2 === 0 ? -1 : 1;
    r.s = -row * ROW_SPACING;
    r.lane = col * COL_OFFSET;
    r.laps = 0;
    r.speed = 0;
  }
  placeRivalsOnGrid(rivals, track);
  running = false; // wait for countdown
  finishShown = false;
  lastTime = performance.now();
  raceTime = 0;
  lapStartTime = 0;
  lap = 1;
  acc = 0;
  cameraInitialised = false;
  // Ghost recording starts when the lights go out (countdown end).
  lapStartedAt = performance.now() / 1000;
  if (ghost) ghost.startLap(lapStartedAt);
  // Reset replay buffer.
  replay.start(performance.now() / 1000);
  replayPlaying = false;
  replayProgress = 0;
  // Reset per-race achievement context.
  raceCtx.topSpeedKmh = 0;
  raceCtx.nearMisses = 0;
  raceCtx.longestDrift = 0;
  raceCtx.kmDriven = 0;
  raceCtx.maxCombo = 0;
  raceCtx.boostUsed = false;
  // Sector splits — show panel + reset.
  const sectorsEl = document.getElementById("sectors");
  if (sectorsEl) sectorsEl.hidden = false;
  resetSectors();
  lastPlayerPlace = 15;
  _aiLastOrder = [];
  _aiCalloutCooldown = 0;
  // Hide rivals in time trial.
  for (const r of rivals) r.mesh.visible = (gameMode === "race" || gameMode === "career");
  if (car) {
    car.boostMeter = 0.5;
    car.gear = 1;
    car.rpm = 900;
    car.shiftCooldown = 0;
    car.shiftEvent = 0;
    car._launchUsed = false;
    car.raceLiveTime = null;
    car.draftAmount = 0;
    car.launchEvent = false;
  }
  combo = 0;
  comboTimer = 0;
  clearSkids();
  runIntroCamera(() => runStartLights());
}

// Pre-race cinematic — short flyby around the player car before lights.
let introActive = false;
function runIntroCamera(onDone) {
  introActive = true;
  const startT = performance.now() / 1000;
  function frame() {
    if (!introActive) return;
    const elapsed = (performance.now() / 1000) - startT;
    const t = Math.min(1, elapsed / 1.6);
    const ang = Math.PI * (0.6 - t * 0.6);
    const dist = 14 - t * 6;
    const height = 2.4 - t * 0.8;
    camera.position.set(
      car.group.position.x + Math.sin(ang) * dist,
      car.group.position.y + height,
      car.group.position.z + Math.cos(ang) * dist
    );
    camera.lookAt(car.group.position.x, car.group.position.y + 0.6, car.group.position.z);
    if (t >= 1) {
      introActive = false;
      cameraInitialised = false;
      if (onDone) onDone();
      return;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

const startLightsEl = document.getElementById("start-lights");
const countdownEl = document.getElementById("countdown-num");
function showCountdownNum(text, isGo = false) {
  if (!countdownEl) return;
  countdownEl.classList.remove("is-show", "is-go");
  void countdownEl.offsetWidth;     // restart animation
  countdownEl.setAttribute("data-num", text);
  countdownEl.classList.add("is-show");
  if (isGo) countdownEl.classList.add("is-go");
}

function runStartLights() {
  if (!startLightsEl) { running = true; return; }
  startLightsEl.hidden = false;
  const bulbs = Array.from(startLightsEl.children);
  bulbs.forEach((b) => b.classList.remove("is-lit"));
  let i = 0;
  // Big animated count "3 / 2 / 1" mapping (5 bulbs → first 2 silent, then 3, 2, 1).
  const COUNT_TEXT = ["", "", "3", "2", "1"];
  const interval = setInterval(() => {
    if (i < bulbs.length) {
      bulbs[i].classList.add("is-lit");
      const txt = COUNT_TEXT[i];
      if (txt) showCountdownNum(txt);
      if (i < bulbs.length - 1) playCountdownBeep("tick");
      i++;
    } else {
      // GO.
      clearInterval(interval);
      bulbs.forEach((b) => b.classList.remove("is-lit"));
      setTimeout(() => { startLightsEl.hidden = true; }, 220);
      running = true;
      if (car) car.raceLiveTime = 0;
      playCountdownBeep("go");
      showCountdownNum("GO", true);
      flashCallout("GO", 700);
    }
  }, 600);
}

document.getElementById("start").addEventListener("click", startRace);
document.getElementById("restart").addEventListener("click", startRace);
document.getElementById("watch-replay")?.addEventListener("click", startReplay);
window.addEventListener("keydown", (e) => {
  if (e.code === "Escape" && replayPlaying) {
    stopReplay();
  }
});

// ---- Track picker ----
// Build a small SVG path showing the track's centerline outline. Used in
// the track picker so each card has a unique visual silhouette.
function trackPreviewSvg(trackId) {
  const data = TRACKS[trackId];
  if (!data) return "";
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of data.points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  const w = maxX - minX, h = maxZ - minZ;
  const pad = 8;
  const W = 160, H = 80;
  const sx = (W - pad * 2) / Math.max(1, w);
  const sz = (H - pad * 2) / Math.max(1, h);
  const s = Math.min(sx, sz);
  const cx = (x) => pad + (x - minX) * s;
  const cz = (z) => pad + (z - minZ) * s;
  let d = "";
  for (let i = 0; i < data.points.length; i++) {
    const p = data.points[i];
    d += (i === 0 ? "M " : "L ") + cx(p.x).toFixed(1) + " " + cz(p.z).toFixed(1) + " ";
  }
  d += "Z";
  // Mark the start point with a small dot.
  const sp = data.points[0];
  return `<svg viewBox="0 0 ${W} ${H}" class="track-preview" aria-hidden="true">
    <path d="${d}" fill="none" stroke="rgba(46,233,255,0.30)" stroke-width="6" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="rgba(46,233,255,0.85)" stroke-width="3" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="rgba(255,255,255,0.95)" stroke-width="1.2" stroke-linejoin="round"/>
    <circle cx="${cx(sp.x).toFixed(1)}" cy="${cz(sp.z).toFixed(1)}" r="2.5" fill="#ff315c"/>
  </svg>`;
}

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
        ${trackPreviewSvg(t.id)}
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

// ---- Mode picker ----
function renderModePicker() {
  const wrap = document.getElementById("mode-picker");
  if (!wrap) return;
  for (const card of wrap.querySelectorAll(".mode-card")) {
    card.setAttribute("aria-checked", card.dataset.mode === gameMode ? "true" : "false");
  }
  // Show / hide the career championship picker.
  const careerPanel = document.getElementById("career-panel");
  if (careerPanel) careerPanel.hidden = gameMode !== "career";
  if (gameMode === "career") renderCareerPanel();
}

const VALID_MODES = ["race", "timeTrial", "career", "hotlap"];
const modePickerEl = document.getElementById("mode-picker");
if (modePickerEl) {
  for (const card of modePickerEl.querySelectorAll(".mode-card")) {
    card.addEventListener("click", () => {
      gameMode = VALID_MODES.includes(card.dataset.mode) ? card.dataset.mode : "race";
      try { localStorage.setItem(MODE_KEY, gameMode); } catch (_) {}
      renderModePicker();
    });
  }
}
renderModePicker();

// ---- Career championship picker ----
function renderCareerPanel() {
  const wrap = document.getElementById("championship-picker");
  const status = document.getElementById("career-status");
  if (!wrap) return;
  const state = getCareerState();
  // Build cards if not already.
  if (wrap.children.length !== Object.keys(CHAMPIONSHIPS).length) {
    wrap.innerHTML = "";
    for (const [id, champ] of Object.entries(CHAMPIONSHIPS)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "track-card";
      btn.setAttribute("role", "radio");
      btn.dataset.champId = id;
      btn.innerHTML = `
        <span class="name">${champ.name}</span>
        <p class="desc">${champ.description}</p>
        <p class="desc" style="margin-top:4px;font-size:10px;opacity:0.7">${champ.rounds.length} rounds · ${champ.difficulty} AI</p>`;
      btn.addEventListener("click", () => {
        startChampionship(id);
        // Auto-select the first round's track.
        const round = currentRound();
        if (round) loadTrack(round.trackId);
        renderCareerPanel();
        renderTrackPicker();
      });
      wrap.appendChild(btn);
    }
  }
  // Mark active championship.
  for (const card of wrap.querySelectorAll(".track-card")) {
    card.setAttribute("aria-checked", card.dataset.champId === state.championshipId ? "true" : "false");
  }
  // Status text.
  if (state.championshipId) {
    const champ = CHAMPIONSHIPS[state.championshipId];
    if (state.finalStandings) {
      const me = state.finalStandings.findIndex((e) => e.isPlayer) + 1;
      status.textContent = `Championship complete — finished ${ordinal(me)}. Press Reset to start over.`;
    } else {
      const r = currentRound();
      const ptsLine = `Player ${state.points.player || 0} pts`;
      status.textContent = `Round ${r.idx + 1} of ${r.total}: ${r.trackId.toUpperCase()} · ${r.laps} laps. ${ptsLine}.`;
    }
  } else {
    status.textContent = "Pick a championship to begin.";
  }
}

// ---- Garage ----
const garageOverlay = document.getElementById("garage-overlay");
const openGarageBtn = document.getElementById("open-garage");
const garageBackBtn = document.getElementById("garage-back");

function renderGarage() {
  const profile = loadProfile();
  document.getElementById("garage-name").value = profile.name;
  const stats = document.getElementById("garage-stats");
  const longest = (profile.stats.longestRaceMs || 0) / 1000;
  const races = profile.stats.races || 0;
  const winRate = races > 0 ? Math.round(((profile.stats.wins || 0) / races) * 100) : 0;
  const podiumRate = races > 0 ? Math.round(((profile.stats.podiums || 0) / races) * 100) : 0;
  stats.innerHTML = `
    <div><span class="label">Races</span><span class="value">${races}</span></div>
    <div><span class="label">Wins</span><span class="value">${profile.stats.wins || 0}</span></div>
    <div><span class="label">Win Rate</span><span class="value">${winRate}%</span></div>
    <div><span class="label">Podiums</span><span class="value">${profile.stats.podiums || 0}</span></div>
    <div><span class="label">Podium Rate</span><span class="value">${podiumRate}%</span></div>
    <div><span class="label">Laps</span><span class="value">${profile.stats.laps || 0}</span></div>
    <div><span class="label">Streak</span><span class="value">${profile.stats.streak || 0}</span></div>
    <div><span class="label">Best Streak</span><span class="value">${profile.stats.bestStreak || 0}</span></div>
    <div><span class="label">Sessions</span><span class="value">${profile.stats.sessions || 0}</span></div>
    <div><span class="label">Longest Race</span><span class="value">${longest > 0 ? formatTime(longest) : "—"}</span></div>
  `;
  // Achievements grid.
  const achWrap = document.getElementById("garage-achievements");
  if (achWrap) {
    achWrap.innerHTML = "";
    for (const [id, def] of Object.entries(ACHIEVEMENTS)) {
      const earned = isAchEarned(id);
      const card = document.createElement("div");
      card.className = "achievement-card " + (earned ? "is-earned" : "is-locked");
      card.innerHTML = `<span class="a-name">${earned ? "✓ " : "🔒 "}${def.name}</span><span class="a-desc">${def.desc}</span>`;
      achWrap.appendChild(card);
    }
  }
  const wrap = document.getElementById("garage-cars");
  wrap.innerHTML = "";
  for (const id of Object.keys(CAR_SHAPES)) {
    const base = CAR_SHAPES[id];
    const livery = profile.cars[id] || { body: base.body, stripe: base.stripe, accent: 0xc8d4e6, spoiler: base.spoiler ?? "none" };
    const accentHex = hex(livery.accent ?? 0xc8d4e6);
    const currentSpoiler = livery.spoiler ?? base.spoiler ?? "none";
    const spoilerOptionsHtml = SPOILER_OPTIONS.map((opt) =>
      `<option value="${opt}"${opt === currentSpoiler ? " selected" : ""}>${opt[0].toUpperCase()}${opt.slice(1)}</option>`
    ).join("");
    const km = Math.floor(livery.kmDriven || 0);
    const carWins = livery.wins || 0;
    const carRaces = livery.races || 0;
    // Find best lap with this car across all tracks.
    let bestLap = Infinity;
    for (const k of Object.keys(profile.bestLaps || {})) {
      if (k.endsWith(":" + id)) {
        const t = profile.bestLaps[k];
        if (t < bestLap) bestLap = t;
      }
    }
    const bestLapStr = bestLap !== Infinity ? formatTime(bestLap) : "—";
    const div = document.createElement("div");
    div.className = "garage-car";
    div.innerHTML = `
      <span class="name">${base.label}</span>
      <div class="car-stat-line">
        <span>${carRaces} races</span>
        <span>${carWins} wins</span>
        <span>${km} km</span>
        <span>PB ${bestLapStr}</span>
      </div>
      <div class="pickers">
        <label><span>Body</span><input type="color" data-car="${id}" data-part="body" value="${hex(livery.body)}"></label>
        <label><span>Stripe</span><input type="color" data-car="${id}" data-part="stripe" value="${hex(livery.stripe)}"></label>
        <label><span>Accent</span><input type="color" data-car="${id}" data-part="accent" value="${accentHex}"></label>
        <label class="spoiler-pick"><span>Spoiler</span><select data-car="${id}" data-part="spoiler">${spoilerOptionsHtml}</select></label>
      </div>`;
    wrap.appendChild(div);
  }
  for (const input of wrap.querySelectorAll('input[type="color"]')) {
    input.addEventListener("input", () => {
      const carId = input.dataset.car;
      const part = input.dataset.part;
      const cur = loadProfile().cars[carId] || { body: CAR_SHAPES[carId].body, stripe: CAR_SHAPES[carId].stripe, accent: 0xc8d4e6 };
      const value = parseHex(input.value);
      if (value == null) return;
      if (part === "accent") {
        setCarAccent(carId, value);
      } else {
        const next = { ...cur, [part]: value };
        setCarColors(carId, next.body, next.stripe);
      }
      if (carId === car.shape) swapCar(carId);
      if (_garagePreview && carId === car.shape) refreshGaragePreview();
    });
  }
  for (const sel of wrap.querySelectorAll('select[data-part="spoiler"]')) {
    sel.addEventListener("change", () => {
      const carId = sel.dataset.car;
      setCarSpoiler(carId, sel.value);
      if (carId === car.shape) swapCar(carId);
      if (_garagePreview && carId === car.shape) refreshGaragePreview();
    });
  }
}

// 3D garage preview — lazy-init the first time the garage opens.
let _garagePreview = null;
async function ensureGaragePreview() {
  if (_garagePreview) return _garagePreview;
  const mod = await import("./garagePreview.js?v=37");
  const cv = document.getElementById("garage-preview");
  if (!cv) return null;
  _garagePreview = mod.createGaragePreview(cv);
  return _garagePreview;
}
function refreshGaragePreview() {
  if (!_garagePreview) return;
  _garagePreview.setCar(car.shape, getCarLivery(car.shape));
  document.getElementById("garage-preview-label").textContent = (CAR_SHAPES[car.shape]?.label || "Car").toUpperCase();
}

if (openGarageBtn) {
  openGarageBtn.addEventListener("click", async () => {
    overlay.hidden = true;
    garageOverlay.hidden = false;
    renderGarage();
    const preview = await ensureGaragePreview();
    if (preview) {
      refreshGaragePreview();
      preview.start();
      // Also resize on the next frame in case the canvas was 0x0 at start.
      requestAnimationFrame(() => preview.resize());
    }
  });
}
if (garageBackBtn) {
  garageBackBtn.addEventListener("click", () => {
    const nameInput = document.getElementById("garage-name");
    if (nameInput) setName(nameInput.value);
    if (_garagePreview) _garagePreview.stop();
    garageOverlay.hidden = true;
    overlay.hidden = false;
  });
}

// ---- Pause menu (Esc) ----
const pauseOverlay = document.getElementById("pause-overlay");
let paused = false;
function setPaused(v) {
  paused = v;
  if (paused) {
    pauseOverlay.hidden = false;
    renderTrackRecords();
  } else {
    pauseOverlay.hidden = true;
  }
}

function renderTrackRecords() {
  const wrap = document.getElementById("track-records");
  if (!wrap) return;
  let html = "";
  for (const t of TRACKS_LIST) {
    const time = bestLapPerTrack[t.id];
    const className = time ? "rec" : "rec empty";
    const display = time ? formatTime(time) : "—";
    html += `<div class="${className}"><span>${t.name}</span><span>${display}</span></div>`;
  }
  wrap.innerHTML = html;
}
window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    // Don't allow pausing on title overlay (already a menu).
    if (!overlay.hidden) return;
    setPaused(!paused);
  }
  if (e.code === "F3") {
    e.preventDefault();
    fpsOverlayEnabled = !fpsOverlayEnabled;
    const el = document.getElementById("fps-overlay");
    if (el) el.hidden = !fpsOverlayEnabled;
  }
  if (e.code === "KeyP" && running) {
    photoMode = !photoMode;
    document.body.classList.toggle("is-photo-mode", photoMode);
  }
  // Photo capture: K key downloads current frame as PNG.
  if (e.code === "KeyK") {
    try {
      // Force a fresh render so the canvas has current pixels.
      composer.render();
      const dataURL = renderer.domElement.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataURL;
      a.download = `apex-akina-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      flashCallout("PNG saved", 700);
    } catch (err) {
      console.warn("Photo capture failed:", err);
    }
  }
  if (e.code === "KeyV" && running) {
    spectatorMode = !spectatorMode;
    document.body.classList.toggle("is-spectator", spectatorMode);
  }
  if (e.code === "KeyR" && (running || finishShown)) {
    // Quick restart current race.
    spectatorMode = false; photoMode = false;
    document.body.classList.remove("is-spectator", "is-photo-mode");
    startRace();
  }
});

// FPS counter state.
let fpsOverlayEnabled = false;
let fpsLastSample = performance.now();
let fpsFrameCount = 0;
let fpsValue = 60;

// Spectator mode — orbits the race leader at a cinematic distance.
let spectatorMode = false;
let spectatorYaw = 0;

// Photo mode — pause physics + switch to a free-fly camera that the player
// can orbit with arrow keys.
let photoMode = false;
let photoCam = { yaw: 0, pitch: -0.2, dist: 12, height: 4, target: new THREE.Vector3() };
function tickPhotoMode(dt) {
  if (!photoMode) return;
  // Orbit with arrows.
  if (input.read().steer < -0.1) photoCam.yaw -= dt * 1.4;
  if (input.read().steer > 0.1) photoCam.yaw += dt * 1.4;
  if (input.read().throttle) photoCam.dist = Math.max(4, photoCam.dist - dt * 8);
  if (input.read().brake) photoCam.dist = Math.min(40, photoCam.dist + dt * 8);
  photoCam.target.copy(car.group.position);
  const sx = Math.sin(photoCam.yaw);
  const sz = Math.cos(photoCam.yaw);
  camera.position.set(
    photoCam.target.x + sx * photoCam.dist,
    photoCam.target.y + photoCam.height,
    photoCam.target.z + sz * photoCam.dist
  );
  camera.lookAt(photoCam.target);
}
document.getElementById("hud-toggle-btn")?.addEventListener("click", () => {
  document.body.classList.toggle("is-hud-min");
});

document.getElementById("pause-btn")?.addEventListener("click", () => {
  if (overlay.hidden) setPaused(!paused);
});
document.getElementById("pause-resume")?.addEventListener("click", () => setPaused(false));
document.getElementById("pause-restart")?.addEventListener("click", () => {
  setPaused(false);
  startRace();
});
document.getElementById("pause-quit")?.addEventListener("click", () => {
  setPaused(false);
  running = false;
  finishShown = false;
  overlay.hidden = false;
});
document.getElementById("pause-settings")?.addEventListener("click", () => {
  document.getElementById("settings-overlay").hidden = false;
});

// ---- Settings overlay ----
const SETTINGS_KEY = "apex-akina-3d:settings";
const defaultSettings = { quality: "high", volume: 80, music: 60, sfx: 100, fov: 70, shake: 100, assist: true, difficulty: "normal", time: "auto", cb: false, reduceMotion: false };

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : { ...defaultSettings };
  } catch (_) { return { ...defaultSettings }; }
}
function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (_) {}
}
const settings = loadSettings();
// Graphics quality presets — more impactful than just toggling shadows.
// "ultra" cranks everything; "low" prioritises framerate.
const QUALITY_PRESETS = {
  ultra:  { shadows: true,  shadowSize: 2048, bloom: true,  bloomStrength: 0.65, pixelRatio: Math.min(window.devicePixelRatio, 2),    particleCap: 120, sceneryScale: 1.0 },
  high:   { shadows: true,  shadowSize: 1024, bloom: true,  bloomStrength: 0.55, pixelRatio: Math.min(window.devicePixelRatio, 1.75), particleCap: 80,  sceneryScale: 1.0 },
  medium: { shadows: false, shadowSize: 512,  bloom: true,  bloomStrength: 0.40, pixelRatio: Math.min(window.devicePixelRatio, 1.25), particleCap: 50,  sceneryScale: 0.6 },
  low:    { shadows: false, shadowSize: 512,  bloom: false, bloomStrength: 0.0,  pixelRatio: 1.0,                                     particleCap: 25,  sceneryScale: 0.4 }
};

let activeQualityPreset = QUALITY_PRESETS.high;

function applySettings() {
  const q = settings.quality || "high";
  const preset = QUALITY_PRESETS[q] || QUALITY_PRESETS.high;
  activeQualityPreset = preset;
  renderer.shadowMap.enabled = preset.shadows;
  if (preset.shadows && moonLight.shadow.mapSize.x !== preset.shadowSize) {
    moonLight.shadow.mapSize.set(preset.shadowSize, preset.shadowSize);
    moonLight.shadow.map?.dispose?.();
    moonLight.shadow.map = null;
  }
  bloomPass.enabled = preset.bloom;
  bloomPass.strength = preset.bloomStrength;
  renderer.setPixelRatio(preset.pixelRatio);
  // Volume — pipe through audio module's master gain.
  setMasterVolume(settings.volume / 100);
  setMusicVolume((settings.music ?? 60) / 100);
  setSfxVolume((settings.sfx ?? 100) / 100);
  setAudioMuted(settings.volume === 0 || isAudioMuted());
  // FOV.
  camera.fov = settings.fov;
  camera.updateProjectionMatrix();
  // Shake — scale the global shake intensity multiplier.
  shakeMultiplier = settings.shake / 100;
}
applySettings();
const settingsOverlay = document.getElementById("settings-overlay");
function syncSettingsUI() {
  document.getElementById("setting-quality").value = settings.quality;
  document.getElementById("setting-volume").value = settings.volume;
  document.getElementById("setting-music").value = settings.music;
  document.getElementById("setting-sfx").value = settings.sfx;
  document.getElementById("setting-fov").value = settings.fov;
  document.getElementById("setting-shake").value = settings.shake;
  document.getElementById("setting-assist").checked = !!settings.assist;
  const diffEl = document.getElementById("setting-difficulty");
  if (diffEl) diffEl.value = settings.difficulty || "normal";
  const tEl = document.getElementById("setting-time");
  if (tEl) tEl.value = settings.time || "auto";
  const cbEl = document.getElementById("setting-cb");
  if (cbEl) cbEl.checked = !!settings.cb;
  const rmEl = document.getElementById("setting-reduce-motion");
  if (rmEl) rmEl.checked = !!settings.reduceMotion;
}
syncSettingsUI();
for (const id of ["setting-quality", "setting-volume", "setting-music", "setting-sfx", "setting-fov", "setting-shake", "setting-assist", "setting-difficulty", "setting-time", "setting-cb", "setting-reduce-motion"]) {
  const el = document.getElementById(id);
  if (!el) continue;
  el.addEventListener("input", () => {
    settings.quality = document.getElementById("setting-quality").value;
    settings.volume = parseInt(document.getElementById("setting-volume").value, 10);
    settings.music = parseInt(document.getElementById("setting-music").value, 10);
    settings.sfx = parseInt(document.getElementById("setting-sfx").value, 10);
    settings.fov = parseInt(document.getElementById("setting-fov").value, 10);
    settings.shake = parseInt(document.getElementById("setting-shake").value, 10);
    settings.assist = document.getElementById("setting-assist").checked;
    settings.difficulty = document.getElementById("setting-difficulty").value;
    const tEl = document.getElementById("setting-time");
    if (tEl) settings.time = tEl.value;
    settings.cb = document.getElementById("setting-cb")?.checked || false;
    settings.reduceMotion = document.getElementById("setting-reduce-motion")?.checked || false;
    document.body.classList.toggle("is-colorblind", settings.cb);
    document.body.classList.toggle("is-reduce-motion", settings.reduceMotion);
    saveSettings(settings);
    applySettings();
    applyTimeOfDay();
  });
}
// Apply on init too.
document.body.classList.toggle("is-colorblind", !!settings.cb);
document.body.classList.toggle("is-reduce-motion", !!settings.reduceMotion);

// Fullscreen toggle.
document.getElementById("settings-fullscreen")?.addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.();
});

// Reset progress — clears stats, achievements, sectors, best laps, career.
document.getElementById("settings-reset")?.addEventListener("click", () => {
  if (!window.confirm("Reset ALL progress? Stats, achievements, sectors, ghosts, career — all wiped.")) return;
  try {
    localStorage.removeItem("apex-akina-3d:profile");
    localStorage.removeItem("apex-akina-3d:bestLap");
    localStorage.removeItem("apex-akina-3d:sectorsBest");
    localStorage.removeItem("apex-akina-3d:achievements");
    localStorage.removeItem("apex-akina-3d:career");
    // Ghost data is keyed per (track, car) so wipe all matching keys.
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith("apex-akina-3d:ghost:")) localStorage.removeItem(k);
    }
  } catch (_) {}
  location.reload();
});
document.getElementById("settings-back")?.addEventListener("click", () => {
  settingsOverlay.hidden = true;
});

// ---- First-time tutorial ----
const TUTORIAL_KEY = "apex-akina-3d:seenTutorial";
const tutorialOverlay = document.getElementById("tutorial-overlay");
function maybeShowTutorial() {
  try {
    if (!localStorage.getItem(TUTORIAL_KEY)) {
      tutorialOverlay.hidden = false;
      overlay.hidden = true;
    }
  } catch (_) {}
}
document.getElementById("tutorial-go")?.addEventListener("click", () => {
  try { localStorage.setItem(TUTORIAL_KEY, "1"); } catch (_) {}
  tutorialOverlay.hidden = true;
  overlay.hidden = false;
});
maybeShowTutorial();

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

// Hide splash now that the engine has booted + first frame is queued.
requestAnimationFrame(() => {
  const splash = document.getElementById("splash");
  if (splash) {
    splash.classList.add("is-fading");
    setTimeout(() => splash.remove(), 320);
  }
});

requestAnimationFrame(loop);
