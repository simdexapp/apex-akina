// Track recipes for the 3D engine. Each entry has metadata + control points + palette.

import * as THREE from "three";

const v = (x, y, z) => new THREE.Vector3(x, y, z);

export const TRACKS = {
  lakeside: {
    name: "Lakeside",
    description: "Flowing lakeside circuit. Wide cambered curves, gentle rises.",
    palette: {
      sky: { top: "#0a1224", mid: "#1c2a48", bottom: "#5a6c8a" },
      fog: 0x182740,
      kerbA: 0xb84a3a, kerbB: 0xeaeef5,
      ground: 0x0a1422,
      moonLight: 0xc8d0e8,
      fillRed: 0xa84838,
      fillCyan: 0x5878a8
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
      sky: { top: "#0a1430", mid: "#1a3460", bottom: "#3a6080" },
      fog: 0x16284a,
      kerbA: 0xc24c3a, kerbB: 0xeaeef5,
      ground: 0x06121e,
      moonLight: 0xc8d8ff,
      fillRed: 0xa84838,
      fillCyan: 0x4a86b0
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
      sky: { top: "#0c1422", mid: "#28342a", bottom: "#88a092" },
      fog: 0x182618,
      kerbA: 0xb89238, kerbB: 0xe8dcb8,
      ground: 0x0a1216,
      moonLight: 0xd0c898,
      fillRed: 0x9c6c30,
      fillCyan: 0x7aa088
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
      sky: { top: "#0c0820", mid: "#2a1240", bottom: "#a83778" },
      fog: 0x180a30,
      kerbA: 0xc83a8a, kerbB: 0x4cb8c8,
      ground: 0x070416,
      moonLight: 0xd896b8,
      fillRed: 0xa8307a,
      fillCyan: 0x3098a8
    },
    points: [
      v(0, 0, 0), v(80, 0, 60), v(180, 0.3, 80),
      v(280, 0.6, 50), v(360, 0.8, -40), v(380, 1.0, -160),
      v(320, 0.8, -260), v(200, 0.6, -300), v(60, 0.4, -300),
      v(-80, 0.2, -260), v(-180, 0.0, -180), v(-220, 0.0, -80),
      v(-180, 0.0, 0), v(-80, 0.0, 30)
    ]
  }
};
