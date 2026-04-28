// Replay buffer — record the player's pose every N frames into a ring buffer
// and let the player scrub through it after a race ends. Cheap on memory
// (~few MB max for a 3-min race).

const SAMPLE_INTERVAL = 1 / 30;     // 30 Hz
const MAX_DURATION = 240;           // 4 minutes
const FIELDS_PER_SAMPLE = 6;        // x, y, z, heading, speed, gear

export function createReplay() {
  const max = Math.ceil(MAX_DURATION / SAMPLE_INTERVAL);
  const buf = new Float32Array(max * FIELDS_PER_SAMPLE);
  let writeIdx = 0;
  let lastTime = 0;
  let recording = false;

  return {
    start(now) {
      writeIdx = 0;
      lastTime = now;
      recording = true;
    },
    stop() { recording = false; },
    /** Record one sample if SAMPLE_INTERVAL has elapsed. */
    record(now, x, y, z, heading, speed, gear) {
      if (!recording) return;
      if (now - lastTime < SAMPLE_INTERVAL) return;
      if (writeIdx >= max - 1) return;
      const off = writeIdx * FIELDS_PER_SAMPLE;
      buf[off]     = x;
      buf[off + 1] = y;
      buf[off + 2] = z;
      buf[off + 3] = heading;
      buf[off + 4] = speed;
      buf[off + 5] = gear;
      writeIdx++;
      lastTime = now;
    },
    /** Get sample at fractional time t in [0..1] across the recorded duration. */
    sampleAt(tNorm) {
      if (writeIdx < 2) return null;
      const idx = Math.max(0, Math.min(writeIdx - 1, Math.floor(tNorm * (writeIdx - 1))));
      const off = idx * FIELDS_PER_SAMPLE;
      return {
        x: buf[off], y: buf[off + 1], z: buf[off + 2],
        heading: buf[off + 3], speed: buf[off + 4], gear: buf[off + 5]
      };
    },
    sampleCount() { return writeIdx; },
    duration() { return writeIdx * SAMPLE_INTERVAL; }
  };
}
