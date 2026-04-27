"use strict";

const canvas = document.getElementById("game");
let ctx = canvas.getContext("2d");
const mainCtx = ctx;

const ui = {
  lap: document.getElementById("lap"),
  place: document.getElementById("place"),
  speed: document.getElementById("speed"),
  time: document.getElementById("time"),
  gear: document.getElementById("gear"),
  boost: document.getElementById("boost"),
  engineBar: document.getElementById("engine-bar"),
  engineMeter: document.querySelector(".engine-meter"),
  comboStack: document.getElementById("combo-stack"),
  comboValue: document.getElementById("combo-value"),
  start: document.getElementById("start"),
  restart: document.getElementById("restart"),
  title: document.getElementById("title-card"),
  callout: document.getElementById("race-callout"),
  leaderboard: document.getElementById("leaderboard"),
  finish: document.getElementById("finish-panel"),
  finishTitle: document.getElementById("finish-title"),
  finishStats: document.getElementById("finish-stats"),
  touchControls: document.getElementById("touch-controls"),
  touchToggle: document.getElementById("touch-toggle"),
  muteToggle: document.getElementById("mute-toggle"),
  startPrerace: document.getElementById("start-prerace"),
  titleCardPb: document.getElementById("title-card-pb"),
  gameFrame: document.querySelector(".game-frame")
};

const KEY = new Set();

// 16-driver roster — first entry is the default player slot, the rest are rivals.
// Spread the 6 JDM archetypes across the field with varied liveries.
// Lane center reference for 5 lanes: ±0.8, ±0.4, 0.
const ROSTER = [
  { name: "You",    progress: 0.000, lane:  0.00, skill: 1.00, body: "#f7fbff", stripe: "#ff315c", shape: "gt" },
  // Front pack (skilled) — closest to player at start.
  { name: "Rina",   progress: 0.004, lane: -0.80, skill: 0.99, body: "#ff315c", stripe: "#ffd166", shape: "rally" },
  { name: "Mako",   progress: 0.008, lane: -0.40, skill: 0.99, body: "#2ee9ff", stripe: "#f7fbff", shape: "super" },
  { name: "Ren",    progress: 0.013, lane:  0.40, skill: 0.97, body: "#ffe156", stripe: "#101525", shape: "drift" },
  { name: "Kai",    progress: 0.018, lane:  0.80, skill: 0.98, body: "#a66cff", stripe: "#f7fbff", shape: "super" },
  { name: "Daichi", progress: 0.024, lane: -0.60, skill: 0.97, body: "#0d2240", stripe: "#2ee9ff", shape: "tuner" },
  // Mid pack.
  { name: "Jun",    progress: 0.030, lane:  0.20, skill: 0.96, body: "#f7fbff", stripe: "#ff315c", shape: "hatch" },
  { name: "Sora",   progress: 0.036, lane: -0.20, skill: 0.95, body: "#3cff9b", stripe: "#101525", shape: "drift" },
  { name: "Noa",    progress: 0.043, lane:  0.60, skill: 0.96, body: "#ff8f1f", stripe: "#f7fbff", shape: "rally" },
  { name: "Aki",    progress: 0.050, lane: -0.40, skill: 0.94, body: "#ff61b6", stripe: "#101525", shape: "hatch" },
  { name: "Tomo",   progress: 0.057, lane:  0.40, skill: 0.93, body: "#1aa6ff", stripe: "#ffd166", shape: "gt" },
  { name: "Yuki",   progress: 0.064, lane: -0.80, skill: 0.94, body: "#caff5e", stripe: "#101525", shape: "kei" },
  { name: "Saki",   progress: 0.071, lane:  0.00, skill: 0.95, body: "#5b6dff", stripe: "#f7fbff", shape: "wagon" },
  { name: "Riku",   progress: 0.078, lane:  0.80, skill: 0.93, body: "#ff7e1a", stripe: "#101525", shape: "drift" },
  { name: "Hina",   progress: 0.085, lane: -0.20, skill: 0.92, body: "#ffffff", stripe: "#ff315c", shape: "kei" },
  { name: "Eiji",   progress: 0.092, lane:  0.20, skill: 0.94, body: "#ff315c", stripe: "#101525", shape: "tuner" },
  // Back pack — newcomers, slower.
  { name: "Mei",    progress: 0.100, lane: -0.60, skill: 0.93, body: "#9af7ff", stripe: "#101525", shape: "wagon" },
  { name: "Yuto",   progress: 0.108, lane:  0.60, skill: 0.92, body: "#202842", stripe: "#ffd166", shape: "gt" },
  { name: "Haru",   progress: 0.116, lane:  0.00, skill: 0.93, body: "#ff42a6", stripe: "#f7fbff", shape: "tuner" },
  { name: "Kira",   progress: 0.124, lane: -0.40, skill: 0.91, body: "#ffd166", stripe: "#101525", shape: "drift" },
  { name: "Ryo",    progress: 0.132, lane:  0.80, skill: 0.92, body: "#3a4a82", stripe: "#2ee9ff", shape: "rally" },
  { name: "Sakura", progress: 0.140, lane: -0.80, skill: 0.91, body: "#ff315c", stripe: "#ffd166", shape: "hatch" },
  { name: "Rio",    progress: 0.148, lane:  0.20, skill: 0.90, body: "#ff8f1f", stripe: "#101525", shape: "kei" },
  { name: "Mio",    progress: 0.156, lane: -0.20, skill: 0.92, body: "#7c4cff", stripe: "#caff5e", shape: "wagon" },
  { name: "Taro",   progress: 0.164, lane:  0.40, skill: 0.90, body: "#101525", stripe: "#ff315c", shape: "drift" },
  { name: "Nao",    progress: 0.172, lane: -0.60, skill: 0.93, body: "#fbfdff", stripe: "#a66cff", shape: "super" }
];

// Per-shape gameplay stats. Multipliers around 1.0 — applied to MAX_SPEED, ACCEL, steerAuthority, centripetal, brake.
// `gears` controls how many auto-shift bands the car has — more gears = tighter ratios (more shift events) and harder to keep on cam.
const SHAPE_STATS = {
  gt:    { top: 0.99, accel: 0.92, handling: 0.95, grip: 1.05, brake: 1.00, gears: 6, label: "GT Coupe", description: "Smooth top-end weapon. 6-speed, planted in long sweepers." },
  drift: { top: 0.88, accel: 1.05, handling: 1.18, grip: 0.78, brake: 0.95, gears: 5, label: "Drift Coupe", description: "Loose rear, snappy 5-speed. Slides easy, top speed limited." },
  rally: { top: 0.94, accel: 1.04, handling: 0.98, grip: 1.18, brake: 1.05, gears: 6, label: "Rally Sedan", description: "AWD-ish grip. Punches out of corners and brakes hard." },
  super: { top: 1.04, accel: 1.06, handling: 0.92, grip: 1.10, brake: 1.05, gears: 8, label: "Wedge Super", description: "Top of the food chain. 8-speed close-ratio, heavy at the wheel." },
  hatch: { top: 0.90, accel: 1.02, handling: 1.15, grip: 0.96, brake: 1.00, gears: 6, label: "Sport Hatch", description: "Razor-sharp turn-in. Flicks through chicanes." },
  kei:   { top: 0.82, accel: 0.88, handling: 1.22, grip: 0.84, brake: 0.95, gears: 4, label: "Kei Pocket", description: "Tiny 4-speed. Awful straight-line, unfair in tight stuff." },
  wagon: { top: 0.92, accel: 0.96, handling: 1.02, grip: 1.08, brake: 1.02, gears: 6, label: "Sport Wagon", description: "Long roof, surprising grip. Versatile family killer." },
  tuner: { top: 1.00, accel: 1.02, handling: 1.06, grip: 1.04, brake: 1.02, gears: 7, label: "Wide Tuner", description: "Flared fenders, big wing. Built for the canyon." }
};

const AI_TOP_CAP = 0.90;

const ENGINE_PROFILES = {
  // Inline 6 — Skyline-ish: smooth, mid-pitched sawtooth with octave-up triangle.
  gt: {
    type1: "sawtooth", type2: "triangle",
    idleHz: 64, redlineHz: 320,
    detune2: 1200, gain2: 0.32,
    lpfBase: 360, lpfTop: 2200, lpfQ: 3,
    pulseIdle: 6, pulseTop: 22, pulseDepth: 0.42,
    body: 0.14
  },
  // High-revving I4 — AE86: rasp, slightly bright square.
  drift: {
    type1: "square", type2: "sawtooth",
    idleHz: 86, redlineHz: 440,
    detune2: 700, gain2: 0.22,
    lpfBase: 480, lpfTop: 2900, lpfQ: 5,
    pulseIdle: 7, pulseTop: 30, pulseDepth: 0.55,
    body: 0.11
  },
  // Turbo I4 — Evo/WRX: boomy mid-range, sub octave underneath.
  rally: {
    type1: "sawtooth", type2: "sine",
    idleHz: 70, redlineHz: 320,
    detune2: -1200, gain2: 0.4,
    lpfBase: 280, lpfTop: 1700, lpfQ: 4,
    pulseIdle: 5, pulseTop: 18, pulseDepth: 0.5,
    body: 0.16
  },
  // V6 / rotary — NSX/RX-7: smooth, slightly higher harmonic structure.
  super: {
    type1: "sawtooth", type2: "triangle",
    idleHz: 100, redlineHz: 500,
    detune2: 700, gain2: 0.3,
    lpfBase: 450, lpfTop: 3400, lpfQ: 4,
    pulseIdle: 9, pulseTop: 32, pulseDepth: 0.36,
    body: 0.12
  },
  // High-rev I4 — Civic Type R: peaky, bright.
  hatch: {
    type1: "square", type2: "sawtooth",
    idleHz: 96, redlineHz: 510,
    detune2: 1200, gain2: 0.26,
    lpfBase: 560, lpfTop: 3500, lpfQ: 6,
    pulseIdle: 8, pulseTop: 32, pulseDepth: 0.5,
    body: 0.10
  },
  // Tiny I3 — kei: thin, tinny, lots of high content.
  kei: {
    type1: "square", type2: "triangle",
    idleHz: 120, redlineHz: 520,
    detune2: 1900, gain2: 0.18,
    lpfBase: 680, lpfTop: 2800, lpfQ: 5,
    pulseIdle: 10, pulseTop: 28, pulseDepth: 0.45,
    body: 0.09
  },
  // Wagon — torquey turbo I4, slightly muffled by the body.
  wagon: {
    type1: "sawtooth", type2: "sine",
    idleHz: 74, redlineHz: 340,
    detune2: -1200, gain2: 0.42,
    lpfBase: 320, lpfTop: 1900, lpfQ: 4,
    pulseIdle: 6, pulseTop: 22, pulseDepth: 0.46,
    body: 0.14
  },
  // Tuner — high-revving aggressive coupe with twin-cam character.
  tuner: {
    type1: "sawtooth", type2: "square",
    idleHz: 90, redlineHz: 460,
    detune2: 700, gain2: 0.34,
    lpfBase: 480, lpfTop: 3000, lpfQ: 6,
    pulseIdle: 8, pulseTop: 28, pulseDepth: 0.5,
    body: 0.13
  }
};

let playerCarShape = "gt";
let selectedRoster = ROSTER[0];
const PLAYER_PICK_KEY = "apex-akina:car";

const audio = (() => {
  let ctx = null;
  let master = null;
  let osc1 = null;
  let osc2 = null;
  let osc2Detune = null;
  let engineGain = null;
  let engineLowpass = null;
  let stressFilter = null;
  let stressGain = null;
  let pulseLfo = null;
  let pulseLfoGain = null;
  let tireNoise = null;
  let tireGain = null;
  let tireBandpass = null;
  let musicGain = null;
  let musicScheduler = null;
  let musicNextBeatTime = 0;
  let musicBeatIdx = 0;
  let muted = false;
  let activeProfile = ENGINE_PROFILES.gt;
  let lastGearIdx = -1;
  let shiftEventTime = -10;

  function ensure() {
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      ctx = new Ctx();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.4;
      master.connect(ctx.destination);

      osc1 = ctx.createOscillator();
      osc1.type = activeProfile.type1;
      osc1.frequency.value = activeProfile.idleHz;
      // Slight detune for thickness instead of buzz.
      osc1.detune.value = -8;

      osc2 = ctx.createOscillator();
      osc2.type = activeProfile.type2;
      osc2.frequency.value = activeProfile.idleHz;
      osc2.detune.value = activeProfile.detune2 + 8;
      osc2Detune = ctx.createGain();
      osc2Detune.gain.value = activeProfile.gain2;

      engineLowpass = ctx.createBiquadFilter();
      engineLowpass.type = "lowpass";
      engineLowpass.frequency.value = activeProfile.lpfBase;
      engineLowpass.Q.value = activeProfile.lpfQ;

      // Stress (engine wear) — gentle highpass distortion that swells when health is low.
      stressFilter = ctx.createBiquadFilter();
      stressFilter.type = "highpass";
      stressFilter.frequency.value = 1500;
      stressFilter.Q.value = 4;
      stressGain = ctx.createGain();
      stressGain.gain.value = 0;

      engineGain = ctx.createGain();
      engineGain.gain.value = 0;

      // Tremolo LFO modulates engineGain to give exhaust pulse character.
      pulseLfo = ctx.createOscillator();
      pulseLfo.type = "sine";
      pulseLfo.frequency.value = activeProfile.pulseIdle;
      pulseLfoGain = ctx.createGain();
      pulseLfoGain.gain.value = 0;
      pulseLfo.connect(pulseLfoGain);
      pulseLfoGain.connect(engineGain.gain);

      osc1.connect(engineLowpass);
      osc2.connect(osc2Detune);
      osc2Detune.connect(engineLowpass);
      engineLowpass.connect(engineGain);
      engineGain.connect(master);

      // Stress branch taps the lowpass output through highpass.
      engineLowpass.connect(stressFilter);
      stressFilter.connect(stressGain);
      stressGain.connect(master);

      osc1.start();
      osc2.start();
      pulseLfo.start();

      const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
      tireNoise = ctx.createBufferSource();
      tireNoise.buffer = buffer;
      tireNoise.loop = true;
      tireBandpass = ctx.createBiquadFilter();
      tireBandpass.type = "bandpass";
      tireBandpass.frequency.value = 1750;  // lower, more rubber/skreee, less hiss
      tireBandpass.Q.value = 11;             // higher Q so it's pitched, not spray
      tireGain = ctx.createGain();
      tireGain.gain.value = 0;
      tireNoise.connect(tireBandpass);
      tireBandpass.connect(tireGain);
      tireGain.connect(master);
      tireNoise.start();

      // Backing music bus.
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.0;
      musicGain.connect(master);
      startMusicLoop();
    } catch (_) {
      ctx = null;
    }
  }

  // 16-step minor-key arp pattern (D minor: D, F, A, C high), with bass on beats 1 and 3.
  // Frequencies in Hz.
  const MUSIC_TEMPO = 96; // BPM
  const MUSIC_BEAT_SEC = 60 / MUSIC_TEMPO / 2; // 8th-note grid
  const ARP_NOTES = [
    146.83, 174.61, 220.00, 261.63, // D3 F3 A3 C4
    220.00, 261.63, 329.63, 220.00, // A3 C4 E4 A3
    146.83, 174.61, 220.00, 261.63,
    174.61, 220.00, 261.63, 329.63
  ];
  const BASS_NOTES = [73.42, 0, 87.31, 0, 73.42, 0, 87.31, 0];

  function playArpNote(freq, time, duration) {
    if (!ctx || freq <= 0) return;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.16, time + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(lp);
    lp.connect(g);
    g.connect(musicGain);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  function playBassNote(freq, time, duration) {
    if (!ctx || freq <= 0) return;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 380;
    lp.Q.value = 5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.34, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(lp);
    lp.connect(g);
    g.connect(musicGain);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  function startMusicLoop() {
    musicNextBeatTime = ctx.currentTime + 0.1;
    musicBeatIdx = 0;
    if (musicScheduler) clearInterval(musicScheduler);
    musicScheduler = setInterval(() => {
      if (!ctx) return;
      // Schedule notes ~250ms ahead of currentTime.
      while (musicNextBeatTime < ctx.currentTime + 0.25) {
        const arpFreq = ARP_NOTES[musicBeatIdx % ARP_NOTES.length];
        const bassFreq = BASS_NOTES[musicBeatIdx % BASS_NOTES.length];
        playArpNote(arpFreq, musicNextBeatTime, MUSIC_BEAT_SEC * 1.6);
        playBassNote(bassFreq, musicNextBeatTime, MUSIC_BEAT_SEC * 2.2);
        musicNextBeatTime += MUSIC_BEAT_SEC;
        musicBeatIdx++;
      }
    }, 60);
  }

  function setMusicLevel(level) {
    if (!ctx || !musicGain) return;
    musicGain.gain.setTargetAtTime(level, ctx.currentTime, 0.4);
  }

  function setProfile(name) {
    activeProfile = ENGINE_PROFILES[name] || ENGINE_PROFILES.gt;
    if (!ctx) return;
    osc1.type = activeProfile.type1;
    osc2.type = activeProfile.type2;
    osc2.detune.setTargetAtTime(activeProfile.detune2, ctx.currentTime, 0.1);
    osc2Detune.gain.setTargetAtTime(activeProfile.gain2, ctx.currentTime, 0.1);
    engineLowpass.Q.setTargetAtTime(activeProfile.lpfQ, ctx.currentTime, 0.1);
  }

  function update(state, MAX_SPEED) {
    if (!ctx) return;
    const sp = Math.max(0, Math.min(1, state.speed / MAX_SPEED));
    const active = state.running || state.countdown > 0;
    const engineHealth = state.engineHealth != null ? state.engineHealth : 1;
    const labor = 1 - engineHealth;
    const input = state.lastInput || { throttle: false, brake: false };
    const onThrottle = !!input.throttle;
    const onBrake = !!input.brake;
    const offThrottle = active && !onThrottle && !onBrake;
    const range = activeProfile.redlineHz - activeProfile.idleHz;

    // Automatic transmission: each gear sweeps idle→redline within its own band.
    const gears = state.gears || 6;
    const gearSize = 1 / gears;
    let gearIdx, gearProgress;
    if (sp < 0.03) {
      gearIdx = 0;
      gearProgress = sp / 0.03;
    } else {
      gearIdx = Math.min(gears, Math.floor(sp / gearSize) + 1);
      gearProgress = ((sp - (gearIdx - 1) * gearSize) / gearSize);
    }
    state.currentGear = gearIdx;

    // Detect upshift / downshift events (only when active and after warm-up).
    if (active && lastGearIdx > 0 && gearIdx !== lastGearIdx) {
      shiftEventTime = ctx.currentTime;
      if (gearIdx > lastGearIdx) playShift();
    }
    lastGearIdx = gearIdx;

    // Shift dip: brief frequency + gain pull-down right after a shift.
    const sinceShift = ctx.currentTime - shiftEventTime;
    const shiftDip = sinceShift < 0.2 ? Math.exp(-sinceShift / 0.07) : 0;

    // RPM-shaped frequency: low at start of gear, high at end of gear, with a dip on shift.
    const gearRpmBase = activeProfile.idleHz + Math.pow(gearProgress, 0.85) * range * 0.95;

    // Load shapes how the engine sounds independent of speed.
    const freqMul = onThrottle ? 1.05 : onBrake ? 0.86 : offThrottle ? 0.92 : 1.0;
    const wobble = labor > 0.2 ? Math.sin(ctx.currentTime * 7) * range * 0.04 * (labor - 0.2) : 0;
    const targetFreq = gearRpmBase * freqMul * (1 - shiftDip * 0.32)
      + (state.boostKick > 0 ? range * 0.22 : 0) + wobble;
    osc1.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.018);
    osc2.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.018);

    // Load + shift-aware gain.
    const loadGain = onThrottle ? 1.0 : onBrake ? 0.34 : offThrottle ? 0.50 : 0.30;
    const baseGain = active
      ? activeProfile.body * (0.30 + sp * 0.65) * loadGain * (1 - shiftDip * 0.55)
      : activeProfile.body * 0.14;
    engineGain.gain.setTargetAtTime(baseGain, ctx.currentTime, 0.022);

    // Pulse LFO follows the in-gear RPM, not absolute speed — so pulse rate cycles between gears too.
    const pulsePerGear = activeProfile.pulseIdle + gearProgress * (activeProfile.pulseTop - activeProfile.pulseIdle);
    const pulseHz = (pulsePerGear + labor * 6) * (onThrottle ? 1.0 : 0.78);
    pulseLfo.frequency.setTargetAtTime(pulseHz, ctx.currentTime, 0.04);
    const pulseDepth = active ? baseGain * (activeProfile.pulseDepth + labor * 0.55) * (onThrottle ? 1.0 : 0.6) : 0;
    pulseLfoGain.gain.setTargetAtTime(pulseDepth, ctx.currentTime, 0.04);

    // Lowpass: brighter on throttle, much darker on coast/brake. Also dips slightly during shift.
    const lpfBase = activeProfile.lpfBase + gearProgress * (activeProfile.lpfTop - activeProfile.lpfBase);
    const lpfMul = onThrottle ? 1.0 : onBrake ? 0.42 : offThrottle ? 0.55 : 0.5;
    const lpfTarget = lpfBase * lpfMul * (1 - labor * 0.40) * (1 - shiftDip * 0.25);
    engineLowpass.frequency.setTargetAtTime(lpfTarget, ctx.currentTime, 0.05);

    stressGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);

    // Music level — quiet during pre-race, fuller during the race.
    const musicTarget = active ? 0.35 : 0.10;
    setMusicLevel(musicTarget);

    const slipMag = Math.min(1, Math.abs(state.slip));
    const tireSlip = state.tireSlip || 0;
    const screechSource = Math.max(slipMag * 0.7, tireSlip);
    // Pulsing "skrrrt" envelope — fast LFO at ~9 Hz with a slight randomized edge.
    const skrrrtPulse = 0.6 + 0.4 * Math.abs(Math.sin(ctx.currentTime * 28 + Math.sin(ctx.currentTime * 4)));
    const screechBase = active && screechSource > 0.25 && sp > 0.3 ? Math.min(0.36, screechSource * 0.55) : 0;
    const screech = screechBase * skrrrtPulse;
    tireGain.gain.setTargetAtTime(screech, ctx.currentTime, 0.025);
    // Bandpass freq sweeps slightly with sustain — gives the "skreee → skrrr" timbre.
    const bpTarget = 1500 + tireSlip * 700 + Math.sin(ctx.currentTime * 6) * 80;
    tireBandpass.frequency.setTargetAtTime(bpTarget, ctx.currentTime, 0.04);
  }

  function playShift() {
    if (!ctx) return;
    const now = ctx.currentTime;
    // Brief turbo blow-off / clutch click via filtered noise burst.
    const dur = 0.11;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const env = 1 - i / data.length;
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1100;
    filter.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.18, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(now);
    src.stop(now + dur + 0.02);
  }

  function blip({ type = "square", from, to, duration, gain = 0.3 }) {
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(to, now + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(g);
    g.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  return {
    ensure,
    update,
    setProfile,
    resetShift() { lastGearIdx = -1; shiftEventTime = -10; },
    hit(intensity = 1) {
      blip({ type: "square", from: 220 + Math.random() * 80, to: 50, duration: 0.22, gain: 0.36 * intensity });
    },
    boost() {
      blip({ type: "sawtooth", from: 200, to: 700, duration: 0.42, gain: 0.22 });
    },
    pb() {
      blip({ type: "triangle", from: 660, to: 990, duration: 0.55, gain: 0.24 });
    },
    setMuted(value) {
      muted = !!value;
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.4, ctx.currentTime, 0.05);
    },
    isMuted: () => muted
  };
})();

