// Weather system — particle clouds + fog tweaks for rain / snow / fog / clear.
//
// API:
//   const weather = createWeather(scene, camera);
//   weather.setMode("rain", 0.8);   // type, intensity 0..1
//   weather.tick(dt);                // call every frame
//
// The particle cloud is a small box that follows the camera so we only ever
// render ~1500 points but the player sees endless precipitation. Particles
// recycle to the top when they hit the bottom of the box.

import * as THREE from "three";

const TYPES = ["clear", "rain", "snow", "fog"];

export function createWeather(scene, camera) {
  const COUNT = 1800;
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(COUNT * 3);
  const velocities = new Float32Array(COUNT * 3);
  const BOX = { x: 80, y: 50, z: 80 };
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * BOX.x;
    positions[i * 3 + 1] =  Math.random() * BOX.y;
    positions[i * 3 + 2] = (Math.random() - 0.5) * BOX.z;
    velocities[i * 3 + 0] = 0;
    velocities[i * 3 + 1] = -1;
    velocities[i * 3 + 2] = 0;
  }
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  // Two materials — picked at setMode time.
  const rainMat = new THREE.PointsMaterial({
    color: 0x9cc8ff,
    size: 0.08,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });
  const snowMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.16,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    sizeAttenuation: true
  });

  const points = new THREE.Points(geom, rainMat);
  points.frustumCulled = false;
  points.visible = false;
  scene.add(points);

  let mode = "clear";
  let intensity = 0;
  let baseFogNear = scene.fog ? scene.fog.near : 120;
  let baseFogFar  = scene.fog ? scene.fog.far  : 480;
  let phase = 0;

  function setMode(type, amount = 1.0) {
    if (!TYPES.includes(type)) type = "clear";
    mode = type;
    intensity = Math.max(0, Math.min(1, amount));
    points.visible = (mode === "rain" || mode === "snow") && intensity > 0;
    if (mode === "rain") {
      points.material = rainMat;
      points.material.opacity = 0.30 + 0.45 * intensity;
    } else if (mode === "snow") {
      points.material = snowMat;
      points.material.opacity = 0.50 + 0.40 * intensity;
    }
    // Fog adjustment.
    if (scene.fog) {
      if (mode === "fog") {
        scene.fog.near = baseFogNear * (1 - 0.6 * intensity);
        scene.fog.far  = baseFogFar  * (1 - 0.55 * intensity);
      } else if (mode === "rain") {
        scene.fog.near = baseFogNear * (1 - 0.25 * intensity);
        scene.fog.far  = baseFogFar  * (1 - 0.20 * intensity);
      } else if (mode === "snow") {
        scene.fog.near = baseFogNear * (1 - 0.30 * intensity);
        scene.fog.far  = baseFogFar  * (1 - 0.25 * intensity);
      } else {
        scene.fog.near = baseFogNear;
        scene.fog.far  = baseFogFar;
      }
    }
  }

  // Re-cache base fog if main.js changes it (per-track palette, time of day).
  function refreshBaseFog() {
    if (!scene.fog) return;
    baseFogNear = scene.fog.near;
    baseFogFar  = scene.fog.far;
    setMode(mode, intensity);  // reapply
  }

  function tick(dt) {
    if (!points.visible) return;
    phase += dt;
    const pos = geom.attributes.position.array;
    // Per-mode fall speed (m/s) and horizontal drift.
    const fall = mode === "rain" ? -45 : -3.2;
    const drift = mode === "rain" ? 0.0 : 0.7;
    const cx = camera.position.x;
    const cy = camera.position.y;
    const cz = camera.position.z;
    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3;
      let x = pos[ix    ];
      let y = pos[ix + 1];
      let z = pos[ix + 2];
      y += fall * dt;
      if (mode === "snow") {
        x += Math.sin(phase * 0.8 + i * 0.13) * drift * dt;
        z += Math.cos(phase * 0.7 + i * 0.21) * drift * dt;
      }
      // Recycle if out of box, recentred around camera.
      if (y < cy - 8 || Math.abs(x - cx) > BOX.x * 0.5 || Math.abs(z - cz) > BOX.z * 0.5) {
        x = cx + (Math.random() - 0.5) * BOX.x;
        z = cz + (Math.random() - 0.5) * BOX.z;
        y = cy + 8 + Math.random() * (BOX.y - 8);
      }
      pos[ix    ] = x;
      pos[ix + 1] = y;
      pos[ix + 2] = z;
    }
    geom.attributes.position.needsUpdate = true;
  }

  function getMode() { return { type: mode, intensity }; }

  return { setMode, tick, refreshBaseFog, getMode };
}

export const WEATHER_TYPES = TYPES;
