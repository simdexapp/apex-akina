// Track recipes for the 3D engine. Each entry has metadata + control points + palette.

import * as THREE from "three";

const v = (x, y, z) => new THREE.Vector3(x, y, z);

// Per-track music profiles. tempo in BPM, arp + bass note arrays in Hz.
// Used by audio.js to swap the music loop per track for variety.
export const MUSIC_PROFILES = {
  lakeside: {
    tempo: 88,
    arp: [196, 246.94, 293.66, 369.99, 293.66, 369.99, 440, 293.66,
          196, 246.94, 293.66, 369.99, 246.94, 293.66, 369.99, 440],
    bass: [98, 0, 123.47, 0, 98, 0, 123.47, 0]
  },
  bayside: {
    tempo: 96,
    arp: [146.83, 174.61, 220, 261.63, 220, 261.63, 329.63, 220,
          146.83, 174.61, 220, 261.63, 174.61, 220, 261.63, 329.63],
    bass: [73.42, 0, 87.31, 0, 73.42, 0, 87.31, 0]
  },
  highway: {
    tempo: 110,
    arp: [164.81, 207.65, 246.94, 311.13, 246.94, 311.13, 369.99, 246.94,
          164.81, 207.65, 246.94, 311.13, 207.65, 246.94, 311.13, 369.99],
    bass: [82.41, 0, 103.83, 0, 82.41, 0, 103.83, 0]
  },
  neon: {
    tempo: 132,
    arp: [220, 277.18, 329.63, 415.30, 329.63, 415.30, 493.88, 329.63,
          220, 277.18, 329.63, 415.30, 277.18, 329.63, 415.30, 493.88],
    bass: [110, 0, 138.59, 0, 110, 0, 138.59, 0]
  },
  // Mountain pass — moody minor key, slower tempo for technical feel.
  mountainpass: {
    tempo: 76,
    arp: [185.00, 220, 277.18, 329.63, 277.18, 329.63, 415.30, 277.18,
          185.00, 220, 277.18, 329.63, 220, 277.18, 329.63, 415.30],
    bass: [92.50, 0, 110.00, 0, 92.50, 0, 110.00, 0]
  },
  // City circuit — driving 4-on-the-floor for downtown energy.
  city: {
    tempo: 124,
    arp: [196, 246.94, 293.66, 369.99, 293.66, 369.99, 440, 293.66,
          196, 246.94, 293.66, 369.99, 246.94, 293.66, 369.99, 440],
    bass: [98, 0, 123.47, 0, 98, 0, 123.47, 0]
  }
};