const PB_KEY = "apex-akina:best-lap";
const bestLapStorage = {
  read() {
    try {
      const raw = localStorage.getItem(PB_KEY);
      const value = raw == null ? NaN : parseFloat(raw);
      return Number.isFinite(value) && value > 0 ? value : null;
    } catch (_) {
      return null;
    }
  },
  write(seconds) {
    try {
      localStorage.setItem(PB_KEY, String(seconds));
    } catch (_) {}
  }
};
let allTimeBestLap = bestLapStorage.read();
const SEGMENT_LENGTH = 200;
const ROAD_WIDTH = 4400;
const DRAW_DISTANCE = 220;
const CAMERA_HEIGHT = 950;
const FIELD_OF_VIEW = 100;
const CAMERA_DEPTH = 1 / Math.tan((FIELD_OF_VIEW / 2) * Math.PI / 180);
const LANES = 5;
const RUMBLE_LENGTH = 3;
const MAX_SPEED = SEGMENT_LENGTH * 88;
const ACCEL = MAX_SPEED / 4.4;
const BRAKE = MAX_SPEED / 1.6;
const DECEL = MAX_SPEED / 7.2;
const OFF_ROAD_DECEL = MAX_SPEED / 2.2;
const CENTRIFUGAL = 0.42;
const SPEED_DISPLAY_MAX = 245;
const BOOST_SPEED_MUL = 1.22;
const LAPS_TOTAL = 5;
const START_COUNTDOWN = 3.25;
const REDLINE_PCT = 0.94;
const CRUISE_PCT = 0.62;
const ENGINE_WEAR_RATE = 0.26;
const ENGINE_RECOVERY_RATE = 0.22;
const ENGINE_BLOWN_FLOOR = 0.78;

let width = canvas.width;
let height = canvas.height;
let roadHorizon = 0;
let roadBottom = 0;
let playerZ = CAMERA_HEIGHT * CAMERA_DEPTH;
let trackLength = 0;
let segments = [];
let cars = [];
let smoke = [];
let sparks = [];
let state;
let lastTime = performance.now();
let segmentsWithCars = [];
let leaderboardLastUpdate = 0;
const PARTICLE_CAP = 90;

const DEFAULT_PALETTE = {
  skyTop: "#0a0f2c",
  skyMid: "#3a1656",
  skyLow: "#ff5f4c",
  grassA: "#0f1729",
  grassB: "#181225",
  rumbleA: "#ff385f",
  rumbleB: "#fbfdff",
  roadA: "#1d222f",
  roadB: "#141823",
  lane: "rgba(255, 255, 255, 0.85)",
  laneDash: "rgba(255, 209, 102, 0.92)",
  mountainFar: "#0c1432",
  mountainMid: "#15193a",
  mountainNear: "#1c1740",
  cityShadow: "#070b1c",
  cityHighlight: "rgba(46, 233, 255, 0.05)"
};
let colors = { ...DEFAULT_PALETTE };

// Pre-baked star field (deterministic based on seeded RNG so positions stay stable).
const STAR_FIELD = (() => {
  const rng = (seed) => {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0xFFFFFFFF;
    };
  };
  const r = rng(20260427);
  const stars = [];
  for (let i = 0; i < 90; i++) {
    stars.push({
      x: r(),                   // 0..1 of width
      y: r() * 0.55,            // upper part of frame
      size: 0.4 + r() * 1.6,
      bright: 0.4 + r() * 0.6,
      twinkle: r() * Math.PI * 2,
      twinkleRate: 0.6 + r() * 1.6,
      hue: r() < 0.18 ? "#ff8fb6" : r() < 0.4 ? "#9aa6ff" : "#f7fbff"
    });
  }
  return stars;
})();

function resetState() {
  state = {
    running: false,
    finished: false,
    countdown: 0,
    position: 0,
    lap: 1,
    distance: 0,
    playerX: -0.55,
    lateralV: 0,
    speed: 0,
    steer: 0,
    slip: 0,
    yaw: 0,
    cameraTilt: 0,
    drift: 0,
    boost: 0.22,
    boostKick: 0,
    engineHealth: 1,
    engineRedlineTime: 0,
    engineWarned: false,
    tireLoad: 0,
    tireBudget: 1,
    tireSlip: 0,
    stunT: 0,
    combo: 0,
    comboTimer: 0,
    comboBest: 0,
    slowmoT: 0,
    raceTime: 0,
    bestLap: Infinity,
    currentLapTime: 0,
    hitFlash: 0,
    place: 1,
    lastPlace: null,
    cameraShake: 0,
    cameraLateralPush: 0,
    fovPunch: 0,
    nightPulse: 0,
    calloutText: "",
    calloutTimer: 0,
    calloutScale: 1,
    apexCooldown: 0,
    draft: 0,
    driftCombo: 0,
    lastDriftBonus: 0,
    lastSector: "city"
  };

  state.playerName = selectedRoster.name;
  state.playerStats = SHAPE_STATS[selectedRoster.shape] || SHAPE_STATS.gt;
  state.gears = state.playerStats.gears || 6;
  state.currentGear = 1;
  playerCarShape = selectedRoster.shape;
  cars = ROSTER
    .filter((entry) => entry.name !== state.playerName)
    .map((entry) => makeCar(entry.name, entry.progress, entry.lane, entry.skill, entry.body, entry.stripe, entry.shape));

  smoke = [];
  sparks = [];

  state.place = cars.length + 1;
}

function makeCar(name, progress, lane, skill, body, stripe, shape = "gt") {
  const stats = SHAPE_STATS[shape] || SHAPE_STATS.gt;
  const rawTop = MAX_SPEED * stats.top * skill;
  return {
    name,
    z: progress * trackLength,
    offset: lane,
    baseOffset: lane,
    homeOffset: lane,
    speed: 0,
    targetSpeed: Math.min(rawTop, MAX_SPEED * AI_TOP_CAP),
    body,
    stripe,
    shape,
    wobble: Math.random() * Math.PI * 2,
    rankDistance: progress * trackLength,
    contactT: 0,
    nearMissArmed: false,
    lastDz: 0
  };
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(320, Math.floor(rect.width * dpr));
  canvas.height = Math.max(320, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  width = rect.width;
  height = rect.height;
  roadHorizon = height * 0.50;
  roadBottom = height * 0.95;
}

function percentRemaining(n, total) {
  return (n % total) / total;
}

function increase(start, increment, max) {
  let result = start + increment;
  while (result >= max) result -= max;
  while (result < 0) result += max;
  return result;
}

function interpolate(a, b, percent) {
  return a + (b - a) * percent;
}

function easeIn(a, b, percent) {
  return a + (b - a) * Math.pow(percent, 2);
}

function easeOut(a, b, percent) {
  return a + (b - a) * (1 - Math.pow(1 - percent, 2));
}

function easeInOut(a, b, percent) {
  return a + (b - a) * ((-Math.cos(percent * Math.PI) / 2) + 0.5);
}

function addSegment(curve, y) {
  const n = segments.length;
  segments.push({
    index: n,
    p1: { world: { y: lastY(), z: n * SEGMENT_LENGTH }, camera: {}, screen: {} },
    p2: { world: { y, z: (n + 1) * SEGMENT_LENGTH }, camera: {}, screen: {} },
    curve,
    clip: 0,
    sprites: [],
    cars: [],
    skidMarks: [],
    color: Math.floor(n / RUMBLE_LENGTH) % 2 ? "A" : "B"
  });
}

function lastY() {
  return segments.length === 0 ? 0 : segments[segments.length - 1].p2.world.y;
}

function addRoad(enter, hold, leave, curve, y) {
  const startY = lastY();
  const endY = startY + (y * SEGMENT_LENGTH);
  const total = enter + hold + leave;
  for (let n = 0; n < enter; n++) addSegment(easeIn(0, curve, n / enter), easeInOut(startY, endY, n / total));
  for (let n = 0; n < hold; n++) addSegment(curve, easeInOut(startY, endY, (enter + n) / total));
  for (let n = 0; n < leave; n++) addSegment(easeOut(curve, 0, n / leave), easeInOut(startY, endY, (enter + hold + n) / total));
}

function addStraight(n) {
  addRoad(n, n, n, 0, 0);
}

function addCurve(n, curve, y = 0) {
  addRoad(n, n, n, curve, y);
}

function addLowRollingHills(n) {
  addRoad(n, n, n, 0, 18);
  addRoad(n, n, n, 0, -22);
  addRoad(n, n, n, 0, 14);
  addRoad(n, n, n, 0, -10);
}

function addSCurves() {
  addRoad(22, 38, 22, -3.2, 0);
  addRoad(18, 34, 18, 3.8, 8);
  addRoad(18, 34, 18, 2.5, -10);
  addRoad(18, 30, 18, -4.4, 0);
}

// ---- Track recipes ----
const TRACKS = {
  akina: {
    name: "Akina Pass",
    description: "Mountain hairpins. The classic touge battleground.",
    palette: { /* default purple/red dusk */ },
    build() {
      addStraight(28);
      addCurve(22, 1.6, 2);
      addStraight(20);
      addCurve(34, -4.3, 12);
      addStraight(18);
      addSCurves();
      addStraight(20);
      addCurve(42, 5.1, -18);
      addLowRollingHills(14);
      addCurve(36, -5.8, 6);
      addStraight(30);
      addCurve(28, 3.2, 0);
      addRoad(18, 18, 18, 0, -12);
      addCurve(30, -2.4, 0);
      addStraight(22);
      addCurve(40, 4.6, 8);
      addLowRollingHills(12);
      addCurve(48, -5.2, -10);
      addStraight(20);
      addSCurves();
      addCurve(34, 3.8, 4);
      addStraight(26);
      addCurve(38, -3.4, -6);
      addCurve(28, 2.4, 8);
      addStraight(50);
    }
  },

  bayside: {
    name: "Bayside Boulevard",
    description: "Long ocean straights, sweeping cambered curves.",
    palette: {
      skyTop: "#0c1840",
      skyMid: "#1f4a8a",
      skyLow: "#5fc5ff",
      grassA: "#0e2640",
      grassB: "#15314f",
      rumbleA: "#ff4a3a",
      rumbleB: "#fbfdff",
      roadA: "#1a2538",
      roadB: "#121b2a",
      mountainFar: "#0a1b3a",
      mountainMid: "#13284a",
      mountainNear: "#193357",
      cityShadow: "#08142a",
      cityHighlight: "rgba(95, 197, 255, 0.06)"
    },
    build() {
      addStraight(60);
      addCurve(40, 1.8, 2);
      addStraight(50);
      addCurve(36, -2.6, 0);
      addStraight(70);
      addLowRollingHills(16);
      addCurve(52, 3.4, -8);
      addStraight(60);
      addCurve(44, -2.2, 0);
      addStraight(80);
      addCurve(40, 2.0, 4);
      addStraight(55);
      addCurve(36, -3.0, -4);
      addLowRollingHills(14);
      addCurve(50, 2.8, 0);
      addStraight(70);
    }
  },

  akagi: {
    name: "Akagi Loop",
    description: "Tight switchbacks, hard chicanes. No room to breathe.",
    palette: {
      skyTop: "#0d1a2a",
      skyMid: "#2a3818",
      skyLow: "#d68a3a",
      grassA: "#1a2010",
      grassB: "#221c0e",
      rumbleA: "#ffb834",
      rumbleB: "#fff4d0",
      roadA: "#1f2126",
      roadB: "#15161b",
      mountainFar: "#101a14",
      mountainMid: "#1a261a",
      mountainNear: "#243524",
      cityShadow: "#0a1310",
      cityHighlight: "rgba(255, 184, 52, 0.05)"
    },
    build() {
      addStraight(20);
      addCurve(28, -5.2, 4);
      addStraight(12);
      addCurve(24, 5.0, 0);
      addStraight(10);
      addSCurves();
      addCurve(30, -5.8, 12);
      addStraight(14);
      addSCurves();
      addCurve(26, 5.4, -8);
      addStraight(16);
      addCurve(28, -4.5, 0);
      addLowRollingHills(8);
      addCurve(24, 4.8, 4);
      addStraight(14);
      addCurve(30, -5.6, -6);
      addStraight(10);
      addCurve(22, 5.8, 0);
      addStraight(20);
    }
  },

  neon: {
    name: "Neon Highway",
    description: "Cyberpunk overpass. Long blasts, city scenery.",
    palette: {
      skyTop: "#0e0220",
      skyMid: "#360a55",
      skyLow: "#ff2da8",
      grassA: "#150828",
      grassB: "#1c0a35",
      rumbleA: "#ff2da8",
      rumbleB: "#39f0ff",
      roadA: "#1a0d2a",
      roadB: "#100620",
      mountainFar: "#180830",
      mountainMid: "#23103e",
      mountainNear: "#311558",
      cityShadow: "#08051a",
      cityHighlight: "rgba(255, 45, 168, 0.07)"
    },
    build() {
      addStraight(70);
      addCurve(50, 1.4, 0);
      addStraight(80);
      addCurve(40, -1.8, 0);
      addStraight(60);
      addLowRollingHills(12);
      addStraight(80);
      addCurve(45, 2.2, 0);
      addStraight(70);
      addCurve(55, -1.6, 0);
      addStraight(90);
      addCurve(40, 1.8, 0);
      addStraight(80);
    }
  }
};

let selectedTrackId = "akina";

function applyPalette(palette) {
  colors = { ...DEFAULT_PALETTE, ...(palette || {}) };
}

function buildTrack(trackId) {
  const id = TRACKS[trackId] ? trackId : "akina";
  selectedTrackId = id;
  const track = TRACKS[id];
  applyPalette(track.palette);
  segments = [];
  track.build();
  trackLength = segments.length * SEGMENT_LENGTH;
  applyTrackDesign();
  addSprites();
}

function applyTrackDesign() {
  for (const segment of segments) {
    const pct = segment.index / segments.length;
    segment.sector = "city";
    if (pct > 0.15 && pct < 0.26) segment.sector = "tunnel";
    if (pct >= 0.31 && pct < 0.43) segment.sector = "neonS";
    if (pct >= 0.49 && pct < 0.61) segment.sector = "hairpin";
    if (pct >= 0.7 && pct < 0.83) segment.sector = "skyline";
    if (pct >= 0.89) segment.sector = "final";
  }
}

function addSprites() {
  const billboards = ["REDLINE", "TOUGE", "APEX", "JDM", "MIDNIGHT", "DRIFT", "AKINA"];
  for (let i = 12; i < segments.length; i += 11) {
    const side = i % 2 ? -1 : 1;
    segments[i].sprites.push({
      type: i % 33 === 0 ? "gate" : "sign",
      offset: side * (2.45 + ((i % 5) * 0.18)),
      text: billboards[i % billboards.length],
      hue: i % 4
    });
  }

  for (let i = 24; i < segments.length; i += 17) {
    const side = i % 2 ? 1 : -1;
    segments[i].sprites.push({
      type: "lamp",
      offset: side * 2.1,
      hue: i % 3
    });
  }

  // Roadside trees — both sides, alternating density per segment.
  for (let i = 4; i < segments.length; i += 5) {
    const lOffset = -(2.0 + ((i * 7) % 7) * 0.12);
    segments[i].sprites.push({ type: "tree", offset: lOffset, hue: i % 3 });
  }
  for (let i = 7; i < segments.length; i += 5) {
    const rOffset = (2.0 + ((i * 11) % 7) * 0.12);
    segments[i].sprites.push({ type: "tree", offset: rOffset, hue: (i + 1) % 3 });
  }

  // Fence posts hugging the kerb — every other segment, both sides.
  for (let i = 0; i < segments.length; i += 2) {
    segments[i].sprites.push({ type: "fence", offset: -1.55, hue: 0 });
    segments[i].sprites.push({ type: "fence", offset: 1.55, hue: 0 });
  }

  for (let i = 18; i < segments.length; i += 7) {
    const curve = segments[i].curve;
    if (Math.abs(curve) > 1.8) {
      const side = curve > 0 ? 1 : -1;
      segments[i].sprites.push({
        type: "chevron",
        offset: side * 1.65,
        direction: side,
        hue: Math.abs(curve) > 4 ? 0 : 1
      });
    }
  }

  const startIndex = Math.min(segments.length - 1, Math.max(0, Math.floor(segments.length * 0.02)));
  segments[startIndex].sprites.push({ type: "finishArch", offset: 0, text: "" });
}

function findSegment(z) {
  return segments[Math.floor(z / SEGMENT_LENGTH) % segments.length];
}

function project(point, cameraX, cameraY, cameraZ, cameraDepth, w, h, roadWidth) {
  point.camera.x = (point.world.x || 0) - cameraX;
  point.camera.y = point.world.y - cameraY;
  point.camera.z = point.world.z - cameraZ;
  point.screen.scale = cameraDepth / point.camera.z;
  point.screen.x = Math.round((w / 2) + (point.screen.scale * point.camera.x * w / 2));
  point.screen.y = Math.round((h / 2) - (point.screen.scale * point.camera.y * h / 2));
  point.screen.w = Math.round(point.screen.scale * roadWidth * w / 2);
}

function polygon(x1, y1, w1, x2, y2, w2, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1 - w1, y1);
  ctx.lineTo(x2 - w2, y2);
  ctx.lineTo(x2 + w2, y2);
  ctx.lineTo(x1 + w1, y1);
  ctx.closePath();
  ctx.fill();
}

