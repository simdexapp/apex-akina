// Ghost car — records the player's per-lap path and plays it back as a translucent
// reference. Per-frame samples are stored as flat Float32Array packed into base64
// for localStorage. Storage key is per (track, car) pair so different cars on the
// same track keep their own best ghosts.

import * as THREE from "three";

const SAMPLE_HZ = 30;          // record samples per second
const SAMPLE_DT = 1 / SAMPLE_HZ;
const FIELDS_PER_SAMPLE = 5;   // t, x, y, z, heading

function storageKey(trackId, carShape) {
  return `apex-akina-3d:ghost:${trackId}:${carShape}`;
}

function timeKey(trackId, carShape) {
  return `apex-akina-3d:bestlap:${trackId}:${carShape}`;
}

export function loadGhost(trackId, carShape) {
  try {
    const b64 = localStorage.getItem(storageKey(trackId, carShape));
    if (!b64) return null;
    const bin = atob(b64);
    const buf = new ArrayBuffer(bin.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
    const samples = new Float32Array(buf);
    const time = parseFloat(localStorage.getItem(timeKey(trackId, carShape))) || null;
    return { samples, time };
  } catch (_) { return null; }
}

function saveGhost(trackId, carShape, samples, time) {
  try {
    const buf = samples.buffer;
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    localStorage.setItem(storageKey(trackId, carShape), btoa(bin));
    localStorage.setItem(timeKey(trackId, carShape), String(time));
  } catch (_) {}
}

export function getBestLapTime(trackId, carShape) {
  try {
    const t = parseFloat(localStorage.getItem(timeKey(trackId, carShape)));
    return Number.isFinite(t) ? t : null;
  } catch (_) { return null; }
}

export function createGhostMesh(carShape, CAR_SHAPES) {
  // Build a simplified version of the car body in semi-transparent cyan.
  const shape = CAR_SHAPES[carShape] || CAR_SHAPES.gt;
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: 0x6cf2ff,
    transparent: true,
    opacity: 0.32,
    depthWrite: false
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(shape.width, shape.height, shape.length), mat);
  body.position.y = shape.height * 0.85;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(shape.cabin.w, shape.cabin.h, shape.cabin.l), mat);
  cabin.position.set(0, shape.height * 0.85 + shape.height * 0.5 + shape.cabin.h * 0.5 - 0.1, shape.cabin.z);
  group.add(cabin);
  group.visible = false;
  return group;
}

// Recorder + playback in one. Reset() before each lap. tickRecord() each frame
// to capture state. pos(t) gives the recorded position+heading at time t.
export function createGhost(trackId, carShape) {
  const stored = loadGhost(trackId, carShape);
  let savedSamples = stored ? stored.samples : null;
  let savedTime = stored ? stored.time : null;

  // Live recording buffer (reset each lap).
  let liveSamples = [];
  let liveStartTime = 0;
  let lastSampleT = -Infinity;

  return {
    bestTime: () => savedTime,

    // Start recording a new lap.
    startLap(now) {
      liveSamples = [];
      liveStartTime = now;
      lastSampleT = -Infinity;
    },

    // Record a sample. Caller passes the absolute time and player state.
    tickRecord(now, x, y, z, heading) {
      const t = now - liveStartTime;
      if (t - lastSampleT < SAMPLE_DT) return;
      lastSampleT = t;
      liveSamples.push(t, x, y, z, heading);
    },

    // Lap complete — if better than the saved time, persist.
    finishLap(now) {
      const lapTime = now - liveStartTime;
      const isBest = savedTime == null || lapTime < savedTime;
      if (isBest && liveSamples.length > 0) {
        const arr = new Float32Array(liveSamples);
        saveGhost(trackId, carShape, arr, lapTime);
        savedSamples = arr;
        savedTime = lapTime;
      }
      return { lapTime, isBest };
    },

    // Look up the saved ghost's pose at lap-relative time `t`.
    poseAt(t) {
      if (!savedSamples || savedSamples.length === 0) return null;
      // Linear search (samples are at most ~5400 long, fine for 30Hz playback).
      // Find the sample with the largest stored t <= our time.
      let lo = 0, hi = (savedSamples.length / FIELDS_PER_SAMPLE) - 1;
      // Binary search.
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        const sampT = savedSamples[mid * FIELDS_PER_SAMPLE];
        if (sampT <= t) lo = mid; else hi = mid - 1;
      }
      const i = lo;
      const i1 = Math.min(i + 1, (savedSamples.length / FIELDS_PER_SAMPLE) - 1);
      const t0 = savedSamples[i * FIELDS_PER_SAMPLE];
      const t1 = savedSamples[i1 * FIELDS_PER_SAMPLE];
      const span = t1 - t0;
      const alpha = span > 0 ? Math.max(0, Math.min(1, (t - t0) / span)) : 0;
      const x = savedSamples[i * FIELDS_PER_SAMPLE + 1] * (1 - alpha) + savedSamples[i1 * FIELDS_PER_SAMPLE + 1] * alpha;
      const y = savedSamples[i * FIELDS_PER_SAMPLE + 2] * (1 - alpha) + savedSamples[i1 * FIELDS_PER_SAMPLE + 2] * alpha;
      const z = savedSamples[i * FIELDS_PER_SAMPLE + 3] * (1 - alpha) + savedSamples[i1 * FIELDS_PER_SAMPLE + 3] * alpha;
      // Interpolate heading carefully across wrap.
      const h0 = savedSamples[i * FIELDS_PER_SAMPLE + 4];
      const h1 = savedSamples[i1 * FIELDS_PER_SAMPLE + 4];
      let dh = h1 - h0;
      if (dh > Math.PI) dh -= Math.PI * 2;
      if (dh < -Math.PI) dh += Math.PI * 2;
      const heading = h0 + dh * alpha;
      return { x, y, z, heading };
    },

    hasGhost: () => !!savedSamples
  };
}