export const TRACKS = {
  lakeside: {
    name: "Lakeside",
    description: "Flowing lakeside circuit. Wide cambered curves, gentle rises.",
    palette: {
      sky: { top: "#1d2c5a", mid: "#5e4a92", bottom: "#ffa86a" },
      fog: 0x3a3a72,
      kerbA: 0xff5e3a, kerbB: 0xfbfdff,
      ground: 0x182d3a,
      moonLight: 0xfde2c4,
      fillRed: 0xff5a48,
      fillCyan: 0x70a8e8
    },
    // Smooth oval-ish loop with gentle elevation. No hairpins, no bridge crossings.
    points: [
      v(0, 0, 0),
      v(80, 0.2, 50),
      v(160, 0.6, 130),
      v(210, 1.0, 230),
      v(220, 1.2, 340),
      v(180, 1.0, 440),
      v(90, 0.8, 490),
      v(-30, 0.6, 480),
      v(-150, 0.4, 420),
      v(-230, 0.2, 320),
      v(-260, 0.0, 200),
      v(-240, 0.0, 80),
      v(-180, 0.0, -10),
      v(-90, 0.0, -50),
      v(0, 0.0, -30)
    ]
  },

  bayside: {
    name: "Bayside Boulevard",
    description: "Long ocean straights, sweeping cambered curves.",
    palette: {
      sky: { top: "#152452", mid: "#3a5092", bottom: "#ffb074" },
      fog: 0x3a4880,
      kerbA: 0xff5a48, kerbB: 0xfbfdff,
      ground: 0x102438,
      moonLight: 0xfde2c4,
      fillRed: 0xff5a48,
      fillCyan: 0x6ab4d8
    },
    points: [
      v(0, 0, 0), v(80, 0.2, 60), v(160, 0.4, 140),
      v(220, 0.6, 240), v(220, 1.0, 360), v(160, 1.2, 460),
      v(40, 1.4, 480), v(-100, 1.4, 440), v(-200, 1.0, 360),
      v(-240, 0.6, 240), v(-220, 0.2, 120), v(-140, 0.0, 30),
      v(-50, 0.0, -10)
    ]
  },

  highway: {
    name: "Coastal Highway",
    description: "High-speed straights joined by long sweepers. Top-end test.",
    palette: {
      sky: { top: "#1c2a4a", mid: "#5a3a6a", bottom: "#ffae6c" },
      fog: 0x4a3a5a,
      kerbA: 0xffd166, kerbB: 0xfbfdff,
      ground: 0x1a2632,
      moonLight: 0xffe2b6,
      fillRed: 0xff5a48,
      fillCyan: 0xa890d8
    },
    // Long straights with wide, fast sweepers. Mostly flat, a couple gentle rises.
    points: [
      v(0, 0, 0),
      v(120, 0.0, 40),
      v(240, 0.2, 120),
      v(320, 0.6, 240),
      v(330, 0.8, 380),
      v(280, 0.6, 500),
      v(160, 0.4, 580),
      v(20, 0.2, 600),
      v(-120, 0.2, 580),
      v(-240, 0.4, 520),
      v(-320, 0.6, 400),
      v(-340, 0.4, 260),
      v(-300, 0.2, 140),
      v(-220, 0.0, 40),
      v(-100, 0.0, -10),
      v(0, 0.0, -20)
    ]
  },

  neon: {
    name: "Neon Highway",
    description: "Cyberpunk overpass. Long blasts.",
    palette: {
      sky: { top: "#1a0c4a", mid: "#5a1a72", bottom: "#ff4ca8" },
      fog: 0x4a1a72,
      kerbA: 0xff48b6, kerbB: 0x4ce8ff,
      ground: 0x1a0a32,
      moonLight: 0xffb0d8,
      fillRed: 0xff48b6,
      fillCyan: 0x4ce8ff
    },
    points: [
      v(0, 0, 0), v(80, 0, 60), v(180, 0.3, 80),
      v(280, 0.6, 50), v(360, 0.8, -40), v(380, 1.0, -160),
      v(320, 0.8, -260), v(200, 0.6, -300), v(60, 0.4, -300),
      v(-80, 0.2, -260), v(-180, 0.0, -180), v(-220, 0.0, -80),
      v(-180, 0.0, 0), v(-80, 0.0, 30)
    ]
  },

  // Mountain pass — tight technical sweepers + elevation. Touge feel.
  mountainpass: {
    name: "Akagi Pass",
    description: "Technical mountain pass with elevation + tight switchbacks.",
    palette: {
      sky: { top: "#1c1840", mid: "#5a2c6e", bottom: "#ff8c5a" },
      fog: 0x3a2a5a,
      kerbA: 0xff6a3a, kerbB: 0xfbfdff,
      ground: 0x121e30,
      moonLight: 0xfde2c4,
      fillRed: 0xff6a48,
      fillCyan: 0x70a8e8
    },
    points: [
      v(0, 0, 0),
      v(60, 0.4, 60),
      v(140, 1.2, 100),
      v(180, 2.0, 180),
      v(160, 2.8, 280),
      v(100, 3.4, 360),
      v(20, 3.6, 380),
      v(-80, 3.4, 340),
      v(-160, 2.6, 260),
      v(-200, 1.8, 160),
      v(-220, 0.8, 60),
      v(-200, 0.2, -40),
      v(-140, 0.0, -90),
      v(-60, 0.0, -60),
      v(20, 0.0, -20)
    ]
  },

  // City circuit — flat downtown. Smoothed corners (no hard right angles)
  // so the chordal-spline curve doesn't pinch.
  city: {
    name: "Akihabara Circuit",
    description: "Downtown street circuit. Hard braking zones, neon walls.",
    palette: {
      sky: { top: "#0c1c3a", mid: "#3a3270", bottom: "#ff5a7c" },
      fog: 0x382860,
      kerbA: 0xfbfdff, kerbB: 0xff315c,
      ground: 0x101a28,
      moonLight: 0xfff3c4,
      fillRed: 0xff5a7c,
      fillCyan: 0x4cb8e8
    },
    points: [
      v(0, 0, 0),
      v(80, 0, 10),
      v(160, 0, 30),
      v(220, 0, 70),
      v(250, 0, 140),
      v(260, 0, 220),
      v(240, 0, 290),
      v(180, 0, 330),
      v(80, 0, 340),
      v(-30, 0, 330),
      v(-130, 0, 300),
      v(-200, 0, 240),
      v(-240, 0, 160),
      v(-230, 0, 80),
      v(-180, 0, 20),
      v(-100, 0, -10)
    ]
  }
};
