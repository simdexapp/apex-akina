// Garage car preview — its own Three.js scene + renderer that runs in a
// small canvas inside the garage overlay. Shows the currently-selected
// car spinning on a turntable. Live-updates when liveries change.

import * as THREE from "three";
import { createCar, CAR_SHAPES } from "./car.js?v=40";

export function createGaragePreview(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = null;     // transparent — overlay shows through

  // Lights — dramatic studio look.
  const key = new THREE.DirectionalLight(0xfff5e0, 2.5);
  key.position.set(4, 6, 3);
  scene.add(key);
  const fillCyan = new THREE.PointLight(0x2ee9ff, 1.5, 12);
  fillCyan.position.set(-3, 2, 2);
  scene.add(fillCyan);
  const fillRed = new THREE.PointLight(0xff315c, 1.0, 12);
  fillRed.position.set(2, 2, -3);
  scene.add(fillRed);
  const ambient = new THREE.AmbientLight(0x9bb6ff, 0.45);
  scene.add(ambient);

  // Camera.
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(4.5, 1.6, 4.5);
  camera.lookAt(0, 0.6, 0);

  // Turntable disk under the car.
  const disk = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 0.05, 32),
    new THREE.MeshStandardMaterial({ color: 0x1a1f2e, metalness: 0.6, roughness: 0.2, emissive: 0x2ee9ff, emissiveIntensity: 0.10 })
  );
  disk.position.y = -0.05;
  scene.add(disk);

  // Outer ring glow.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.18, 2.30, 48),
    new THREE.MeshBasicMaterial({ color: 0x2ee9ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.001;
  scene.add(ring);

  let carGroup = null;
  let currentShape = null;
  let yaw = 0;

  function setCar(shapeId, livery) {
    if (carGroup) scene.remove(carGroup);
    const car = createCar(shapeId, livery);
    carGroup = car.group;
    carGroup.position.y = 0;
    scene.add(carGroup);
    currentShape = shapeId;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  }

  let running = false;
  let lastT = performance.now();
  function tick() {
    if (!running) return;
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastT) / 1000);
    lastT = now;
    yaw += dt * 0.55;        // slow rotation
    if (carGroup) carGroup.rotation.y = yaw;
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    running = true;
    lastT = performance.now();
    resize();
    requestAnimationFrame(tick);
  }
  function stop() { running = false; }

  function dispose() {
    running = false;
    renderer.dispose();
  }

  // Auto-resize on window changes while preview is visible.
  window.addEventListener("resize", () => { if (running) resize(); });

  return { setCar, start, stop, dispose, resize };
}