function drawBackground(baseSegment) {
  const gradient = ctx.createLinearGradient(0, 0, 0, roadBottom);
  gradient.addColorStop(0, colors.skyTop);
  gradient.addColorStop(0.32, "#1d1147");
  gradient.addColorStop(0.55, colors.skyMid);
  gradient.addColorStop(0.85, "#cf2f55");
  gradient.addColorStop(1, colors.skyLow);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, roadBottom);

  drawStars();

  const drift = (state.position / trackLength) * width * 1.7;
  drawMoon();
  drawMountains(drift * 0.08, roadHorizon - 36, colors.mountainFar, 0.85);
  drawMountains(drift * 0.16, roadHorizon - 12, colors.mountainMid, 0.92);
  drawMountains(drift * 0.26, roadHorizon + 4, colors.mountainNear, 0.95);
  drawCity(drift * 0.48, roadHorizon + 8);

  const sideGradient = ctx.createLinearGradient(0, roadHorizon, 0, height);
  sideGradient.addColorStop(0, "#16182b");
  sideGradient.addColorStop(1, "#090b13");
  ctx.fillStyle = sideGradient;
  ctx.fillRect(0, roadHorizon, width, height - roadHorizon);

  const pulse = 0.5 + Math.sin(state.nightPulse) * 0.5;
  ctx.fillStyle = `rgba(46, 233, 255, ${0.04 + pulse * 0.04})`;
  ctx.fillRect(0, roadHorizon, width, height - roadHorizon);

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = "#2ee9ff";
  ctx.lineWidth = 1;
  for (let x = -80 + ((drift * 0.7) % 90); x < width + 90; x += 90) {
    ctx.beginPath();
    ctx.moveTo(x, roadHorizon + 18);
    ctx.lineTo(x - 120, height);
    ctx.stroke();
  }
  ctx.restore();

  drawSectorAtmosphere(baseSegment.sector);

  if (baseSegment.curve !== 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.25, Math.abs(baseSegment.curve) * 0.06);
    ctx.fillStyle = baseSegment.curve > 0 ? "#ff315c" : "#2ee9ff";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

