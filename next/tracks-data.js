// Track recipes for the 3D engine. Each entry has metadata + control points + palette.

import * as THREE from "three";

const v = (x, y, z) => new THREE.Vector3(x, y, z);

export const TRACKS = {
  akina: {
    name: "Akina Pass",
    description: "Mountain hairpins, dramatic climbs and dives.",
    palette: {
      sky: { top: "#08101e", mid: "#1c1b3a", bottom: "#5a4060" },
      fog: 0x1a1830,
      kerbA: 0xc73d56, kerbB: 0xeaeef5,
      ground: 0x0a0f1a,
      moonLight: 0xc8d0e8,
      fillRed: 0xc23a55,
      fillCyan: 0x4a8aa8
    },
    points: [
      v(0, 0, 0),
      v(70, 0.5, 40),
      v(140, 1.4, 110),
      v(180, 2.6, 200),     // ridge approach
      v(170, 4.2, 290),     // ridge top (high bridge)
      v(110, 5.0, 360),     // peak
      v(20, 4.8, 380),
      v(-70, 4.0, 350),
      v(-140, 2.6, 280),    // descent
      v(-180, 1.6, 180),
      v(-200, 0.8, 80),
      v(-180, 0.4, -20),    // base of descent
      v(-130, 1.4, -90),    // climbing hairpin
      v(-60, 2.4, -110),
      v(20, 2.8, -90),      // crest
      v(60, 2.0, -30),
      v(40, 0.8, 30)
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

  akagi: {
    name: "Akagi Loop",
    description: "Tight switchbacks. No room to breathe.",
    palette: {
      sky: { top: "#0c1722", mid: "#22321c", bottom: "#7a5a3a" },
      fog: 0x101a16,
      kerbA: 0xc09038, kerbB: 0xe8dcb8,
      ground: 0x081210,
      moonLight: 0xd0c898,
      fillRed: 0x9c6c30,
      fillCyan: 0x6a8c58
    },
    // Tighter control points for hairpin feel.
    points: [
      v(0, 0, 0), v(40, 0, 20), v(70, 0.5, 60),
      v(80, 1.0, 110), v(50, 1.5, 150), v(0, 1.8, 160),
      v(-50, 2.0, 130), v(-50, 2.3, 80), v(-10, 2.4, 50),
      v(20, 2.2, 10), v(0, 1.8, -30), v(-50, 1.4, -50),
      v(-100, 1.0, -30), v(-110, 0.6, 20), v(-80, 0.2, 50),
      v(-30, 0.0, 30)
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
