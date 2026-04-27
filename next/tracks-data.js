// Track recipes for the 3D engine. Each entry has metadata + control points + palette.

import * as THREE from "three";

const v = (x, y, z) => new THREE.Vector3(x, y, z);

export const TRACKS = {
  akina: {
    name: "Akina Pass",
    description: "Mountain hairpins. The classic touge battleground.",
    palette: {
      sky: { top: "#0a0f2c", mid: "#3a1656", bottom: "#ff5f4c" },
      fog: 0x1a1240,
      kerbA: 0xff385f, kerbB: 0xfbfdff,
      ground: 0x0d1024,
      moonLight: 0xb6c8ff,
      fillRed: 0xff315c,
      fillCyan: 0x2ee9ff
    },
    points: [
      v(0, 0, 0), v(60, 0, 30), v(120, 0.5, 90),
      v(140, 1.0, 170), v(110, 1.6, 240), v(40, 2.2, 280),
      v(-40, 2.6, 270), v(-110, 2.4, 220), v(-160, 1.8, 140),
      v(-150, 1.0, 60), v(-90, 0.4, -10), v(-30, 0.0, -20)
    ]
  },

  bayside: {
    name: "Bayside Boulevard",
    description: "Long ocean straights, sweeping cambered curves.",
    palette: {
      sky: { top: "#0c1840", mid: "#1f4a8a", bottom: "#5fc5ff" },
      fog: 0x152e58,
      kerbA: 0xff4a3a, kerbB: 0xfbfdff,
      ground: 0x081428,
      moonLight: 0xc8d8ff,
      fillRed: 0xff6b2a,
      fillCyan: 0x5fc5ff
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
      sky: { top: "#0d1a2a", mid: "#2a3818", bottom: "#d68a3a" },
      fog: 0x101a14,
      kerbA: 0xffb834, kerbB: 0xfff4d0,
      ground: 0x0a1310,
      moonLight: 0xe8d8a0,
      fillRed: 0xd68a3a,
      fillCyan: 0x88c060
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
      sky: { top: "#0e0220", mid: "#360a55", bottom: "#ff2da8" },
      fog: 0x1a0535,
      kerbA: 0xff2da8, kerbB: 0x39f0ff,
      ground: 0x080518,
      moonLight: 0xff80c0,
      fillRed: 0xff2da8,
      fillCyan: 0x39f0ff
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