function drawSectorAtmosphere(sector) {
  if (sector === "tunnel") {
    ctx.save();
    const tunnel = ctx.createLinearGradient(0, roadHorizon - 30, 0, height);
    tunnel.addColorStop(0, "rgba(2, 6, 12, 0.62)");
    tunnel.addColorStop(0.45, "rgba(3, 8, 14, 0.25)");
    tunnel.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = tunnel;
    ctx.fillRect(0, roadHorizon - 34, width, height - roadHorizon + 34);
    ctx.strokeStyle = "rgba(46, 233, 255, 0.38)";
    ctx.lineWidth = 3;
    for (let x = -120 + ((state.position * 0.05) % 160); x < width + 160; x += 160) {
      ctx.beginPath();
      ctx.moveTo(x, roadHorizon - 12);
      ctx.lineTo(x + 90, roadHorizon - 12);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (sector === "hairpin") {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#ff315c";
    ctx.fillRect(0, roadHorizon, width, height - roadHorizon);
    ctx.restore();
  }

  if (sector === "skyline") {
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = "#2ee9ff";
    ctx.fillRect(0, roadHorizon, width, height - roadHorizon);
    ctx.restore();
  }
}

function drawStars() {
  ctx.save();
  for (let i = 0; i < STAR_FIELD.length; i++) {
    const s = STAR_FIELD[i];
    const screenY = s.y * roadHorizon;
    if (screenY > roadHorizon) continue;
    const tw = 0.5 + 0.5 * Math.sin(state.nightPulse * s.twinkleRate + s.twinkle);
    ctx.globalAlpha = s.bright * (0.45 + 0.55 * tw);
    ctx.fillStyle = s.hue;
    ctx.beginPath();
    ctx.arc(s.x * width, screenY, s.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawMoon() {
  const x = width * 0.80;
  const y = height * 0.16;
  const r = Math.max(30, width * 0.05);

  // Outer glow halo
  let grad = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 3.2);
  grad.addColorStop(0, "rgba(255, 232, 196, 0.55)");
  grad.addColorStop(0.35, "rgba(255, 192, 220, 0.18)");
  grad.addColorStop(1, "rgba(255, 145, 180, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r * 3.2, 0, Math.PI * 2);
  ctx.fill();

  // Moon disc with subtle shading
  grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r * 1.05);
  grad.addColorStop(0, "#fff5d8");
  grad.addColorStop(0.65, "#ffe7b4");
  grad.addColorStop(1, "#d4a98a");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // Craters — multiple of varied size
  ctx.fillStyle = "rgba(82, 42, 70, 0.34)";
  ctx.beginPath();
  ctx.arc(x - r * 0.28, y - r * 0.18, r * 0.13, 0, Math.PI * 2);
  ctx.arc(x + r * 0.18, y + r * 0.22, r * 0.10, 0, Math.PI * 2);
  ctx.arc(x + r * 0.32, y - r * 0.10, r * 0.06, 0, Math.PI * 2);
  ctx.arc(x - r * 0.05, y + r * 0.32, r * 0.05, 0, Math.PI * 2);
  ctx.arc(x - r * 0.42, y + r * 0.05, r * 0.04, 0, Math.PI * 2);
  ctx.fill();

  // Soft top highlight
  ctx.save();
  ctx.globalAlpha = 0.35;
  grad = ctx.createRadialGradient(x - r * 0.36, y - r * 0.36, 0, x - r * 0.36, y - r * 0.36, r * 0.6);
  grad.addColorStop(0, "rgba(255, 255, 255, 0.7)");
  grad.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x - r * 0.2, y - r * 0.18, r * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMountains(offset, baseY, fill, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(0, baseY + 80);
  const step = width / 9;
  for (let i = -2; i <= 12; i++) {
    const x = i * step - (offset % step);
    const peak = baseY - 52 - ((i * 37) % 46);
    ctx.lineTo(x + step * 0.42, peak);
    ctx.lineTo(x + step, baseY + 76);
  }
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCity(offset, baseY) {
  ctx.save();
  const block = 38;
  const startIndex = Math.floor(offset / block) - 1;
  const phase = offset - startIndex * block;
  for (let i = 0; i < Math.ceil(width / block) + 3; i++) {
    const buildingIndex = startIndex + i;
    const x = i * block - phase;
    // Two pseudo-random values per building (deterministic, stable as the offset shifts).
    const n1 = (Math.sin(buildingIndex * 12.9898) * 43758.5453) % 1;
    const n2 = (Math.sin(buildingIndex * 78.233) * 12345.6789) % 1;
    const r1 = Math.abs(n1);
    const r2 = Math.abs(n2);
    const hMain = 44 + r1 * 88;
    const widthMain = block - 4;
    const isTower = r2 > 0.78;
    const finalH = isTower ? hMain * 1.55 : hMain;

    // Building silhouette
    ctx.fillStyle = colors.cityShadow;
    ctx.fillRect(x + 1, baseY - finalH, widthMain - 2, finalH);

    // Roof feature (antenna for tall towers)
    if (isTower) {
      ctx.fillStyle = "#0d1330";
      ctx.fillRect(x + widthMain * 0.45, baseY - finalH - 14, 2, 14);
      ctx.fillStyle = "#ff315c";
      ctx.fillRect(x + widthMain * 0.45 - 1, baseY - finalH - 16, 4, 2);
    } else if (r2 > 0.55) {
      ctx.fillStyle = "#0d1330";
      ctx.fillRect(x + widthMain * 0.2, baseY - finalH - 4, widthMain * 0.6, 4);
    }

    // Window grid — sparser, mostly static so the city doesn't shimmer.
    const windowCols = 3;
    const windowRows = Math.max(2, Math.floor(finalH / 22));
    const cellW = widthMain / windowCols;
    const cellH = finalH / (windowRows + 1);
    for (let cy = 0; cy < windowRows; cy++) {
      for (let cx = 0; cx < windowCols; cx++) {
        const wid = buildingIndex * 17 + cy * 11 + cx * 7;
        const wn = Math.abs(Math.sin(wid * 12.9898) * 43758.5453) % 1;
        if (wn < 0.62) continue;
        const colorRoll = (wid * 31) % 100;
        let color;
        if (colorRoll < 70) color = "rgba(46, 233, 255, 0.55)";
        else if (colorRoll < 92) color = "rgba(255, 209, 102, 0.5)";
        else color = "rgba(255, 49, 92, 0.5)";
        ctx.fillStyle = color;
        ctx.fillRect(
          x + 2 + cx * cellW + cellW * 0.22,
          baseY - finalH + cellH * 0.5 + cy * cellH,
          cellW * 0.44,
          cellH * 0.26
        );
      }
    }

    // Subtle vertical edge highlight
    ctx.fillStyle = colors.cityHighlight;
    ctx.fillRect(x + 1, baseY - finalH, 1, finalH);
  }
  ctx.restore();
}

function drawSegment(segment) {
  const p1 = segment.p1.screen;
  const p2 = segment.p2.screen;
  const isA = segment.color === "A";
  let grass = isA ? colors.grassA : colors.grassB;
  let rumble = isA ? colors.rumbleA : colors.rumbleB;
  let road = isA ? colors.roadA : colors.roadB;
  if (segment.sector === "tunnel") {
    grass = isA ? "#071018" : "#0a111d";
    road = isA ? "#141825" : "#0f131d";
    rumble = isA ? "#2ee9ff" : "#f7fbff";
  } else if (segment.sector === "hairpin") {
    grass = isA ? "#1c1226" : "#25162d";
    road = isA ? "#24202f" : "#191927";
    rumble = isA ? "#ffd166" : "#ff315c";
  } else if (segment.sector === "skyline") {
    grass = isA ? "#0e2230" : "#11182b";
    road = isA ? "#1b2738" : "#111c2b";
    rumble = isA ? "#2ee9ff" : "#f8fbff";
  } else if (segment.sector === "final") {
    grass = isA ? "#1f1431" : "#11192c";
    road = isA ? "#262232" : "#171b2a";
    rumble = isA ? "#ff315c" : "#ffd166";
  }
  const laneWidth1 = p1.w / LANES;
  const laneWidth2 = p2.w / LANES;
  const rumbleW1 = p1.w / 4.8;
  const rumbleW2 = p2.w / 4.8;
  const segmentHeight = p1.y - p2.y;
  const nearEnough = p1.w > 90 && p1.y > roadHorizon + 18 && segmentHeight > 1.4;

  ctx.fillStyle = grass;
  ctx.fillRect(0, p2.y, width, p1.y - p2.y);
  if (nearEnough) {
    polygon(p1.x, p1.y, p1.w + rumbleW1, p2.x, p2.y, p2.w + rumbleW2, rumble);
  }
  polygon(p1.x, p1.y, p1.w, p2.x, p2.y, p2.w, road);

  if (nearEnough) {
    ctx.save();
    ctx.globalAlpha = isA ? 0.32 : 0.18;
    ctx.strokeStyle = isA ? "rgba(255, 49, 92, 0.58)" : "rgba(46, 233, 255, 0.42)";
    ctx.lineWidth = Math.max(1, p2.w / 92);
    ctx.beginPath();
    ctx.moveTo(p1.x - p1.w, p1.y);
    ctx.lineTo(p2.x - p2.w, p2.y);
    ctx.moveTo(p1.x + p1.w, p1.y);
    ctx.lineTo(p2.x + p2.w, p2.y);
    ctx.stroke();
    ctx.restore();
  }

  if (nearEnough && p2.w > 42) {
    if (isA) {
      // Solid white lane lines, thicker on wider tracks so 5-lane spacing reads at distance.
      ctx.strokeStyle = colors.lane;
      ctx.lineWidth = Math.max(1.8, p2.w / 48);
      for (let lane = 1; lane < LANES; lane++) {
        // Skip drawing the center division (it gets a dashed yellow line instead).
        if (LANES % 2 === 1 && lane === Math.floor(LANES / 2) + (LANES % 2 === 0 ? 0 : 0)) continue;
        const x1 = p1.x - p1.w + laneWidth1 * lane;
        const x2 = p2.x - p2.w + laneWidth2 * lane;
        ctx.beginPath();
        ctx.moveTo(x1, p1.y);
        ctx.lineTo(x2, p2.y);
        ctx.stroke();
      }
    }

    // Dashed yellow center line — even-lane tracks straddle two lines, odd-lane (5) sits dead center.
    if (segment.index % 4 === 0) {
      ctx.strokeStyle = colors.laneDash;
      ctx.lineWidth = Math.max(1.8, p2.w / 50);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  }

  // Skid marks / drift trails — line-stroke, perspective-aware.
  if (segment.skidMarks && segment.skidMarks.length && nearEnough && p2.w > 60) {
    ctx.save();
    ctx.lineCap = "round";
    for (const m of segment.skidMarks) {
      const sx1 = p1.x + p1.w * m.offset;
      const sx2 = p2.x + p2.w * m.offset;
      const lw = Math.max(1.2, (p1.w + p2.w) * 0.5 * m.width * 0.9);
      if (m.kind === "drift") {
        // Soft white drift trail.
        ctx.strokeStyle = `rgba(235, 240, 255, ${m.alpha})`;
      } else {
        ctx.strokeStyle = `rgba(10, 8, 14, ${m.alpha * 0.85})`;
      }
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(sx1, p1.y);
      ctx.lineTo(sx2, p2.y);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawSprite(sprite, segment) {
  const scale = segment.p1.screen.scale;
  const x = segment.p1.screen.x + (scale * sprite.offset * ROAD_WIDTH * width / 2);
  const y = segment.p1.screen.y;
  const size = Math.max(0.2, scale * width * 1.3);
  if (sprite.type === "sign") drawSign(x, y, size, sprite);
  if (sprite.type === "lamp") drawLamp(x, y, size, sprite);
  if (sprite.type === "gate") drawGate(x, y, size, sprite);
  if (sprite.type === "chevron") drawChevron(x, y, size, sprite);
  if (sprite.type === "finishArch") drawFinishArch(segment, sprite);
  if (sprite.type === "tree") drawTree(x, y, size, sprite);
  if (sprite.type === "fence") drawFence(x, y, size, sprite);
}

function drawTree(x, y, size, sprite) {
  if (size < 6 || y < roadHorizon - 60 || y > height + 80) return;
  const w = size * 0.20;
  const h = size * 0.42;
  const trunkW = w * 0.20;
  const trunkH = h * 0.32;
  ctx.save();
  ctx.translate(x, y);
  // Trunk
  ctx.fillStyle = "#0a0d18";
  ctx.fillRect(-trunkW * 0.5, -trunkH, trunkW, trunkH);
  // Foliage — three rounded shapes stacked, color varies with hue.
  const foliage = sprite.hue === 0 ? "#0e2a18" : sprite.hue === 1 ? "#1a2410" : "#15202a";
  ctx.fillStyle = foliage;
  ctx.beginPath();
  ctx.ellipse(0, -trunkH - h * 0.18, w * 0.55, h * 0.32, 0, 0, Math.PI * 2);
  ctx.ellipse(-w * 0.18, -trunkH - h * 0.40, w * 0.40, h * 0.26, 0, 0, Math.PI * 2);
  ctx.ellipse(w * 0.18, -trunkH - h * 0.40, w * 0.40, h * 0.26, 0, 0, Math.PI * 2);
  ctx.ellipse(0, -trunkH - h * 0.62, w * 0.32, h * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  // Soft top rim catching the moon.
  ctx.fillStyle = "rgba(255, 240, 210, 0.10)";
  ctx.beginPath();
  ctx.ellipse(-w * 0.15, -trunkH - h * 0.48, w * 0.30, h * 0.10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFence(x, y, size, sprite) {
  if (size < 4 || y < roadHorizon - 30 || y > height + 60) return;
  const postW = Math.max(1, size * 0.025);
  const postH = size * 0.10;
  ctx.save();
  ctx.fillStyle = "#0c1322";
  ctx.fillRect(x - postW / 2, y - postH, postW, postH);
  // Top reflective cap on bigger posts.
  if (size > 22) {
    ctx.fillStyle = sprite.offset < 0 ? "rgba(255, 209, 102, 0.7)" : "rgba(46, 233, 255, 0.7)";
    ctx.fillRect(x - postW / 2, y - postH, postW, Math.max(1, postH * 0.18));
  }
  ctx.restore();
}

function drawSign(x, y, size, sprite) {
  const w = size * 0.6;
  const h = size * 0.26;
  if (w < 3 || y < roadHorizon - 40 || y > height + 40) return;
  const palette = [
    ["#ff315c", "#2ee9ff"],
    ["#2ee9ff", "#ffd166"],
    ["#a66cff", "#ff315c"],
    ["#ffd166", "#101525"]
  ][sprite.hue % 4];

  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.fillRect(-w * 0.5 + size * 0.06, -h * 1.22 + size * 0.04, w, h);
  ctx.fillStyle = palette[0];
  ctx.shadowColor = palette[0];
  ctx.shadowBlur = size * 0.06;
  ctx.fillRect(-w * 0.5, -h * 1.25, w, h);
  ctx.strokeStyle = palette[1];
  ctx.lineWidth = Math.max(1, size * 0.018);
  ctx.strokeRect(-w * 0.5, -h * 1.25, w, h);
  if (size > 18) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff";
    ctx.font = `900 ${Math.max(8, size * 0.08)}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(sprite.text, 0, -h * 0.78, w * 0.9);
  }
  ctx.fillStyle = "#0a0d16";
  ctx.fillRect(-size * 0.025, -h * 0.98, size * 0.05, h * 1.45);
  ctx.restore();
}

function drawLamp(x, y, size, sprite) {
  if (size < 5 || y < roadHorizon - 30 || y > height + 40) return;
  const glow = sprite.hue % 2 ? "#ff315c" : "#2ee9ff";
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#0b101c";
  ctx.lineWidth = Math.max(1, size * 0.035);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -size * 0.55);
  ctx.lineTo(-Math.sign(x - width / 2) * size * 0.18, -size * 0.65);
  ctx.stroke();
  ctx.fillStyle = glow;
  ctx.shadowColor = glow;
  ctx.shadowBlur = size * 0.12;
  ctx.beginPath();
  ctx.arc(-Math.sign(x - width / 2) * size * 0.2, -size * 0.65, Math.max(2, size * 0.035), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawChevron(x, y, size, sprite) {
  if (size < 6 || y < roadHorizon - 30 || y > height + 50) return;
  const w = size * 0.24;
  const h = size * 0.22;
  const glow = sprite.hue ? "#2ee9ff" : "#ff315c";
  ctx.save();
  ctx.translate(x, y - h * 1.2);
  ctx.scale(sprite.direction, 1);
  ctx.shadowColor = glow;
  ctx.shadowBlur = size * 0.08;
  ctx.fillStyle = "rgba(5, 8, 15, 0.86)";
  roundedRect(-w * 0.55, -h * 0.55, w * 1.1, h * 1.1, Math.max(2, size * 0.03));
  ctx.fill();
  ctx.strokeStyle = glow;
  ctx.lineWidth = Math.max(2, size * 0.025);
  ctx.beginPath();
  ctx.moveTo(-w * 0.25, -h * 0.32);
  ctx.lineTo(w * 0.2, 0);
  ctx.lineTo(-w * 0.25, h * 0.32);
  ctx.stroke();
  ctx.restore();
}

function drawGate(x, y, size, sprite) {
  if (size < 5 || y < roadHorizon - 40 || y > height + 80) return;
  ctx.save();
  ctx.translate(x, y);
  const side = Math.sign(sprite.offset) || 1;
  ctx.strokeStyle = "#f23161";
  ctx.lineWidth = Math.max(2, size * 0.045);
  ctx.shadowColor = "#ff315c";
  ctx.shadowBlur = size * 0.07;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -size * 0.62);
  ctx.lineTo(-side * size * 0.34, -size * 0.62);
  ctx.stroke();
  ctx.restore();
}

function drawFinishArch(segment, sprite) {
  const p = segment.p1.screen;
  const w = p.w * 2.35;
  const top = p.y - p.w * 0.48;
  if (p.w < 14 || p.y < roadHorizon || p.y > height) return;
  ctx.save();
  ctx.strokeStyle = "#f7fbff";
  ctx.lineWidth = Math.max(2, p.w * 0.035);
  ctx.shadowColor = "#2ee9ff";
  ctx.shadowBlur = p.w * 0.1;
  ctx.beginPath();
  ctx.moveTo(p.x - w / 2, p.y);
  ctx.lineTo(p.x - w / 2, top);
  ctx.lineTo(p.x + w / 2, top);
  ctx.lineTo(p.x + w / 2, p.y);
  ctx.stroke();
  ctx.restore();
}

function drawRoad() {
  const baseSegment = findSegment(state.position);
  const basePercent = percentRemaining(state.position, SEGMENT_LENGTH);
  const playerSegment = findSegment(state.position + playerZ);
  const playerPercent = percentRemaining(state.position + playerZ, SEGMENT_LENGTH);
  const playerY = interpolate(playerSegment.p1.world.y, playerSegment.p2.world.y, playerPercent);

  let x = 0;
  let dx = -(baseSegment.curve * basePercent);
  let maxY = height;
  const visibleSegments = [];

  drawBackground(baseSegment);

  for (let n = 0; n < DRAW_DISTANCE; n++) {
    const segment = segments[(baseSegment.index + n) % segments.length];
    segment.looped = segment.index < baseSegment.index;
    segment.clip = maxY;

    project(segment.p1, (state.playerX * ROAD_WIDTH) - x, playerY + CAMERA_HEIGHT, state.position - (segment.looped ? trackLength : 0), CAMERA_DEPTH, width, height, ROAD_WIDTH);
    project(segment.p2, (state.playerX * ROAD_WIDTH) - x - dx, playerY + CAMERA_HEIGHT, state.position - (segment.looped ? trackLength : 0), CAMERA_DEPTH, width, height, ROAD_WIDTH);

    x += dx;
    dx += segment.curve;

    if (segment.p1.camera.z <= CAMERA_DEPTH || segment.p2.screen.y >= segment.p1.screen.y || segment.p2.screen.y >= maxY) continue;

    drawSegment(segment);
    maxY = segment.p2.screen.y;
    visibleSegments.push(segment);
  }

  for (let i = visibleSegments.length - 1; i >= 0; i--) {
    const segment = visibleSegments[i];
    for (const sprite of segment.sprites) drawSprite(sprite, segment);
    for (const car of segment.cars) drawRivalCar(car, segment);
  }

  drawParticles();
  drawPlayerCar(baseSegment);
}

function drawRivalCar(car, segment) {
  const segmentPercent = percentRemaining(car.z, SEGMENT_LENGTH);
  const p1 = segment.p1.screen;
  const p2 = segment.p2.screen;
  const roadX = interpolate(p1.x, p2.x, segmentPercent);
  const roadW = interpolate(p1.w, p2.w, segmentPercent);
  const y = interpolate(p1.y, p2.y, segmentPercent);
  const x = roadX + roadW * car.offset;
  const maxRivalSize = Math.min(width, height) * 0.27;
  const size = Math.max(14, Math.min(roadW * 0.22, maxRivalSize));
  drawCarSprite(x, y, size, car.body, car.stripe, false, car.shape);
  drawRivalLabel(car, x, y, size);
}

function drawRivalLabel(car, x, y, size) {
  if (size < 24 || y < roadHorizon || y > height * 0.86) return;
  const w = Math.max(44, size * 0.54);
  ctx.save();
  ctx.translate(x, y - size * 0.36);
  ctx.fillStyle = "rgba(5, 8, 15, 0.72)";
  roundedRect(-w / 2, -10, w, 18, 4);
  ctx.fill();
  ctx.fillStyle = car.body;
  ctx.font = `900 ${Math.max(9, size * 0.08)}px Inter, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(car.name.toUpperCase(), 0, 0, w - 8);
  ctx.restore();
}

function drawCarSprite(x, y, size, body, stripe, player, shape) {
  if (size < 4 || y < roadHorizon - 30 || y > height + 60) return;
  shape = shape || "gt";
  const proportions = CAR_SHAPES[shape] || CAR_SHAPES.gt;
  const w = Math.max(10, size) * proportions.widthMul;
  const h = Math.max(10, size) * 0.52 * proportions.heightMul;

  ctx.save();
  ctx.translate(x, y);
  if (player) ctx.rotate(state.yaw * 0.85 + state.slip * 0.14);

  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.beginPath();
  ctx.ellipse(0, h * 0.20, w * 0.5, h * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  proportions.draw(w, h, body, stripe);

  if (player && w > 90) {
    ctx.fillStyle = "#101525";
    ctx.font = `900 ${Math.max(10, w * 0.09)}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("86", 0, h * 0.04, w * 0.20);
  }

  ctx.restore();
}

function drawCarBase(w, h, body, stripe, opts) {
  const {
    bodyShape,           // function(ctx, w, h)
    cabinShape,          // function(ctx, w, h)
    fenderFlare = 0,     // 0..1: how much wider the rear fenders are
    spoiler,             // null | "lip" | "wing" | "ducktail"
    hood,                // null | "scoop" | "vent"
    taillight,           // "strip" | "round-dual" | "round-quad" | "rect-dual" | "stack"
    headlightStyle = "trapezoid", // "trapezoid" | "slim" | "round"
    stripeShape = "single",       // "single" | "twin" | "side" | "none"
    underglow = false,
    wheelGap = 0.05
  } = opts;

  // Lower body / chassis (always darkest).
  ctx.fillStyle = "#06080f";
  roundedRect(-w * (0.5 + fenderFlare * 0.04), h * 0.04, w * (1 + fenderFlare * 0.08), h * 0.30, h * 0.05);
  ctx.fill();

  // Wheels behind body so they tuck under fenders.
  drawWheels(w, h, fenderFlare > 0.4, wheelGap);

  // Body shell.
  ctx.fillStyle = body;
  bodyShape(ctx, w, h);

  // Body-color edge highlight on top.
  ctx.fillStyle = lightenHex(body, 0.18);
  bodyShape(ctx, w, h, true);

  // Stripe.
  if (stripeShape === "single") {
    ctx.fillStyle = stripe;
    ctx.fillRect(-w * 0.05, -h * 0.36, w * 0.10, h * 0.7);
  } else if (stripeShape === "twin") {
    ctx.fillStyle = stripe;
    ctx.fillRect(-w * 0.16, -h * 0.36, w * 0.07, h * 0.7);
    ctx.fillRect(w * 0.09, -h * 0.36, w * 0.07, h * 0.7);
  } else if (stripeShape === "side") {
    ctx.fillStyle = stripe;
    ctx.fillRect(-w * 0.46, -h * 0.04, w * 0.06, h * 0.20);
    ctx.fillRect(w * 0.40, -h * 0.04, w * 0.06, h * 0.20);
  }

  // Cabin / greenhouse.
  ctx.fillStyle = "rgba(8, 14, 24, 0.94)";
  cabinShape(ctx, w, h);
  // Sky-reflection gloss along the top of the glass.
  if (w > 24) {
    ctx.save();
    cabinShape(ctx, w, h);
    ctx.clip();
    const glass = ctx.createLinearGradient(0, -h * 0.32, 0, -h * 0.05);
    glass.addColorStop(0, "rgba(160, 220, 255, 0.55)");
    glass.addColorStop(0.5, "rgba(46, 233, 255, 0.18)");
    glass.addColorStop(1, "rgba(8, 14, 24, 0)");
    ctx.fillStyle = glass;
    ctx.fillRect(-w * 0.5, -h * 0.5, w, h * 0.6);
    ctx.restore();
  }
  ctx.fillStyle = "rgba(46, 233, 255, 0.42)";
  cabinShape(ctx, w, h, true);

  // Side mirrors.
  if (w > 36) {
    ctx.fillStyle = body;
    roundedRect(-w * 0.48, -h * 0.10, w * 0.06, h * 0.06, h * 0.02);
    roundedRect(w * 0.42, -h * 0.10, w * 0.06, h * 0.06, h * 0.02);
    ctx.fill();
    // Mirror glass dot
    ctx.fillStyle = "rgba(46, 233, 255, 0.6)";
    ctx.fillRect(-w * 0.475, -h * 0.092, w * 0.04, h * 0.025);
    ctx.fillRect(w * 0.425, -h * 0.092, w * 0.04, h * 0.025);
  }

  // Body specular highlight running across the top of the body.
  if (w > 28) {
    ctx.save();
    ctx.globalAlpha = 0.22;
    const spec = ctx.createLinearGradient(0, -h * 0.1, 0, h * 0.05);
    spec.addColorStop(0, "rgba(255, 255, 255, 0.7)");
    spec.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = spec;
    ctx.fillRect(-w * 0.42, -h * 0.10, w * 0.84, h * 0.08);
    ctx.restore();
  }

  // Optional front splitter (wide carbon strip under the front bumper).
  if (opts.splitter && w > 22) {
    ctx.fillStyle = "#0c1020";
    ctx.fillRect(-w * 0.48, -h * 0.36, w * 0.96, h * 0.04);
    ctx.fillStyle = "rgba(46, 233, 255, 0.18)";
    ctx.fillRect(-w * 0.46, -h * 0.34, w * 0.92, h * 0.012);
  }

  // Optional roof antenna / shark fin (kei + drift cars).
  if (opts.roofFin && w > 22) {
    ctx.fillStyle = "#0d1326";
    ctx.beginPath();
    ctx.moveTo(w * 0.10, -h * 0.34);
    ctx.lineTo(w * 0.16, -h * 0.42);
    ctx.lineTo(w * 0.22, -h * 0.34);
    ctx.closePath();
    ctx.fill();
  }

  // Front grille mesh — visible across the nose for cars with grille feature.
  if (opts.grille && w > 60) {
    ctx.fillStyle = "#04060c";
    roundedRect(-w * 0.20, -h * 0.13, w * 0.40, h * 0.06, h * 0.012);
    ctx.fill();
    ctx.strokeStyle = "rgba(120, 130, 150, 0.38)";
    ctx.lineWidth = 0.8;
    for (let g = 1; g < 5; g++) {
      const gy = -h * 0.13 + (h * 0.06 * g) / 5;
      ctx.beginPath();
      ctx.moveTo(-w * 0.18, gy);
      ctx.lineTo(w * 0.18, gy);
      ctx.stroke();
    }
  }

  // Hood character lines — twin creases running back from the bumper to the windshield.
  if (opts.hoodLines && w > 70) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.10)";
    ctx.lineWidth = Math.max(0.8, w * 0.010);
    ctx.beginPath();
    ctx.moveTo(-w * 0.16, -h * 0.04);
    ctx.lineTo(-w * 0.20, -h * 0.20);
    ctx.moveTo(w * 0.16, -h * 0.04);
    ctx.lineTo(w * 0.20, -h * 0.20);
    ctx.stroke();
  }

  // Side body strake — long crease line along the door panel.
  if (opts.sideStrake && w > 70) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = Math.max(0.7, w * 0.008);
    ctx.beginPath();
    ctx.moveTo(-w * 0.40, h * 0.04);
    ctx.lineTo(-w * 0.30, h * 0.08);
    ctx.moveTo(w * 0.40, h * 0.04);
    ctx.lineTo(w * 0.30, h * 0.08);
    ctx.stroke();
  }

  // Rear diffuser fins — black vertical strakes under the bumper.
  if (opts.diffuser && w > 60) {
    ctx.fillStyle = "#04060c";
    roundedRect(-w * 0.34, h * 0.18, w * 0.68, h * 0.05, h * 0.012);
    ctx.fill();
    ctx.fillStyle = "#0d1326";
    for (let f = 0; f < 5; f++) {
      const fx = -w * 0.30 + f * w * 0.15;
      ctx.fillRect(fx, h * 0.185, w * 0.012, h * 0.045);
    }
  }

  // Hood scoop power bulge / vent grouping — adds beef on muscly hoods.
  if (opts.hoodBulge && w > 28) {
    ctx.fillStyle = lightenHex(body, 0.22);
    ctx.beginPath();
    ctx.moveTo(-w * 0.16, -h * 0.16);
    ctx.lineTo(-w * 0.05, -h * 0.22);
    ctx.lineTo(w * 0.05, -h * 0.22);
    ctx.lineTo(w * 0.16, -h * 0.16);
    ctx.lineTo(w * 0.16, -h * 0.06);
    ctx.lineTo(-w * 0.16, -h * 0.06);
    ctx.closePath();
    ctx.fill();
  }

  // Hood detail.
  if (hood === "scoop" && w > 32) {
    ctx.fillStyle = "#04060c";
    roundedRect(-w * 0.10, -h * 0.16, w * 0.20, h * 0.10, h * 0.02);
    ctx.fill();
    ctx.fillStyle = "#1a2032";
    roundedRect(-w * 0.08, -h * 0.14, w * 0.16, h * 0.04, h * 0.012);
    ctx.fill();
  } else if (hood === "vent" && w > 32) {
    ctx.fillStyle = "#04060c";
    roundedRect(-w * 0.18, -h * 0.14, w * 0.36, h * 0.04, h * 0.012);
    ctx.fill();
  }

  // Spoiler — bigger and more visible per archetype.
  if (spoiler === "wing" && w > 22) {
    // Twin upright risers + wide horizontal blade
    ctx.fillStyle = "#04060c";
    ctx.fillRect(-w * 0.32, -h * 0.04, w * 0.04, h * 0.16);
    ctx.fillRect(w * 0.28, -h * 0.04, w * 0.04, h * 0.16);
    // Wing blade (wider than body, tall)
    ctx.fillStyle = "#04060c";
    ctx.fillRect(-w * 0.50, -h * 0.08, w * 1.00, h * 0.05);
    ctx.fillStyle = lightenHex(body, 0.18);
    ctx.fillRect(-w * 0.48, -h * 0.10, w * 0.96, h * 0.04);
    // End plates
    ctx.fillStyle = "#04060c";
    ctx.fillRect(-w * 0.50, -h * 0.12, w * 0.03, h * 0.10);
    ctx.fillRect(w * 0.47, -h * 0.12, w * 0.03, h * 0.10);
  } else if (spoiler === "ducktail" && w > 22) {
    // Integrated ducktail rising at rear edges
    ctx.fillStyle = lightenHex(body, 0.14);
    ctx.beginPath();
    ctx.moveTo(-w * 0.42, h * 0.12);
    ctx.lineTo(-w * 0.40, h * 0.02);
    ctx.lineTo(-w * 0.30, -h * 0.02);
    ctx.lineTo(w * 0.30, -h * 0.02);
    ctx.lineTo(w * 0.40, h * 0.02);
    ctx.lineTo(w * 0.42, h * 0.12);
    ctx.closePath();
    ctx.fill();
  } else if (spoiler === "lip" && w > 18) {
    // Subtle chin lip
    ctx.fillStyle = "#04060c";
    ctx.fillRect(-w * 0.42, h * 0.13, w * 0.84, h * 0.028);
  }

  // Twin exhaust pipes at the lower rear corners — only on close sprites.
  if (w > 50) {
    ctx.fillStyle = "#1c2030";
    roundedRect(-w * 0.22, h * 0.18, w * 0.07, h * 0.06, h * 0.02);
    roundedRect(w * 0.15, h * 0.18, w * 0.07, h * 0.06, h * 0.02);
    ctx.fill();
    ctx.fillStyle = "rgba(120, 130, 150, 0.6)";
    ctx.fillRect(-w * 0.205, h * 0.195, w * 0.04, h * 0.018);
    ctx.fillRect(w * 0.165, h * 0.195, w * 0.04, h * 0.018);
  }

  // Taillights.
  drawTaillight(w, h, taillight);

  // Headlights (peeking from front).
  if (w > 24) drawHeadlights(w, h, headlightStyle);

  // Underglow.
  if (underglow && w > 30) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#2ee9ff";
    ctx.filter = "blur(6px)";
    ctx.fillRect(-w * 0.42, h * 0.20, w * 0.84, h * 0.06);
    ctx.restore();
  }
}

function drawTaillight(w, h, kind) {
  // Helper that paints a glowing red lens with a hot-spot core.
  const lensRect = (x, y, lw, lh, r = 0) => {
    ctx.save();
    ctx.shadowColor = "#ff315c";
    ctx.shadowBlur = Math.max(2, w * 0.05);
    ctx.fillStyle = "#ff315c";
    if (r > 0) { roundedRect(x, y, lw, lh, r); ctx.fill(); }
    else ctx.fillRect(x, y, lw, lh);
    ctx.restore();
    // Hot core highlight
    ctx.fillStyle = "rgba(255, 220, 230, 0.7)";
    ctx.fillRect(x + lw * 0.15, y + lh * 0.18, lw * 0.7, lh * 0.28);
  };
  const lensCircle = (cx, cy, r) => {
    ctx.save();
    ctx.shadowColor = "#ff315c";
    ctx.shadowBlur = Math.max(3, r * 1.6);
    ctx.fillStyle = "#ff315c";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "rgba(255, 220, 230, 0.85)";
    ctx.beginPath();
    ctx.arc(cx - r * 0.18, cy - r * 0.18, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
  };

  if (kind === "strip") {
    lensRect(-w * 0.40, h * 0.10, w * 0.80, h * 0.045, h * 0.012);
  } else if (kind === "round-dual") {
    lensCircle(-w * 0.30, h * 0.135, h * 0.048);
    lensCircle(w * 0.30, h * 0.135, h * 0.048);
  } else if (kind === "round-quad") {
    const r = h * 0.040;
    lensCircle(-w * 0.34, h * 0.13, r);
    lensCircle(-w * 0.22, h * 0.13, r);
    lensCircle(w * 0.22, h * 0.13, r);
    lensCircle(w * 0.34, h * 0.13, r);
  } else if (kind === "stack") {
    lensRect(-w * 0.34, h * 0.08, w * 0.10, h * 0.04);
    lensRect(w * 0.24, h * 0.08, w * 0.10, h * 0.04);
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(-w * 0.34, h * 0.13, w * 0.10, h * 0.025);
    ctx.fillRect(w * 0.24, h * 0.13, w * 0.10, h * 0.025);
  } else {
    lensRect(-w * 0.30, h * 0.11, w * 0.14, h * 0.05);
    lensRect(w * 0.16, h * 0.11, w * 0.14, h * 0.05);
  }
}

function drawHeadlights(w, h, style) {
  ctx.fillStyle = "#fff7d6";
  if (style === "round") {
    ctx.beginPath();
    ctx.arc(-w * 0.28, -h * 0.22, h * 0.05, 0, Math.PI * 2);
    ctx.arc(w * 0.28, -h * 0.22, h * 0.05, 0, Math.PI * 2);
    ctx.fill();
  } else if (style === "slim") {
    ctx.fillRect(-w * 0.34, -h * 0.20, w * 0.16, h * 0.03);
    ctx.fillRect(w * 0.18, -h * 0.20, w * 0.16, h * 0.03);
  } else {
    // trapezoid
    ctx.beginPath();
    ctx.moveTo(-w * 0.34, -h * 0.20);
    ctx.lineTo(-w * 0.18, -h * 0.16);
    ctx.lineTo(-w * 0.20, -h * 0.08);
    ctx.lineTo(-w * 0.32, -h * 0.10);
    ctx.closePath();
    ctx.moveTo(w * 0.34, -h * 0.20);
    ctx.lineTo(w * 0.18, -h * 0.16);
    ctx.lineTo(w * 0.20, -h * 0.08);
    ctx.lineTo(w * 0.32, -h * 0.10);
    ctx.closePath();
    ctx.fill();
  }
}

function drawWheels(w, h, fat, gap = 0.05) {
  const wheelW = fat ? w * 0.19 : w * 0.15;
  const wheelH = h * (fat ? 0.32 : 0.28);
  const wheels = [
    { cx: -w * 0.5 - wheelW * gap + wheelW * 0.5, cy: -h * 0.06 + wheelH * 0.5 },
    { cx:  w * 0.5 + wheelW * gap - wheelW * 0.5, cy: -h * 0.06 + wheelH * 0.5 }
  ];
  // Hot tire glow when slipping (player only — set via state.tireSlip).
  const heat = state.tireSlip || 0;
  for (const wh of wheels) {
    // Heat halo first so it sits behind the tire body.
    if (heat > 0.15) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const haloGrad = ctx.createRadialGradient(wh.cx, wh.cy, 0, wh.cx, wh.cy, wheelW * 1.4);
      haloGrad.addColorStop(0, `rgba(255, 110, 60, ${0.7 * heat})`);
      haloGrad.addColorStop(0.55, `rgba(255, 49, 92, ${0.35 * heat})`);
      haloGrad.addColorStop(1, "rgba(255, 49, 92, 0)");
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(wh.cx, wh.cy, wheelW * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Tire body
    ctx.fillStyle = "#070a14";
    roundedRect(wh.cx - wheelW * 0.5, wh.cy - wheelH * 0.5, wheelW, wheelH, h * 0.05);
    ctx.fill();
    // Rim disc
    const rimW = wheelW * 0.66;
    const rimH = wheelH * 0.66;
    const rimGrad = ctx.createRadialGradient(wh.cx, wh.cy, 0, wh.cx, wh.cy, rimW * 0.6);
    rimGrad.addColorStop(0, "#3a4258");
    rimGrad.addColorStop(0.55, "#222a3c");
    rimGrad.addColorStop(1, "#0e1322");
    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.ellipse(wh.cx, wh.cy, rimW * 0.5, rimH * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Spokes (5)
    if (wheelW > 6) {
      ctx.strokeStyle = "rgba(170, 190, 220, 0.55)";
      ctx.lineWidth = Math.max(0.8, wheelW * 0.06);
      for (let s = 0; s < 5; s++) {
        const a = (s / 5) * Math.PI * 2;
        const ex = wh.cx + Math.cos(a) * rimW * 0.4;
        const ey = wh.cy + Math.sin(a) * rimH * 0.4;
        ctx.beginPath();
        ctx.moveTo(wh.cx, wh.cy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
      // Hub
      ctx.fillStyle = "#dde3f0";
      ctx.beginPath();
      ctx.arc(wh.cx, wh.cy, Math.max(1.2, wheelW * 0.10), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function lightenHex(hex, amt) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const r = Math.min(255, Math.floor(parseInt(hex.slice(1, 3), 16) + 255 * amt));
  const g = Math.min(255, Math.floor(parseInt(hex.slice(3, 5), 16) + 255 * amt));
  const b = Math.min(255, Math.floor(parseInt(hex.slice(5, 7), 16) + 255 * amt));
  return `rgb(${r}, ${g}, ${b})`;
}

const CAR_SHAPES = {
  // Long-hood fastback grand tourer (Skyline / Supra vibe).
  gt: {
    widthMul: 1.02,
    heightMul: 1.05,
    draw(w, h, body, stripe) {
      drawCarBase(w, h, body, stripe, {
        bodyShape: (c, w, h, hi) => {
          c.beginPath();
          c.moveTo(-w * 0.48, h * 0.16);
          c.lineTo(-w * 0.46, -h * 0.10);
          c.lineTo(-w * 0.38, -h * 0.30);
          c.lineTo(-w * 0.06, -h * 0.36);
          c.lineTo(w * 0.06, -h * 0.36);
          c.lineTo(w * 0.38, -h * 0.30);
          c.lineTo(w * 0.46, -h * 0.10);
          c.lineTo(w * 0.48, h * 0.16);
          c.closePath();
          if (hi) {
            c.clip();
            c.fillRect(-w, -h, w * 2, h * 0.24);
          } else {
            c.fill();
          }
        },
        cabinShape: (c, w, h, hi) => {
          c.beginPath();
          c.moveTo(-w * 0.30, -h * 0.28);
          c.lineTo(-w * 0.04, -h * 0.34);
          c.lineTo(w * 0.04, -h * 0.34);
          c.lineTo(w * 0.30, -h * 0.28);
          c.lineTo(w * 0.32, -h * 0.10);
          c.lineTo(-w * 0.32, -h * 0.10);
          c.closePath();
          if (hi) {
            c.clip();
            c.fillRect(-w, -h, w * 2, h * 0.18);
          } else {
            c.fill();
          }
        },
        spoiler: "ducktail",
        taillight: "round-quad",
        headlightStyle: "slim",
        stripeShape: "twin",
        fenderFlare: 0.4,
        hoodLines: true,
        sideStrake: true,
        grille: true,
        diffuser: true
      });
    }
  },
  // Boxy '80s/'90s drift coupe (AE86 / S13 vibe).
  drift: {
    widthMul: 0.92,
    heightMul: 1.10,
    draw(w, h, body, stripe) {
      drawCarBase(w, h, body, stripe, {
        bodyShape: (c, w, h, hi) => {
          c.beginPath();
          c.moveTo(-w * 0.46, h * 0.18);
          c.lineTo(-w * 0.46, -h * 0.30);
          c.lineTo(w * 0.46, -h * 0.30);
          c.lineTo(w * 0.46, h * 0.18);
          c.closePath();
          if (hi) { c.clip(); c.fillRect(-w, -h, w * 2, h * 0.20); } else { c.fill(); }
        },
        cabinShape: (c, w, h, hi) => {
          c.beginPath();
          c.moveTo(-w * 0.34, -h * 0.30);
          c.lineTo(-w * 0.30, -h * 0.34);
          c.lineTo(w * 0.30, -h * 0.34);
          c.lineTo(w * 0.34, -h * 0.30);
          c.lineTo(w * 0.36, -h * 0.10);
          c.lineTo(-w * 0.36, -h * 0.10);
          c.closePath();
          if (hi) { c.clip(); c.fillRect(-w, -h, w * 2, h * 0.18); } else { c.fill(); }
        },
        spoiler: "lip",
        roofFin: true,
        taillight: "rect-dual",
        headlightStyle: "trapezoid",
        stripeShape: "single",
        fenderFlare: 0.2,
        hoodLines: true,
        sideStrake: true
      });
    }
  },
  // Rally sedan with massive wing and hood scoop (Evo / WRX vibe).
  rally: {
    widthMul: 0.98,
    heightMul: 1.16,
    draw(w, h, body, stripe) {
      drawCarBase(w, h, body, stripe, {
        bodyShape: (c, w, h, hi) => {
          c.beginPath();
          c.moveTo(-w * 0.48, h * 0.18);
          c.lineTo(-w * 0.46, -h * 0.04);
          c.lineTo(-w * 0.40, -h * 0.28);
          c.lineTo(-w * 0.16, -h * 0.34);
          c.lineTo(w * 0.16, -h * 0.34);
          c.lineTo(w * 0.40, -h * 0.28);
          c.lineTo(w * 0.46, -h * 0.04);
          c.lineTo(w * 0.48, h * 0.18);
          c.closePath();
          if (hi) { c.clip(); c.fillRect(-w, -h, w * 2, h * 0.22); } else { c.fill(); }
        },
        cabinShape: (c, w, h, hi) => {
          c.beginPath();
          c.moveTo(-w * 0.28, -h * 0.30);
          c.lineTo(-w * 0.14, -h * 0.34);
          c.lineTo(w * 0.14, -h * 0.34);
          c.lineTo(w * 0.28, -h * 0.30);
          c.lineTo(w * 0.30, -h * 0.10);
          c.lineTo(-w * 0.30, -h * 0.10);
          c.closePath();
          if (hi) { c.clip(); c.fillRect(-w, -h, w * 2, h * 0.20); } else { c.fill(); }
        },
        spoiler: "wing",
        hood: "scoop",
        hoodBulge: true,
        taillight: "round-dual",
        headlightStyle: "trapezoid",
        stripeShape: "twin",
        fenderFlare: 0.3,
        grille: true,
        sideStrake: true,
        diffuser: true
      });
    }
  },
  // Mid-engine wedge supercar (NSX / RX-7 FD vibe).
  super: {
    widthMul: 1.05,
    heightMul: 0.90,
    draw(w, h, body, stripe) {
      drawCarBase(w, h, body, stripe, {
        bodyShape: (c, w, h, hi) => {
          c.beginPath();
          c.moveTo(-w * 0.48, h * 0.10);
          c.lineTo(-w * 0.42, -h * 0.18);
          c.lineTo(-w * 0.18, -h * 0.32);
          c.lineTo(w * 0.18, -h * 0.32);
          c.lineTo(w * 0.42, -h * 0.18);
          c.lineTo(w * 0.48, h * 0.10);
          c.closePath();
          if (hi) { c.clip(); c.fillRect(-w, -h, w * 2, h * 0.20); } else { c.fill(); }
        },
        cabinShape: (c, w, h, hi) => {
          c.beginPath();
          c.moveTo(-w * 0.20, -h * 0.30);
          c.lineTo(-w * 0.08, -h * 0.34);
          c.lineTo(w * 0.08, -h * 0.34);
          c.lineTo(w * 0.20, -h * 0.30);
          c.lineTo(w * 0.24, -h * 0.14);
          c.lineTo(-w * 0.24, -h * 0.14);
          c.closePath();
          if (hi) { c.clip(); c.fillRect(-w, -h, w * 2, h * 0.18); } else { c.fill(); }
        },
        spoiler: "ducktail",
        hood: "vent",
        splitter: true,
        taillight: "strip",
        headlightStyle: "slim",
        stripeShape: "side",
        underglow: true,
        fenderFlare: 0.7,
        sideStrake: true,
        diffuser: true,
        grille: true
      });
    }
  },
  // Compact hot hatch (Civic Type R vibe).
  hatch: {
    widthMul: 0.86,
    heightMul: 1.18,
    draw(w, h, body, stripe) {
      drawCarBase(w, h, body, stripe, {
        bodyShape: (c, w, h, hi) => {
          c.beginPath();
          c.moveTo(-w * 0.46, h * 0.18);
          c.lineTo(-w * 0.46, -h * 0.16);
          c.lineTo(-w * 0.38, -h * 0.32);
          c.lineTo(w * 0.38, -h * 0.32);
          c.lineTo(w * 0.46, -h * 0.16);
          c.lineTo(w * 0.46, h * 0.18);
          c.closePath();
          if (hi) { c.clip(); c.fillRect(-w, -h, w * 2, h * 0.22); } else { c.fill(); }
        },
        cabinShape: (c, w, h, hi) => {
          c.beginPath();
          c.moveTo(-w * 0.32, -h * 0.30);
          c.lineTo(-w * 0.26, -h * 0.36);
          c.lineTo(w * 0.26, -h * 0.36);
          c.lineTo(w * 0.32, -h * 0.30);
          c.lineTo(w * 0.32, -h * 0.06);
          c.lineTo(-w * 0.32, -h * 0.06);
          c.closePath();
          if (hi) { c.clip(); c.fillRect(-w, -h, w * 2, h * 0.20); } else { c.fill(); }
        },
        spoiler: "wing",
        taillight: "stack",
        headlightStyle: "trapezoid",
        stripeShape: "side",
        fenderFlare: 0.15,
        grille: true,
        hoodLines: true
      });
    }
  },
  // Sport wagon (long roof, modest sport spoiler).
  wagon: {
    widthMul: 0.96,
    heightMul: 1.20,
    draw(w, h, body, stripe) {
      drawCarBase(w, h, body, stripe, {
        bodyShape: (c, w, h, hi) => {
          c.beginPath();
          c.moveTo(-w * 0.46, h * 0.18);
          c.lineTo(-w * 0.46, -h * 0.20);
          c.lineTo(-w * 0.40, -h * 0.32);
          c.lineTo(w * 0.40, -h * 0.32);
          c.lineTo(w * 0.46, -h * 0.20);
          c.lineTo(w * 0.46, h * 0.18);
          c.closePath();
          if (hi) { c.clip(); c.fillRect(-w, -h, w * 2, h * 0.20); } else { c.fill(); }
        },
        cabinShape: (c, w, h, hi) => {
          c.beginPath();
          c.moveTo(-w * 0.32, -h * 0.32);
          c.lineTo(-w * 0.28, -h * 0.36);
          c.lineTo(w * 0.28, -h * 0.36);
          c.lineTo(w * 0.32, -h * 0.32);
          c.lineTo(w * 0.34, -h * 0.06);
          c.lineTo(-w * 0.34, -h * 0.06);
          c.closePath();
          if (hi) { c.clip(); c.fillRect(-w, -h, w * 2, h * 0.20); } else { c.fill(); }
        },
        spoiler: "lip",
        taillight: "stack",
        headlightStyle: "trapezoid",
        stripeShape: "side",
        fenderFlare: 0.15,
        sideStrake: true,
        grille: true
      });
      // Roof rails — distinctive wagon silhouette.
      if (w > 24) {
        ctx.fillStyle = "#0e1326";
        ctx.fillRect(-w * 0.26, -h * 0.40, w * 0.52, h * 0.04);
      }
    }
  },
  // Wide-body tuner (RWB / Liberty Walk vibe — big flares + GT wing).
  tuner: {
    widthMul: 1.10,
    heightMul: 1.00,
    draw(w, h, body, stripe) {
      drawCarBase(w, h, body, stripe, {
        bodyShape: (c, w, h, hi) => {
          c.beginPath();
          c.moveTo(-w * 0.50, h * 0.20);
          c.lineTo(-w * 0.48, -h * 0.04);
          c.lineTo(-w * 0.40, -h * 0.24);
          c.lineTo(-w * 0.10, -h * 0.32);
          c.lineTo(w * 0.10, -h * 0.32);
          c.lineTo(w * 0.40, -h * 0.24);
          c.lineTo(w * 0.48, -h * 0.04);
          c.lineTo(w * 0.50, h * 0.20);
          c.closePath();
          if (hi) { c.clip(); c.fillRect(-w, -h, w * 2, h * 0.22); } else { c.fill(); }
        },
        cabinShape: (c, w, h, hi) => {
          c.beginPath();
          c.moveTo(-w * 0.24, -h * 0.30);
          c.lineTo(-w * 0.10, -h * 0.34);
          c.lineTo(w * 0.10, -h * 0.34);
          c.lineTo(w * 0.24, -h * 0.30);
          c.lineTo(w * 0.28, -h * 0.10);
          c.lineTo(-w * 0.28, -h * 0.10);
          c.closePath();
          if (hi) { c.clip(); c.fillRect(-w, -h, w * 2, h * 0.20); } else { c.fill(); }
        },
        spoiler: "wing",
        taillight: "round-quad",
        headlightStyle: "slim",
        stripeShape: "twin",
        fenderFlare: 0.55,
        hoodLines: true,
        sideStrake: true,
        diffuser: true,
        grille: true
      });
    }
  },
  // Kei car (mini, square — Cappuccino / Kei truck vibe).
  kei: {
    widthMul: 0.62,
    heightMul: 1.30,
    draw(w, h, body, stripe) {
      drawCarBase(w, h, body, stripe, {
        bodyShape: (c, w, h, hi) => {
          c.beginPath();
          c.moveTo(-w * 0.45, h * 0.18);
          c.lineTo(-w * 0.45, -h * 0.30);
          c.lineTo(w * 0.45, -h * 0.30);
          c.lineTo(w * 0.45, h * 0.18);
          c.closePath();
          if (hi) { c.clip(); c.fillRect(-w, -h, w * 2, h * 0.20); } else { c.fill(); }
        },
        cabinShape: (c, w, h, hi) => {
          c.beginPath();
          c.moveTo(-w * 0.36, -h * 0.32);
          c.lineTo(w * 0.36, -h * 0.32);
          c.lineTo(w * 0.36, -h * 0.06);
          c.lineTo(-w * 0.36, -h * 0.06);
          c.closePath();
          if (hi) { c.clip(); c.fillRect(-w, -h, w * 2, h * 0.20); } else { c.fill(); }
        },
        spoiler: null,
        roofFin: true,
        taillight: "rect-dual",
        headlightStyle: "round",
        stripeShape: "none",
        fenderFlare: 0
      });
    }
  }
};

function roundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawPlayerCar(baseSegment) {
  // Visible player movement: tied to playerX but kept moderate so the car stays "with the camera".
  const xFromPos = state.playerX * width * 0.08;
  const xFromSlip = state.slip * width * 0.025;
  const screenX = width / 2 + xFromPos + xFromSlip;
  // Brake nose-dive: car pitches forward (down-screen) during heavy braking.
  const speedPercent = state.speed / MAX_SPEED;
  const dive = state.lastInput && state.lastInput.brake && speedPercent > 0.3 ? 6 : 0;
  const screenY = height * 0.82 + dive + Math.sin(state.nightPulse * 6) * (state.boostKick > 0 ? 2.4 : 0.7);
  const size = Math.min(width, height) * 0.28;

  if (state.boostKick > 0) drawBoostFlame(screenX, screenY, size, state.boostKick, state.nightPulse);
  drawCarSprite(screenX, screenY, size, selectedRoster.body, selectedRoster.stripe, true, playerCarShape);
}

function drawBoostFlame(centerX, centerY, size, intensity, time) {
  const exhaustOffsets = [-size * 0.18, size * 0.18];
  const baseY = centerY + size * 0.18;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < exhaustOffsets.length; i++) {
    const ex = centerX + exhaustOffsets[i];
    const flicker = 0.78 + Math.sin(time * 42 + i * 1.7) * 0.16 + Math.random() * 0.06;
    const r = size * 0.13 * intensity * flicker;
    const tail = baseY + r * 1.4;

    // Outer red halo
    let g = ctx.createRadialGradient(ex, tail, 0, ex, tail, r * 3.4);
    g.addColorStop(0, "rgba(255, 80, 60, 0.55)");
    g.addColorStop(1, "rgba(255, 49, 92, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(ex, tail, r * 1.5, r * 3.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mid gold flame
    g = ctx.createRadialGradient(ex, baseY + r * 0.6, 0, ex, baseY + r * 0.6, r * 2.2);
    g.addColorStop(0, "rgba(255, 209, 102, 0.95)");
    g.addColorStop(0.5, "rgba(255, 143, 31, 0.55)");
    g.addColorStop(1, "rgba(255, 49, 92, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(ex, baseY + r * 0.6, r * 0.95, r * 1.9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Inner cyan/white core
    g = ctx.createRadialGradient(ex, baseY, 0, ex, baseY, r * 1.2);
    g.addColorStop(0, "rgba(220, 248, 255, 1)");
    g.addColorStop(0.45, "rgba(46, 233, 255, 0.85)");
    g.addColorStop(1, "rgba(46, 233, 255, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(ex, baseY + r * 0.2, r * 0.55, r * 1.0, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Heat shockwave streaks behind the car when boost is at peak intensity.
  if (intensity > 0.5) {
    ctx.globalAlpha = 0.18 * (intensity - 0.5);
    ctx.strokeStyle = "rgba(46, 233, 255, 0.9)";
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 6; i++) {
      const offset = (i * 17 + time * 80) % (size * 0.6);
      const sx = centerX - size * 0.42;
      const sy = baseY - size * 0.05 + offset;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + size * 0.18, sy + size * 0.04);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(centerX + size * 0.24, sy);
      ctx.lineTo(centerX + size * 0.42, sy + size * 0.04);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawParticles() {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of smoke) {
    const alpha = Math.max(0, Math.min(1, p.life));
    const r = p.r;
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 1.4);
    const baseColor = p.color;
    grad.addColorStop(0, baseColor);
    grad.addColorStop(1, baseColor.replace(/[\d\.]+\)$/, "0)"));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  for (const s of sparks) {
    ctx.save();
    const alpha = Math.max(0, Math.min(1, s.life));
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x - s.vx * 0.05, s.y - s.vy * 0.05);
    ctx.stroke();
    ctx.restore();
  }
}

function updateParticles(dt) {
  let writeIdx = 0;
  for (let i = 0; i < smoke.length; i++) {
    const p = smoke[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.r += 34 * dt;
    p.life -= 1.4 * dt;
    if (p.life > 0) {
      if (writeIdx !== i) smoke[writeIdx] = p;
      writeIdx++;
    }
  }
  smoke.length = writeIdx;

  writeIdx = 0;
  for (let i = 0; i < sparks.length; i++) {
    const s = sparks[i];
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vy += 600 * dt;
    s.life -= 2.4 * dt;
    if (s.life > 0) {
      if (writeIdx !== i) sparks[writeIdx] = s;
      writeIdx++;
    }
  }
  sparks.length = writeIdx;
}

function spawnSmoke(intensity) {
  if (smoke.length >= PARTICLE_CAP) return;
  const baseX = width / 2 + state.playerX * width * 0.08 + state.slip * width * 0.025;
  const side = Math.random() < 0.5 ? -1 : 1;
  smoke.push({
    x: baseX + side * width * 0.055 + (Math.random() - 0.5) * width * 0.020,
    y: height * 0.86 + Math.random() * height * 0.03,
    vx: side * (50 + Math.random() * 50),
    vy: 35 + Math.random() * 45,
    r: 8 + Math.random() * 10 + intensity * 6,
    life: 0.28 + Math.random() * 0.14,
    color: `rgba(220, 222, 230, ${0.22 + intensity * 0.14})`
  });
}

function spawnBoostStreak() {
  if (smoke.length >= PARTICLE_CAP - 4) return;
  const baseX = width / 2 + state.playerX * width * 0.08;
  const baseY = height * 0.86;
  const size = Math.min(width, height) * 0.28;
  // Thin one-shot streaks — only spawn every other frame's worth to avoid soup.
  if ((state.frameTick = (state.frameTick || 0) + 1) % 2 !== 0) return;
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    smoke.push({
      x: baseX + side * size * 0.18,
      y: baseY + size * 0.05,
      vx: side * (35 + Math.random() * 50),
      vy: 320 + Math.random() * 180,
      r: 2 + Math.random() * 2,
      life: 0.18 + Math.random() * 0.10,
      color: i === 0 ? "rgba(46, 233, 255, 0.85)" : "rgba(255, 209, 102, 0.7)"
    });
  }
}

function spawnSparks(side) {
  for (let i = 0; i < 12; i++) {
    if (sparks.length >= PARTICLE_CAP) break;
    sparks.push({
      x: width / 2 + side * width * 0.22,
      y: height * 0.79 + Math.random() * 30,
      vx: side * (180 + Math.random() * 240),
      vy: -140 + Math.random() * 180,
      life: 0.35 + Math.random() * 0.18,
      color: Math.random() > 0.45 ? "#ffd166" : "#ff315c"
    });
  }
}

function update(dt) {
  const input = getInput();
  state.lastInput = input;
  const currentSegment = findSegment(state.position + playerZ);
  state.nightPulse += dt;
  state.calloutTimer = Math.max(0, state.calloutTimer - dt);
  state.apexCooldown = Math.max(0, state.apexCooldown - dt);
  state.draft = Math.max(0, state.draft - dt * 2.2);
  // Combo decay — chain expires after 4s without action.
  if (state.comboTimer > 0) state.comboTimer = Math.max(0, state.comboTimer - dt);
  if (state.comboTimer === 0 && state.combo > 0) state.combo = 0;

  if (state.countdown > 0) {
    state.countdown = Math.max(0, state.countdown - dt);
    state.speed = Math.max(0, state.speed - DECEL * dt * 0.3);
    state.boost = Math.min(1, state.boost + 0.06 * dt);
    updateCars(dt, false);
    updateParticles(dt);
    if (state.countdown <= 0) {
      state.running = true;
      state.speed = MAX_SPEED * 0.3;
      triggerCallout("GO", 0.86, 1.1);
    }
    return;
  }

  if (!state.running || state.finished) {
    state.speed = Math.max(0, state.speed - DECEL * dt * 0.6);
    state.position = increase(state.position, state.speed * dt, trackLength);
    updateCars(dt, state.finished);
    updateParticles(dt);
    return;
  }

  state.raceTime += dt;
  state.currentLapTime += dt;
  if (currentSegment.sector !== state.lastSector) {
    state.lastSector = currentSegment.sector;
  }

  const stats = state.playerStats || SHAPE_STATS.gt;
  const accel = input.throttle ? ACCEL * stats.accel : 0;
  if (input.brake) state.speed -= BRAKE * stats.brake * dt;
  else if (input.throttle) state.speed += accel * dt;
  else state.speed -= DECEL * dt;

  const boostActive = input.boost && state.boost > 0.02 && state.speed > MAX_SPEED * 0.35;
  const wasBoosting = state.boostKick >= 1;
  if (boostActive) {
    state.speed += ACCEL * 1.10 * dt;
    state.boost = Math.max(0, state.boost - 0.20 * dt);
    state.boostKick = 1;
    state.cameraShake = Math.min(1, state.cameraShake + 3.5 * dt);
    if (!wasBoosting) audio.boost();
    spawnBoostStreak();
  } else {
    state.boostKick = Math.max(0, state.boostKick - 2.6 * dt);
    // Passive boost regen while not actively burning it.
    if (state.running && state.speed > MAX_SPEED * 0.25) {
      state.boost = Math.min(1, state.boost + 0.08 * dt);
    }
  }

  const engineCap = ENGINE_BLOWN_FLOOR + state.engineHealth * (1 - ENGINE_BLOWN_FLOOR);
  const speedCeiling = MAX_SPEED * stats.top * engineCap * (state.boostKick > 0 ? BOOST_SPEED_MUL : 1);
  state.speed = Math.max(0, Math.min(speedCeiling, state.speed));

  const speedPercent = state.speed / MAX_SPEED;
  if (speedPercent > REDLINE_PCT) {
    state.engineRedlineTime += dt;
    state.engineHealth = Math.max(0, state.engineHealth - (speedPercent - REDLINE_PCT) * ENGINE_WEAR_RATE * dt * (input.boost ? 1.6 : 1));
    if (state.engineHealth < 0.4 && !state.engineWarned) {
      state.engineWarned = true;
      triggerCallout("Easy", 0.7, 0.7);
    }
  } else {
    // Full recovery below cruise, reduced recovery in the safe zone so the player isn't forced to brake to heal.
    const rate = speedPercent < CRUISE_PCT ? ENGINE_RECOVERY_RATE : ENGINE_RECOVERY_RATE * 0.45;
    state.engineHealth = Math.min(1, state.engineHealth + rate * dt);
    if (state.engineHealth > 0.7) state.engineWarned = false;
    state.engineRedlineTime = Math.max(0, state.engineRedlineTime - dt * 0.4);
  }
  const isDrifting = input.drift && Math.abs(input.steer) > 0.1 && speedPercent > 0.32;
  const steerPower = input.drift ? 1.55 : 1;
  const brakeUndersteer = input.brake && speedPercent > 0.5 ? 0.86 : 1;
  const targetSteer = input.steer * steerPower * brakeUndersteer;
  state.steer = interpolate(state.steer, targetSteer, Math.min(1, dt * 28));
  // Stun reduces control briefly after a real hit.
  state.stunT = Math.max(0, state.stunT - dt);
  const stunFactor = state.stunT > 0 ? 0.45 + (1 - state.stunT / 0.5) * 0.55 : 1.0;
  const steerAuthority = (1.92 + (1 - Math.pow(speedPercent, 1.5)) * 1.10) * stats.handling * stunFactor;
  // Direct steering input drives lateral movement.
  state.playerX += state.steer * dt * steerAuthority;
  // Centripetal pull from curves, softened by grip.
  const curvePull = currentSegment.curve * CENTRIFUGAL * speedPercent * speedPercent * dt * (1.20 / stats.grip);
  state.playerX -= curvePull;
  // Brake-into-corner rotation aid: tap brake mid-curve and the front bites harder.
  if (input.brake && Math.abs(currentSegment.curve) > 1.2 && speedPercent > 0.45) {
    state.playerX -= currentSegment.curve * 0.012 * speedPercent * dt * stats.handling;
  }
  // Drift slip — when drifting, the rear washes out opposite to your steer input.
  if (isDrifting) {
    const slipStrength = Math.abs(state.steer) * (0.6 + speedPercent * 0.7) * (1.4 - stats.grip * 0.4);
    state.playerX += -Math.sign(state.steer) * slipStrength * dt * 0.55;
  }
  state.lateralV = state.steer * steerAuthority;

  // ---- Tire physics: friction-circle-style load vs grip budget ----
  // Lateral load: how hard the tires are working laterally (steering input + curve push).
  const steerLoad = Math.abs(state.steer) * (0.6 + speedPercent * 0.65);
  const curveLoad = Math.abs(currentSegment.curve) * 0.055 * speedPercent * speedPercent;
  // Longitudinal load: throttle and (heavier) brake.
  const longLoad = (input.throttle ? 0.5 : 0) + (input.brake ? 0.9 : 0);
  // Tires can only do so much total work — friction circle.
  const tireLoad = Math.sqrt((steerLoad + curveLoad) * (steerLoad + curveLoad) + longLoad * longLoad);
  const driftAssist = isDrifting ? 1.18 : 1.0; // drift mode lets the player exceed grip budget cleanly
  const tireBudget = stats.grip * driftAssist * (1 - speedPercent * 0.18);
  state.tireLoad = tireLoad;
  state.tireBudget = tireBudget;

  if (tireLoad > tireBudget) {
    const overload = Math.min(1.2, tireLoad - tireBudget);
    state.tireSlip = Math.min(1, state.tireSlip + overload * dt * 4.5);
    // Slip pushes the player outward — losing the rear in the direction of steering input.
    const slipDir = state.steer !== 0 ? Math.sign(state.steer) : -Math.sign(currentSegment.curve);
    state.playerX += -slipDir * state.tireSlip * 0.55 * dt;
    // Smoke + slight speed loss while sliding (scrubbing speed).
    state.speed = Math.max(0, state.speed - MAX_SPEED * 0.18 * state.tireSlip * dt);
    // Floating smoke only while NOT drifting — drift mode uses road trails instead.
    // Sparingly: only on hard slip and at low spawn rate.
    if (state.tireSlip > 0.45 && !isDrifting && Math.random() < 0.15) spawnSmoke(state.tireSlip);
  } else {
    state.tireSlip = Math.max(0, state.tireSlip - dt * 2.5);
  }

  // Lay down road trails. Drift mode → white drift trails. Hard slip without drift → dark scrub marks.
  if (isDrifting && Math.abs(state.steer) > 0.18) {
    addSkidMarkAtPlayer(Math.abs(state.steer), "drift");
  }
  if (state.tireSlip > 0.22 && !isDrifting) {
    addSkidMarkAtPlayer(state.tireSlip, "scrub");
  }

  // Visible yaw angle: car rotates to reflect steering, slip, and curve forces.
  const yawFromSteer = state.steer * 0.18;
  const yawFromCurve = currentSegment.curve * 0.012 * speedPercent;
  const yawFromDrift = isDrifting ? -Math.sign(state.steer) * 0.22 * Math.abs(state.steer) : 0;
  // Counter-steer detection: if yaw and steer disagree, the car snaps back faster.
  const counter = Math.sign(state.yaw) !== Math.sign(state.steer) && Math.abs(state.steer) > 0.15 ? 2.2 : 1;
  const targetYaw = yawFromSteer + yawFromCurve + yawFromDrift;
  state.yaw = interpolate(state.yaw, targetYaw, Math.min(1, dt * 6 * counter));

  // Single coherent camera tilt cue. Keep it gentle and capped.
  const rawTilt = -currentSegment.curve * 0.010 * speedPercent
    - state.steer * 0.010 * speedPercent;
  const targetTilt = Math.max(-0.05, Math.min(0.05, rawTilt));
  state.cameraTilt = interpolate(state.cameraTilt, targetTilt, Math.min(1, dt * 4));
  // Keep these around but parked — render uses cameraTilt + boostKick directly.
  state.cameraLateralPush = 0;
  state.fovPunch = 0;

  state.drift = interpolate(state.drift, isDrifting ? 1 : 0, Math.min(1, dt * 5.5));
  const targetSlip = isDrifting ? -input.steer * (0.8 + speedPercent * 0.55) : state.steer * 0.28;
  state.slip = interpolate(state.slip, targetSlip, Math.min(1, dt * 6));

  if (isDrifting) {
    // Drift mode uses road trails — no floating smoke at all.
    const isApex = Math.sign(input.steer) === Math.sign(currentSegment.curve) && Math.abs(currentSegment.curve) > 1.1;
    const apexBonus = isApex ? 0.052 : 0.018;
    state.boost = Math.min(1, state.boost + apexBonus * dt);
    state.driftCombo += dt;
    if (isApex && state.apexCooldown <= 0) {
      state.boost = Math.min(1, state.boost + 0.06);
      state.lastDriftBonus = state.driftCombo;
      triggerCallout("Apex", 0.55, 0.75);
      state.apexCooldown = 1.05;
    }
  } else if (Math.abs(currentSegment.curve) > 1.4 && Math.sign(state.steer) === Math.sign(currentSegment.curve)) {
    state.boost = Math.min(1, state.boost + 0.024 * dt * speedPercent);
    state.driftCombo = Math.max(0, state.driftCombo - dt * 1.8);
  } else {
    state.driftCombo = Math.max(0, state.driftCombo - dt * 2.4);
  }

  if (Math.abs(state.playerX) > 1) {
    state.speed = Math.max(0, state.speed - OFF_ROAD_DECEL * Math.abs(state.playerX) * dt);
    state.boost = Math.max(0, state.boost - 0.08 * dt);
    if (state.hitFlash <= 0 && state.speed > MAX_SPEED * 0.55) spawnSparks(Math.sign(state.playerX));
    state.hitFlash = Math.max(state.hitFlash, 0.18);
  }

  state.playerX = Math.max(-1.42, Math.min(1.42, state.playerX));
  state.hitFlash = Math.max(0, state.hitFlash - dt);
  state.cameraShake = Math.max(0, state.cameraShake - 2.6 * dt);

  const oldDistance = state.distance;
  state.position = increase(state.position, state.speed * dt, trackLength);
  state.distance += state.speed * dt;
  const oldLap = Math.floor(oldDistance / trackLength);
  const newLap = Math.floor(state.distance / trackLength);
  if (newLap > oldLap) {
    const finishedLapTime = state.currentLapTime;
    state.bestLap = Math.min(state.bestLap, finishedLapTime);
    state.currentLapTime = 0;
    state.lap = Math.min(LAPS_TOTAL, newLap + 1);
    state.boost = Math.min(1, state.boost + 0.28);
    if (allTimeBestLap == null || finishedLapTime < allTimeBestLap) {
      allTimeBestLap = finishedLapTime;
      bestLapStorage.write(finishedLapTime);
      triggerCallout("New PB", 1.1, 0.95);
      audio.pb();
    } else if (newLap < LAPS_TOTAL) {
      triggerCallout(newLap + 1 === LAPS_TOTAL ? "Final Lap" : `Lap ${newLap + 1}`, 0.9, 0.82);
    } else if (newLap >= LAPS_TOTAL) {
      // last lap completed without PB — still let finish panel handle messaging
    }
  }

  updateCars(dt);
  applyCollisionAssist(dt);
  checkCarCollisions(dt);
  checkDraft(dt);
  updatePlacement();
  updateParticles(dt);

  if (state.distance >= trackLength * LAPS_TOTAL) finishRace();
}

function getInput() {
  const left = KEY.has("ArrowLeft") || KEY.has("KeyA");
  const right = KEY.has("ArrowRight") || KEY.has("KeyD");
  return {
    steer: (left ? -1 : 0) + (right ? 1 : 0),
    throttle: KEY.has("ArrowUp") || KEY.has("KeyW"),
    brake: KEY.has("ArrowDown") || KEY.has("KeyS"),
    drift: KEY.has("Space"),
    boost: KEY.has("ShiftLeft") || KEY.has("ShiftRight")
  };
}

function steerCar(car, carSegment, dt) {
  const curveBias = -Math.sign(carSegment.curve) * Math.min(0.45, Math.abs(carSegment.curve) * 0.06);
  let target = Math.max(-1, Math.min(1, car.homeOffset + curveBias));
  let blockerSpeed = null;
  let nearestBlockerDz = Infinity;

  // Wider look-ahead and tighter lateral threshold (5 lanes — 0.40 spacing per lane).
  const LOOKAHEAD = SEGMENT_LENGTH * 9;
  const SAME_LANE = 0.30;

  for (const other of cars) {
    if (other === car) continue;
    let dz = other.z - car.z;
    if (dz < 0) dz += trackLength;
    if (dz > 0 && dz < LOOKAHEAD && Math.abs(other.offset - car.offset) < SAME_LANE) {
      const dodge = other.offset > car.homeOffset ? -0.42 : 0.42;
      target = Math.max(-1, Math.min(1, car.homeOffset + dodge));
      // Track the nearest blocker so brake force scales with proximity.
      if (dz < nearestBlockerDz) {
        nearestBlockerDz = dz;
        blockerSpeed = other.speed;
      }
    }
  }

  let playerDz = state.position - car.z;
  if (playerDz < 0) playerDz += trackLength;
  if (playerDz > 0 && playerDz < SEGMENT_LENGTH * 6 && Math.abs(state.playerX - car.offset) < 0.34) {
    const dodge = state.playerX > car.homeOffset ? -0.4 : 0.4;
    target = Math.max(-1, Math.min(1, car.homeOffset + dodge));
    if (blockerSpeed == null || state.speed * 0.94 < blockerSpeed) blockerSpeed = state.speed * 0.94;
  }

  // Brake harder when the blocker is closer.
  if (blockerSpeed != null && nearestBlockerDz < SEGMENT_LENGTH * 3) {
    const proximity = 1 - nearestBlockerDz / (SEGMENT_LENGTH * 3);
    blockerSpeed = blockerSpeed * (1 - proximity * 0.10);
  }

  car.baseOffset = interpolate(car.baseOffset, target, Math.min(1, dt * 1.4));
  return blockerSpeed;
}

function updateCars(dt, advance = true) {
  for (let i = 0; i < segmentsWithCars.length; i++) segmentsWithCars[i].cars.length = 0;
  segmentsWithCars.length = 0;

  for (const car of cars) {
    if (advance) {
      car.wobble += dt * 1.4;
      const carSegment = findSegment(car.z);
      const blockerSpeed = steerCar(car, carSegment, dt);
      // AI tire-budget approximation: tight curves cost real speed (matches player physics feel).
      const aiStats = SHAPE_STATS[car.shape] || SHAPE_STATS.gt;
      const cornerSeverity = Math.abs(carSegment.curve);
      const cornerDrag = Math.min(0.22, cornerSeverity * 0.022) / aiStats.grip;
      // Look ahead 3 segments — start braking before the curve hits.
      const lookAhead = segments[(carSegment.index + 3) % segments.length];
      const previewDrag = Math.min(0.18, Math.abs(lookAhead.curve) * 0.018) / aiStats.grip;
      const totalDrag = Math.max(cornerDrag, previewDrag * 0.6);
      let pace = car.targetSpeed * (1 - totalDrag);
      if (blockerSpeed != null) pace = Math.min(pace, blockerSpeed * 0.96);
      car.speed = interpolate(car.speed, pace, Math.min(1, dt * 1.4));
      car.z = increase(car.z, car.speed * dt, trackLength);
      car.rankDistance += car.speed * dt;
      car.offset = car.baseOffset + Math.sin(car.wobble) * 0.055;
    } else {
      car.speed = interpolate(car.speed, 0, Math.min(1, dt * 4));
      car.offset = car.baseOffset;
    }

    let dz = car.z - state.position;
    if (dz < 0) dz += trackLength;
    if (dz > 0 && dz < DRAW_DISTANCE * SEGMENT_LENGTH) {
      const segment = findSegment(car.z);
      if (segment.cars.length === 0) segmentsWithCars.push(segment);
      segment.cars.push(car);
    }
  }
}

const HITBOX_LATERAL_BASE = 0.20;
const HITBOX_LATERAL_WIDTH_SCALE = 0.06;
const HITBOX_LONGITUDINAL = SEGMENT_LENGTH * 0.50;
const NEAR_MISS_PAD = 0.18;
const NEAR_MISS_LONGITUDINAL = SEGMENT_LENGTH * 0.75;
const COLLISION_COOLDOWN = 0.22;

function hitboxLateralFor(car) {
  const playerW = (CAR_SHAPES[playerCarShape] || CAR_SHAPES.gt).widthMul;
  const carW = (CAR_SHAPES[car.shape] || CAR_SHAPES.gt).widthMul;
  return HITBOX_LATERAL_BASE + HITBOX_LATERAL_WIDTH_SCALE * (playerW + carW) / 2;
}

function checkCarCollisions(dt) {
  const playerWorldZ = increase(state.position + playerZ, 0, trackLength);
  for (const car of cars) {
    if (car.contactT > 0) car.contactT -= dt;

    let dz = car.z - playerWorldZ;
    if (dz < -trackLength * 0.5) dz += trackLength;
    if (dz > trackLength * 0.5) dz -= trackLength;

    const lateralGap = car.offset - state.playerX;
    const absLat = Math.abs(lateralGap);
    const absLong = Math.abs(dz);

    const lateralLimit = hitboxLateralFor(car);
    const nearMissLimit = lateralLimit + NEAR_MISS_PAD;

    // Arm near-miss when player enters the outer ring while the rival is still ahead.
    const inNearRing = absLong < NEAR_MISS_LONGITUDINAL && absLat < nearMissLimit;
    if (inNearRing && dz > 0 && absLat >= lateralLimit) {
      car.nearMissArmed = true;
    }

    // Detect pass: rival was ahead, now behind — fire near-miss if armed and never collided.
    if (car.lastDz > 0 && dz <= 0 && car.nearMissArmed && car.contactT <= 0) {
      triggerNearMiss(car, absLat, lateralLimit, nearMissLimit);
      car.nearMissArmed = false;
    }
    if (!inNearRing) car.nearMissArmed = false;
    car.lastDz = dz;

    if (absLong >= HITBOX_LONGITUDINAL || absLat >= lateralLimit) continue;
    if (car.contactT > 0) continue;
    car.contactT = COLLISION_COOLDOWN;
    // A real hit invalidates the near-miss arming.
    car.nearMissArmed = false;

    const pushSign = lateralGap === 0 ? (Math.random() < 0.5 ? -1 : 1) : (lateralGap > 0 ? -1 : 1);
    const closing = Math.abs(state.speed - car.speed);
    const closingPct = Math.min(1, closing / MAX_SPEED);

    if (dz > 0 && state.speed > car.speed) {
      // Rear-end: player rams a slower rival ahead.
      const lossFactor = 0.55 + closingPct * 0.5;
      state.speed = Math.max(car.speed * 0.85, state.speed - closing * lossFactor);
      car.speed = Math.min(car.targetSpeed, car.speed + closing * 0.22);
      state.playerX += pushSign * 0.18;
      car.baseOffset -= pushSign * 0.14;
      // Yaw kick — hard rear-ends rotate the car visibly. Scaled by closing %.
      state.yaw += -pushSign * (0.18 + closingPct * 0.30);
      state.cameraShake = Math.min(1, state.cameraShake + 0.55 + closingPct * 0.6);
      state.hitFlash = Math.max(state.hitFlash, 0.28);
      state.stunT = Math.max(state.stunT, 0.32 + closingPct * 0.30);
      state.engineHealth = Math.max(0, state.engineHealth - 0.05 - closingPct * 0.10);
      // Hard hit breaks any combo.
      state.combo = 0;
      spawnSparks(-pushSign);
      spawnSparks(-pushSign);
      audio.hit(0.7 + closingPct * 0.7);
    } else if (dz < 0 && car.speed > state.speed) {
      // Rear-ended: rival catches the player.
      const lossFactor = 0.35 + closingPct * 0.4;
      state.speed = state.speed + closing * lossFactor;
      car.speed = Math.max(state.speed * 0.85, car.speed - closing * 0.30);
      state.playerX += pushSign * 0.14;
      car.baseOffset -= pushSign * 0.08;
      state.cameraShake = Math.min(1, state.cameraShake + 0.45);
      state.hitFlash = Math.max(state.hitFlash, 0.22);
      state.stunT = Math.max(state.stunT, 0.28);
      state.engineHealth = Math.max(0, state.engineHealth - 0.03 - closingPct * 0.06);
      state.yaw += pushSign * (0.12 + closingPct * 0.20);
      state.combo = 0;
      spawnSparks(pushSign);
      audio.hit(0.55 + closingPct * 0.55);
    } else {
      // Side-swipe at similar speed.
      state.playerX += pushSign * 0.13;
      car.baseOffset -= pushSign * 0.13;
      state.speed = Math.max(0, state.speed - MAX_SPEED * 0.012);
      state.cameraShake = Math.min(1, state.cameraShake + 0.30);
      state.hitFlash = Math.max(state.hitFlash, 0.16);
      state.stunT = Math.max(state.stunT, 0.18);
      state.yaw += pushSign * 0.10;
      state.combo = Math.max(0, state.combo - 1);
      spawnSparks(pushSign);
      audio.hit(0.45);
    }
  }
}

function bumpCombo(amount, label) {
  const before = state.combo;
  state.combo += amount;
  state.comboTimer = 4.0;
  state.comboBest = Math.max(state.comboBest, state.combo);
  // Threshold reward each time the combo crosses a multiple of 5.
  const crossedThreshold = Math.floor(state.combo / 5) > Math.floor(before / 5);
  if (crossedThreshold) {
    state.boost = Math.min(1, state.boost + 0.18);
    const tier = Math.floor(state.combo / 5) * 5;
    triggerCallout(`x${tier}!`, 0.85, 0.95 + Math.min(0.6, tier * 0.04));
    audio.pb();
  } else if (label) {
    triggerCallout(label, 0.5, 0.7);
  }
}

function triggerNearMiss(car, lateralGap, lateralLimit, nearMissLimit) {
  const inner = lateralLimit != null ? lateralLimit : 0.22;
  const outer = nearMissLimit != null ? nearMissLimit : 0.42;
  const proximity = 1 - (lateralGap - inner) / Math.max(0.001, outer - inner);
  const intensity = Math.max(0.35, Math.min(1, proximity));
  // Bigger speed bump + boost reward for tight passes.
  state.speed = Math.min(MAX_SPEED * BOOST_SPEED_MUL, state.speed + MAX_SPEED * 0.06 * intensity);
  state.boost = Math.min(1, state.boost + 0.10 * intensity);
  state.boostKick = Math.max(state.boostKick, 0.85 * intensity);
  state.cameraShake = Math.min(1, state.cameraShake + 0.22 * intensity);
  state.hitFlash = Math.max(state.hitFlash, 0.06 * intensity);
  // Heroic graze (intensity > 0.7) → slow-mo micro-pause for cinematic punch.
  if (intensity > 0.7) {
    state.slowmoT = Math.max(state.slowmoT, 0.22);
  }
  bumpCombo(intensity > 0.7 ? 2 : 1, intensity > 0.7 ? "INCH" : "Close");
  audio.boost();
  // Whoosh particles streaming past — more streaks for tighter passes.
  const streaks = 8 + Math.floor(intensity * 6);
  const passSide = lateralGap > 0 ? 1 : -1;
  for (let i = 0; i < streaks; i++) {
    smoke.push({
      x: width / 2 + passSide * width * (0.10 + Math.random() * 0.22),
      y: height * 0.55 + Math.random() * height * 0.25,
      vx: passSide * (340 + Math.random() * 280),
      vy: -50 + Math.random() * 80,
      r: 3 + Math.random() * 5,
      life: 0.22 + Math.random() * 0.18,
      color: i % 3 === 0
        ? "rgba(46, 233, 255, 0.75)"
        : i % 3 === 1
          ? "rgba(255, 209, 102, 0.6)"
          : "rgba(255, 49, 92, 0.55)"
    });
  }
}

const MAX_SKID_PER_SEGMENT = 6;
function addSkidMarkAtPlayer(intensity, kind = "scrub") {
  const seg = findSegment(state.position + playerZ);
  if (!seg.skidMarks) seg.skidMarks = [];
  // Trail spacing + width scale with the player car's actual width.
  const carWidth = (CAR_SHAPES[playerCarShape] || CAR_SHAPES.gt).widthMul;
  const spacing = 0.040 * carWidth;
  const baseWidth = (kind === "drift" ? 0.022 : 0.016) * carWidth;
  for (const side of [-1, 1]) {
    seg.skidMarks.push({
      offset: state.playerX + side * spacing,
      width: baseWidth,
      alpha: kind === "drift"
        ? Math.min(0.55, 0.25 + intensity * 0.4)
        : Math.min(0.9, 0.4 + intensity * 0.6),
      kind
    });
  }
  if (seg.skidMarks.length > MAX_SKID_PER_SEGMENT) {
    seg.skidMarks.splice(0, seg.skidMarks.length - MAX_SKID_PER_SEGMENT);
  }
}

function clearAllSkidMarks() {
  for (const seg of segments) if (seg.skidMarks && seg.skidMarks.length) seg.skidMarks.length = 0;
}

function applyCollisionAssist(dt) {
  if (!state.lastInput) return;
  // Don't assist if the player is already steering hard — they're committed to a line.
  if (Math.abs(state.lastInput.steer) > 0.45) return;

  const playerWorldZ = increase(state.position + playerZ, 0, trackLength);
  let nearestThreat = null;
  let nearestDz = Infinity;
  for (const car of cars) {
    let dz = car.z - playerWorldZ;
    if (dz < 0) dz += trackLength;
    if (dz < SEGMENT_LENGTH * 0.6 || dz > SEGMENT_LENGTH * 4) continue;
    const lateralGap = Math.abs(car.offset - state.playerX);
    if (lateralGap > 0.32) continue;
    if (state.speed <= car.speed * 1.05) continue; // not actually closing fast enough
    if (dz < nearestDz) { nearestDz = dz; nearestThreat = car; }
  }
  if (!nearestThreat) return;

  // Nudge toward the open side. Pick whichever side has more road clearance.
  const lateralFromThreat = state.playerX - nearestThreat.offset;
  const targetDir = lateralFromThreat !== 0 ? Math.sign(lateralFromThreat) : (nearestThreat.offset >= 0 ? -1 : 1);
  // Clamp the assist to track bounds so it never pushes you off-road.
  const safeTarget = nearestThreat.offset + targetDir * 0.45;
  if (Math.abs(safeTarget) > 1.0) return;

  const proximity = 1 - (nearestDz / (SEGMENT_LENGTH * 4));
  const intensity = Math.max(0, Math.min(1, proximity));
  // Gentle assist — about half the strength of a held steering input.
  state.playerX += targetDir * intensity * 0.85 * dt;
}

function checkDraft(dt) {
  const playerWorldZ = increase(state.position + playerZ, 0, trackLength);
  for (const car of cars) {
    let dz = car.z - playerWorldZ;
    if (dz < 0) dz += trackLength;
    if (dz > 120 && dz < 1500 && Math.abs(car.offset - state.playerX) < 0.42 && state.speed > MAX_SPEED * 0.55) {
      state.draft = 1;
      state.boost = Math.min(1, state.boost + 0.08 * dt);
      state.speed = Math.min(MAX_SPEED * 1.08, state.speed + ACCEL * 0.18 * dt);
      if (state.apexCooldown <= 0) {
        triggerCallout("Draft", 0.45, 0.72);
        state.apexCooldown = 0.8;
      }
      break;
    }
  }
}

function updatePlacement() {
  let place = 1;
  for (const car of cars) {
    const carTotal = car.rankDistance;
    if (carTotal > state.distance) place++;
  }
  if (state.lastPlace == null) state.lastPlace = place;
  if (place < state.lastPlace) {
    // Overtake! Bigger pop when grabbing a podium spot.
    const podium = place <= 3;
    const text = podium ? `P${place}!` : "Overtake";
    triggerCallout(text, podium ? 1.0 : 0.7, podium ? 1.0 : 0.78);
    state.boost = Math.min(1, state.boost + 0.05);
    audio.boost();
    bumpCombo(podium ? 2 : 1, null);
  } else if (place > state.lastPlace) {
    state.lastPassedT = (state.lastPassedT || 0) + 1;
  }
  state.lastPlace = place;
  state.place = place;
}

function finishRace() {
  state.finished = true;
  state.running = false;
  const time = formatTime(state.raceTime);
  const bestLap = Number.isFinite(state.bestLap) ? formatTime(state.bestLap) : formatTime(state.currentLapTime);
  const titles = ["Legend Run", "Podium Heat", "Clean Run", "Street Sharp", "Keep Pushing", "Garage Night"];
  ui.finishTitle.textContent = titles[Math.min(titles.length - 1, state.place - 1)];
  const pbLine = allTimeBestLap != null
    ? ` - PB ${formatTime(allTimeBestLap)}`
    : "";
  ui.finishStats.textContent = `${ordinal(state.place)} place - ${time} total - ${bestLap} best lap${pbLine}`;
  ui.finish.hidden = false;
  ui.start.textContent = "Restart";
}

function render() {
  ctx.save();
  // Single coherent camera transform: shake → tilt with just enough overscan to hide rotation corners.
  if (state.cameraShake > 0.05) {
    const amount = state.cameraShake * 3.5;
    ctx.translate((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount);
  }
  const tiltMag = Math.abs(state.cameraTilt || 0);
  const overscan = tiltMag * 1.4;
  const boostZoom = state.boostKick > 0 ? 0.025 : 0;
  const totalScale = 1 + overscan + boostZoom;
  if (totalScale > 1.005 || state.cameraTilt) {
    ctx.translate(width / 2, height * 0.55);
    ctx.scale(totalScale, totalScale);
    if (state.cameraTilt) ctx.rotate(state.cameraTilt);
    ctx.translate(-width / 2, -height * 0.55);
  }

  drawRoad();

  if (state.hitFlash > 0) {
    ctx.globalAlpha = state.hitFlash * 1.6;
    ctx.fillStyle = "#ff315c";
    ctx.fillRect(0, 0, width, height);
  }

  drawVignette();
  drawSpeedRain();
  ctx.restore();
  drawStartLights();
  drawTachometer();
  updateUI();
}

function drawStartLights() {
  if (state.countdown <= 0) return;
  const cx = width / 2;
  const cy = height * 0.18;
  const totalLights = 5;
  const radius = Math.max(8, Math.min(16, width * 0.014));
  const spacing = radius * 3.4;
  const totalW = (totalLights - 1) * spacing;
  const t = 1 - state.countdown / START_COUNTDOWN; // 0 → 1 across countdown
  const lightsLit = Math.min(totalLights, Math.floor(t * (totalLights + 0.4)));
  // Background panel
  ctx.save();
  ctx.fillStyle = "rgba(5, 8, 15, 0.78)";
  const panelW = totalW + radius * 4;
  const panelH = radius * 3.4;
  roundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, radius * 0.6);
  ctx.fill();
  ctx.strokeStyle = "rgba(46, 233, 255, 0.35)";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  for (let i = 0; i < totalLights; i++) {
    const lx = cx - totalW / 2 + i * spacing;
    const lit = i < lightsLit;
    if (lit) {
      ctx.shadowColor = "#ff315c";
      ctx.shadowBlur = radius * 0.8;
      ctx.fillStyle = "#ff315c";
    } else {
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255, 49, 92, 0.12)";
    }
    ctx.beginPath();
    ctx.arc(lx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawVignette() {
  const gradient = ctx.createRadialGradient(width / 2, height * 0.56, height * 0.12, width / 2, height * 0.56, height * 0.82);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.56)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  if (state.speed > MAX_SPEED * 0.72) {
    const speedPercent = state.speed / MAX_SPEED;
    const alpha = Math.min(0.18, (speedPercent - 0.72) * 0.42);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "rgba(247, 251, 255, 0.72)";
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 10; i++) {
      const side = i % 2 ? -1 : 1;
      const edgeInset = width * (0.03 + (i % 5) * 0.018);
      const x = side > 0 ? width - edgeInset : edgeInset;
      const y = roadHorizon + ((state.position * 0.034 + i * 97) % (height - roadHorizon));
      const len = 58 + speedPercent * 78;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - side * len, y + len * 0.13);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawSpeedRain() {
  const speedPercent = state.speed / MAX_SPEED;
  const alpha = 0.035 + speedPercent * 0.14 + state.boostKick * 0.04;
  ctx.save();
  ctx.globalAlpha = Math.min(0.22, alpha);
  ctx.lineWidth = 0.8 + speedPercent * 0.9;
  for (let i = 0; i < 34; i++) {
    const x = (i * 127 + state.position * 0.011 + Math.sin(i * 12.989) * 32) % width;
    const y = roadHorizon * 0.55 + ((i * 173 + state.position * 0.03 + state.nightPulse * 72) % (height - roadHorizon * 0.52));
    const len = 10 + speedPercent * 30 + (i % 4) * 3;
    ctx.strokeStyle = i % 4 === 0 ? "rgba(46, 233, 255, 0.7)" : "rgba(247, 251, 255, 0.62)";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - len * 0.12, y + len);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTachometer() {
  if (!state.running && state.countdown <= 0 && !state.finished) return;
  const speedPercent = Math.min(BOOST_SPEED_MUL, state.speed / MAX_SPEED);
  const cx = Math.max(94, width * 0.1);
  const cy = height - 76;
  const radius = Math.max(52, Math.min(78, width * 0.072));
  const start = Math.PI * 0.78;
  const end = Math.PI * 2.22;
  const current = interpolate(start, end, Math.min(1, speedPercent));
  const isRedlining = speedPercent > 0.94;

  ctx.save();
  ctx.lineCap = "round";

  // Tick marks (cleaner spacing, fewer visual elements).
  const tickCount = 10;
  for (let i = 0; i <= tickCount; i++) {
    const t = i / tickCount;
    const angle = start + t * (end - start);
    const major = i % 2 === 0;
    const inner = radius - (major ? 6 : 4);
    const outer = radius + (major ? 6 : 3);
    ctx.lineWidth = major ? 2.4 : 1.0;
    ctx.strokeStyle = t < 0.55 ? "rgba(46, 233, 255, 0.55)"
                    : t < 0.85 ? "rgba(255, 209, 102, 0.7)"
                    : "rgba(255, 49, 92, 0.85)";
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.stroke();
  }

  // Background arc.
  ctx.lineWidth = 10;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, start, end);
  ctx.stroke();

  // Active arc with glow.
  const grad = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy);
  grad.addColorStop(0, "#2ee9ff");
  grad.addColorStop(0.55, "#ffd166");
  grad.addColorStop(1, "#ff315c");
  ctx.strokeStyle = grad;
  ctx.shadowColor = isRedlining ? "#ff315c" : "#2ee9ff";
  ctx.shadowBlur = isRedlining ? 18 : 12;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, start, current);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Inner disc with subtle gradient.
  const innerGrad = ctx.createRadialGradient(cx, cy - radius * 0.4, 0, cx, cy, radius * 0.7);
  innerGrad.addColorStop(0, "rgba(28, 38, 64, 0.95)");
  innerGrad.addColorStop(1, "rgba(5, 8, 15, 0.92)");
  ctx.fillStyle = innerGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.66, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(46, 233, 255, 0.28)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Big gear digit, dominant.
  ctx.fillStyle = isRedlining ? "#ff315c" : "#f7fbff";
  ctx.font = `900 ${Math.max(28, radius * 0.66)}px Inter, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = isRedlining ? "#ff315c" : "#2ee9ff";
  ctx.shadowBlur = isRedlining ? 14 : 8;
  ctx.fillText(getGear(), cx, cy - radius * 0.04);
  ctx.shadowBlur = 0;

  // Label
  ctx.fillStyle = "rgba(46, 233, 255, 0.62)";
  ctx.font = `900 ${Math.max(8, radius * 0.13)}px Inter, sans-serif`;
  ctx.letterSpacing = "0.2em";
  ctx.fillText("GEAR", cx, cy + radius * 0.36);
  ctx.restore();
}

function updateUI() {
  ui.lap.textContent = `${Math.min(state.lap, LAPS_TOTAL)}/${LAPS_TOTAL}`;
  ui.place.textContent = ordinal(state.place);
  ui.speed.textContent = Math.round((state.speed / MAX_SPEED) * SPEED_DISPLAY_MAX);
  ui.time.textContent = formatTime(state.raceTime);
  ui.gear.textContent = getGear();
  ui.boost.style.width = `${Math.round(state.boost * 100)}%`;
  if (ui.engineBar) ui.engineBar.style.width = `${Math.round(state.engineHealth * 100)}%`;
  if (ui.engineMeter) ui.engineMeter.classList.toggle("is-low", state.engineHealth < 0.4);
  if (ui.comboStack) {
    if (state.combo > 0) {
      ui.comboStack.hidden = false;
      ui.comboValue.textContent = `x${state.combo}`;
      ui.comboStack.classList.toggle("is-hot", state.combo >= 5);
    } else {
      ui.comboStack.hidden = true;
    }
  }
  updateCalloutUI();
  updateLeaderboardUI();
}

function updateCalloutUI() {
  if (state.countdown > 0) {
    const value = Math.ceil(state.countdown);
    ui.callout.textContent = value > 0 ? String(value) : "GO";
    ui.callout.style.transform = "translate(-50%, -50%) scale(1)";
    ui.callout.classList.add("is-visible");
    return;
  }

  if (state.calloutTimer > 0 && state.calloutText) {
    ui.callout.textContent = state.calloutText;
    ui.callout.style.transform = `translate(-50%, -50%) scale(${state.calloutScale})`;
    ui.callout.classList.add("is-visible");
  } else {
    ui.callout.textContent = "";
    ui.callout.style.transform = "translate(-50%, -50%) scale(1)";
    ui.callout.classList.remove("is-visible");
  }
}

function updateLeaderboardUI() {
  const now = state.raceTime;
  if (leaderboardLastUpdate !== 0 && now - leaderboardLastUpdate < 0.1 && state.running) return;
  leaderboardLastUpdate = now;
  const fullOrder = [{ name: "You", distance: state.distance, player: true }]
    .concat(cars.map((car) => ({ name: car.name, distance: car.rankDistance, player: false })))
    .sort((a, b) => b.distance - a.distance);
  const playerIndex = fullOrder.findIndex((entry) => entry.player);
  const order = playerIndex < 6
    ? fullOrder.slice(0, 6)
    : fullOrder.slice(0, 5).concat(fullOrder[playerIndex]);
  ui.leaderboard.innerHTML = order.map((entry, index) => {
    const klass = entry.player ? " class=\"is-player\"" : "";
    const place = entry.player ? playerIndex + 1 : index + 1;
    return `<li${klass}><span>${place}</span><span>${entry.name}</span></li>`;
  }).join("");
}

function triggerCallout(text, seconds = 0.6, scale = 1) {
  state.calloutText = text;
  state.calloutTimer = seconds;
  state.calloutScale = scale;
}

function computeGearIndex(speedPercent, gears) {
  if (speedPercent < 0.03) return 0;
  return Math.min(gears, Math.floor(speedPercent * gears) + 1);
}

function getGear() {
  const speedPercent = state.speed / MAX_SPEED;
  const gears = state.gears || 6;
  const idx = computeGearIndex(speedPercent, gears);
  return idx === 0 ? "N" : String(idx);
}

function ordinal(n) {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const whole = Math.floor(seconds % 60);
  const hundred = Math.floor((seconds % 1) * 100);
  return `${minutes}:${String(whole).padStart(2, "0")}.${String(hundred).padStart(2, "0")}`;
}

function setPreraceMode(on) {
  if (ui.gameFrame) ui.gameFrame.classList.toggle("is-prerace", !!on);
  ui.title.hidden = !on;
}

function startRace() {
  resetState();
  state.countdown = START_COUNTDOWN;
  state.speed = 0;
  leaderboardLastUpdate = 0;
  clearAllSkidMarks();
  audio.ensure();
  audio.setProfile(playerCarShape);
  audio.resetShift();
  setPreraceMode(false);
  ui.finish.hidden = true;
  ui.start.textContent = "Restart";
}

function showPrerace() {
  setPreraceMode(true);
  ui.finish.hidden = true;
  renderTitlePB();
  renderCarPicker();
}

// ---- Track picker ----
const TRACK_PICK_KEY = "apex-akina:track";
function readPickedTrack() {
  try {
    const raw = localStorage.getItem(TRACK_PICK_KEY);
    return raw && TRACKS[raw] ? raw : null;
  } catch (_) {
    return null;
  }
}
function writePickedTrack(id) {
  try { localStorage.setItem(TRACK_PICK_KEY, id); } catch (_) {}
}

function setTrack(id) {
  if (!TRACKS[id] || id === selectedTrackId) {
    if (TRACKS[id]) renderTrackPicker();
    return;
  }
  buildTrack(id);
  writePickedTrack(id);
  // Rebuild cars on the new track length so progress fractions still spread the grid correctly.
  resetState();
  leaderboardLastUpdate = 0;
  clearAllSkidMarks();
  renderTrackPicker();
}

function renderTrackPicker() {
  const wrap = document.getElementById("track-picker");
  if (!wrap) return;
  const trackIds = Object.keys(TRACKS);
  if (wrap.children.length !== trackIds.length) {
    wrap.innerHTML = "";
    for (const id of trackIds) {
      const t = TRACKS[id];
      const palette = { ...DEFAULT_PALETTE, ...(t.palette || {}) };
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "track-card";
      btn.setAttribute("role", "radio");
      btn.dataset.track = id;
      btn.innerHTML = `
        <span class="track-card__name">${t.name}</span>
        <p class="track-card__desc">${t.description}</p>
        <div class="track-card__swatch" aria-hidden="true">
          <span style="background:${palette.skyTop}"></span>
          <span style="background:${palette.skyMid}"></span>
          <span style="background:${palette.skyLow}"></span>
          <span style="background:${palette.rumbleA}"></span>
        </div>`;
      btn.addEventListener("click", () => setTrack(id));
      wrap.appendChild(btn);
    }
  }
  for (const card of wrap.querySelectorAll(".track-card")) {
    card.setAttribute("aria-checked", card.dataset.track === selectedTrackId ? "true" : "false");
  }
}

// ---- Car picker ----
function readPickedCar() {
  try {
    const raw = localStorage.getItem(PLAYER_PICK_KEY);
    return raw && SHAPE_STATS[raw] ? raw : null;
  } catch (_) {
    return null;
  }
}
function writePickedCar(shape) {
  try { localStorage.setItem(PLAYER_PICK_KEY, shape); } catch (_) {}
}

function setPlayerCarShape(shape) {
  if (!SHAPE_STATS[shape]) return;
  selectedRoster = { ...ROSTER[0], shape };
  playerCarShape = shape;
  if (state) {
    state.playerStats = SHAPE_STATS[shape];
  }
  writePickedCar(shape);
  renderCarPicker();
}

function drawCarPreview(targetCanvas, body, stripe, shape) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = targetCanvas.clientWidth || 200;
  const cssH = targetCanvas.clientHeight || 110;
  if (targetCanvas.width !== cssW * dpr) targetCanvas.width = cssW * dpr;
  if (targetCanvas.height !== cssH * dpr) targetCanvas.height = cssH * dpr;

  const targetCtx = targetCanvas.getContext("2d");
  targetCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const saved = { ctx, width, height, roadHorizon };
  ctx = targetCtx;
  width = cssW;
  height = cssH;
  roadHorizon = -200;
  try {
    ctx.clearRect(0, 0, cssW, cssH);
    const size = Math.min(cssW, cssH) * 1.45;
    drawCarSprite(cssW / 2, cssH * 0.62, size, body, stripe, false, shape);
  } finally {
    ctx = saved.ctx;
    width = saved.width;
    height = saved.height;
    roadHorizon = saved.roadHorizon;
  }
}

function exemplarLiveryFor(shape) {
  return ROSTER.find((r) => r.shape === shape && r.name !== "You")
    || { body: "#f7fbff", stripe: "#ff315c" };
}

function renderCarPicker() {
  const wrap = document.getElementById("car-picker");
  if (!wrap) return;
  const shapes = Object.keys(SHAPE_STATS);
  if (wrap.children.length !== shapes.length) {
    wrap.innerHTML = "";
    for (const shape of shapes) {
      const stats = SHAPE_STATS[shape];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "car-card";
      btn.setAttribute("role", "radio");
      btn.dataset.shape = shape;
      btn.innerHTML = `
        <canvas class="car-card__preview" aria-hidden="true"></canvas>
        <div class="car-card__title">
          <span class="car-card__name">${stats.label}</span>
          <span class="car-card__shape">${shape}</span>
        </div>
        <p class="car-card__desc">${stats.description}</p>
        <div class="car-card__bars">
          <span>SPD</span><span class="stat-bar"><span style="width:${Math.round(stats.top * 92)}%"></span></span>
          <span>ACC</span><span class="stat-bar"><span style="width:${Math.round(stats.accel * 92)}%"></span></span>
          <span>HND</span><span class="stat-bar"><span style="width:${Math.round(stats.handling * 78)}%"></span></span>
          <span>GRP</span><span class="stat-bar"><span style="width:${Math.round(stats.grip * 80)}%"></span></span>
        </div>`;
      btn.addEventListener("click", () => setPlayerCarShape(shape));
      wrap.appendChild(btn);
    }
  }
  for (const card of wrap.querySelectorAll(".car-card")) {
    const shape = card.dataset.shape;
    const isSelected = shape === playerCarShape;
    card.setAttribute("aria-checked", isSelected ? "true" : "false");
    const livery = isSelected
      ? { body: ROSTER[0].body, stripe: ROSTER[0].stripe }
      : exemplarLiveryFor(shape);
    const preview = card.querySelector("canvas");
    if (preview) drawCarPreview(preview, livery.body, livery.stripe, shape);
  }
}

function renderTitlePB() {
  if (!ui.titleCardPb) return;
  if (allTimeBestLap == null) {
    ui.titleCardPb.textContent = "";
  } else {
    ui.titleCardPb.textContent = `Personal best lap ${formatTime(allTimeBestLap)}`;
  }
}

// Fixed timestep — physics is sub-stepped at FIXED_DT regardless of render rate.
const FIXED_DT = 1 / 60;
const MAX_FIXED_STEPS = 5;
let physicsAccumulator = 0;

function loop(now) {
  const realDt = Math.min(0.25, (now - lastTime) / 1000);
  lastTime = now;
  physicsAccumulator += realDt;
  let steps = 0;
  while (physicsAccumulator >= FIXED_DT && steps < MAX_FIXED_STEPS) {
    // Slow-mo decays in real frame-time. While active, in-game advances at 35%.
    if (state.slowmoT > 0) state.slowmoT = Math.max(0, state.slowmoT - FIXED_DT);
    const scale = state.slowmoT > 0 ? 0.35 : 1;
    update(FIXED_DT * scale);
    physicsAccumulator -= FIXED_DT;
    steps++;
  }
  if (steps >= MAX_FIXED_STEPS) physicsAccumulator = 0;
  render();
  audio.update(state, MAX_SPEED);
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(event.code)) {
    event.preventDefault();
  }
  KEY.add(event.code);
  if (!state.running && !state.finished && state.countdown <= 0 && (event.code === "Enter" || event.code === "Space")) startRace();
});

window.addEventListener("keyup", (event) => {
  KEY.delete(event.code);
});

ui.start.addEventListener("click", startRace);
ui.restart.addEventListener("click", () => {
  ui.finish.hidden = true;
  showPrerace();
});
if (ui.startPrerace) ui.startPrerace.addEventListener("click", startRace);
window.addEventListener("resize", resizeCanvas);

const MUTE_PREF_KEY = "apex-akina:muted";
function readMutePref() {
  try { return localStorage.getItem(MUTE_PREF_KEY) === "1"; } catch (_) { return false; }
}
function writeMutePref(value) {
  try { localStorage.setItem(MUTE_PREF_KEY, value ? "1" : "0"); } catch (_) {}
}
const initialMuted = readMutePref();
audio.setMuted(initialMuted);
if (ui.muteToggle) {
  ui.muteToggle.setAttribute("aria-pressed", initialMuted ? "true" : "false");
  ui.muteToggle.querySelector("span").textContent = initialMuted ? "✕" : "♪";
  ui.muteToggle.addEventListener("click", () => {
    audio.ensure();
    const next = !audio.isMuted();
    audio.setMuted(next);
    writeMutePref(next);
    ui.muteToggle.setAttribute("aria-pressed", next ? "true" : "false");
    ui.muteToggle.querySelector("span").textContent = next ? "✕" : "♪";
  });
}

const TOUCH_PREF_KEY = "apex-akina:touch-ui";
function readTouchPreference() {
  try { return localStorage.getItem(TOUCH_PREF_KEY); } catch (_) { return null; }
}
function writeTouchPreference(value) {
  try { localStorage.setItem(TOUCH_PREF_KEY, value); } catch (_) {}
}
function applyTouchVisibility(show) {
  ui.touchControls.hidden = !show;
  document.documentElement.classList.toggle("has-touch", show);
  if (ui.touchToggle) ui.touchToggle.setAttribute("aria-pressed", show ? "true" : "false");
}

function setupTouchControls() {
  const supportsTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
  const wrap = ui.touchControls;
  if (!wrap) return;
  const stored = readTouchPreference();
  const initialShow = stored == null ? supportsTouch : stored === "1";
  applyTouchVisibility(initialShow);

  if (ui.touchToggle) {
    ui.touchToggle.addEventListener("click", () => {
      const next = ui.touchControls.hidden;
      applyTouchVisibility(next);
      writeTouchPreference(next ? "1" : "0");
    });
  }

  for (const btn of wrap.querySelectorAll(".touch-btn")) {
    const code = btn.dataset.key;
    const press = (event) => {
      if (event.cancelable) event.preventDefault();
      KEY.add(code);
      btn.classList.add("is-active");
      if (!state.running && !state.finished && state.countdown <= 0 && (code === "Space" || code === "ArrowUp")) {
        startRace();
      }
    };
    const release = (event) => {
      if (event && event.cancelable) event.preventDefault();
      KEY.delete(code);
      btn.classList.remove("is-active");
    };
    btn.addEventListener("touchstart", press, { passive: false });
    btn.addEventListener("touchend", release, { passive: false });
    btn.addEventListener("touchcancel", release, { passive: false });
    btn.addEventListener("pointerdown", press);
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointercancel", release);
    btn.addEventListener("pointerleave", (event) => {
      if (btn.classList.contains("is-active")) release(event);
    });
    btn.addEventListener("contextmenu", (event) => event.preventDefault());
  }
}

const savedTrack = readPickedTrack();
buildTrack(savedTrack || "akina");
const savedShape = readPickedCar();
if (savedShape) {
  selectedRoster = { ...ROSTER[0], shape: savedShape };
  playerCarShape = savedShape;
}
resetState();
resizeCanvas();
renderTitlePB();
renderTrackPicker();
renderCarPicker();
setupTouchControls();
setPreraceMode(true);
requestAnimationFrame(loop);
