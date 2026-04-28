// Audio module for the 3D engine — ported from the canvas game's synth approach.
// Engine: dual oscillator + lowpass + tremolo LFO, frequency tracks speed/RPM.
// Tire: filtered noise with skrrrt LFO modulation.
// Music: arp + bass loop scheduled on the AudioContext timeline.

let ctx = null;
let master = null;
let sfxBus = null;
let osc1, osc2, engineGain, engineLowpass;
let pulseLfo, pulseLfoGain;
let tireNoise, tireGain, tireBandpass;
let windNoise, windGain, windBandpass;
let musicGain, musicScheduler, musicBeatTime, musicBeatIdx;
let muted = false;
let masterVolume = 0.4;
let musicVolume = 0.6;
let sfxVolume = 1.0;

const PROFILE = {
  type1: "sawtooth", type2: "square",       // square gives more bite vs triangle
  idleHz: 56, redlineHz: 360,                // deeper idle, taller redline
  detune2: 1300, gain2: 0.42,                // beefier secondary osc
  lpfBase: 320, lpfTop: 2600,                // wider sweep
  pulseIdle: 6, pulseTop: 26, pulseDepth: 0.50,
  body: 0.18
};

// Default music profile (replaced when a track is selected).
let MUSIC_TEMPO = 96;
let MUSIC_BEAT_SEC = 60 / MUSIC_TEMPO / 2;
let ARP = [146.83, 174.61, 220, 261.63, 220, 261.63, 329.63, 220,
           146.83, 174.61, 220, 261.63, 174.61, 220, 261.63, 329.63];
let BASS = [73.42, 0, 87.31, 0, 73.42, 0, 87.31, 0];

export function setMusicProfile(profile) {
  if (!profile) return;
  if (profile.tempo) {
    MUSIC_TEMPO = profile.tempo;
    MUSIC_BEAT_SEC = 60 / MUSIC_TEMPO / 2;
  }
  if (profile.arp && profile.arp.length) ARP = profile.arp;
  if (profile.bass && profile.bass.length) BASS = profile.bass;
  // Reset the scheduler so the new profile takes effect on the next beat.
  if (ctx) {
    musicBeatTime = ctx.currentTime + 0.1;
    musicBeatIdx = 0;
  }
}

export function ensureAudio() {
  if (ctx) {
    if (ctx.state === "suspended") ctx.resume();
    return;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  try {
    ctx = new Ctx();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : masterVolume;
    master.connect(ctx.destination);
    // SFX bus — engine/tire/wind/shift/turbo/brake/countdown all route here.
    sfxBus = ctx.createGain();
    sfxBus.gain.value = sfxVolume;
    sfxBus.connect(master);

    // Engine
    osc1 = ctx.createOscillator();
    osc1.type = PROFILE.type1;
    osc1.frequency.value = PROFILE.idleHz;
    osc1.detune.value = -8;
    osc2 = ctx.createOscillator();
    osc2.type = PROFILE.type2;
    osc2.frequency.value = PROFILE.idleHz;
    osc2.detune.value = PROFILE.detune2 + 8;
    const detune2Gain = ctx.createGain();
    detune2Gain.gain.value = PROFILE.gain2;

    engineLowpass = ctx.createBiquadFilter();
    engineLowpass.type = "lowpass";
    engineLowpass.frequency.value = PROFILE.lpfBase;
    engineLowpass.Q.value = 3;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;

    pulseLfo = ctx.createOscillator();
    pulseLfo.type = "sine";
    pulseLfo.frequency.value = PROFILE.pulseIdle;
    pulseLfoGain = ctx.createGain();
    pulseLfoGain.gain.value = 0;
    pulseLfo.connect(pulseLfoGain);
    pulseLfoGain.connect(engineGain.gain);

    osc1.connect(engineLowpass);
    osc2.connect(detune2Gain);
    detune2Gain.connect(engineLowpass);
    engineLowpass.connect(engineGain);
    engineGain.connect(sfxBus);
    osc1.start();
    osc2.start();
    pulseLfo.start();

    // Tire screech
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
    tireNoise = ctx.createBufferSource();
    tireNoise.buffer = buffer;
    tireNoise.loop = true;
    tireBandpass = ctx.createBiquadFilter();
    tireBandpass.type = "bandpass";
    tireBandpass.frequency.value = 1750;
    tireBandpass.Q.value = 11;
    tireGain = ctx.createGain();
    tireGain.gain.value = 0;
    tireNoise.connect(tireBandpass);
    tireBandpass.connect(tireGain);
    tireGain.connect(sfxBus);
    tireNoise.start();

    // Wind noise — separate buffer, low-pass swept by speed.
    const wbuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.0), ctx.sampleRate);
    const wdata = wbuf.getChannelData(0);
    for (let i = 0; i < wdata.length; i++) wdata[i] = (Math.random() * 2 - 1) * 0.5;
    windNoise = ctx.createBufferSource();
    windNoise.buffer = wbuf;
    windNoise.loop = true;
    windBandpass = ctx.createBiquadFilter();
    windBandpass.type = "lowpass";
    windBandpass.frequency.value = 280;
    windBandpass.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    windNoise.connect(windBandpass);
    windBandpass.connect(windGain);
    windGain.connect(sfxBus);
    windNoise.start();

    // Music bus
    musicGain = ctx.createGain();
    musicGain.gain.value = 0;
    musicGain.connect(master);
    startMusic();
  } catch (e) {
    ctx = null;
  }
}

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

function startMusic() {
  musicBeatTime = ctx.currentTime + 0.1;
  musicBeatIdx = 0;
  if (musicScheduler) clearInterval(musicScheduler);
  musicScheduler = setInterval(() => {
    if (!ctx) return;
    while (musicBeatTime < ctx.currentTime + 0.25) {
      playArpNote(ARP[musicBeatIdx % ARP.length], musicBeatTime, MUSIC_BEAT_SEC * 1.6);
      playBassNote(BASS[musicBeatIdx % BASS.length], musicBeatTime, MUSIC_BEAT_SEC * 2.2);
      musicBeatTime += MUSIC_BEAT_SEC;
      musicBeatIdx++;
    }
  }, 60);
}

export function updateAudio({ speed, maxSpeed, lateralSlip, throttle, brake, racing, gear, gearCount, rpm }) {
  if (!ctx) return;
  const sp = Math.max(0, Math.min(1, Math.abs(speed) / maxSpeed));
  const onThrottle = !!throttle;
  const onBrake = !!brake;
  const offThrottle = racing && !onThrottle && !onBrake;
  // Per-gear RPM "wraps": each gear has its own pitch range. RPM (0..1 inside
  // the current gear's window) drives the engine note within a gear's band.
  let gearRpmFrac;
  if (typeof rpm === "number") {
    gearRpmFrac = Math.max(0, Math.min(1, (rpm - 900) / 6900));
  } else {
    gearRpmFrac = sp;
  }
  const range = PROFILE.redlineHz - PROFILE.idleHz;
  const gearBoostBase = gear ? 0.78 + (gear / Math.max(1, gearCount || 6)) * 0.40 : 1.0;
  const freqMul = onThrottle ? 1.05 : onBrake ? 0.86 : offThrottle ? 0.92 : 1.0;
  const targetFreq = (PROFILE.idleHz + gearRpmFrac * range) * freqMul * gearBoostBase;
  osc1.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.022);
  osc2.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.022);

  const loadGain = onThrottle ? 1.0 : onBrake ? 0.34 : offThrottle ? 0.50 : 0.30;
  const baseGain = racing ? PROFILE.body * (0.30 + sp * 0.65) * loadGain : PROFILE.body * 0.14;
  engineGain.gain.setTargetAtTime(baseGain, ctx.currentTime, 0.025);

  const pulseHz = PROFILE.pulseIdle + gearRpmFrac * (PROFILE.pulseTop - PROFILE.pulseIdle);
  pulseLfo.frequency.setTargetAtTime(pulseHz * (onThrottle ? 1.0 : 0.78), ctx.currentTime, 0.05);
  pulseLfoGain.gain.setTargetAtTime(racing ? baseGain * PROFILE.pulseDepth : 0, ctx.currentTime, 0.05);

  // LPF sweep — opens further as RPM-in-gear climbs, gives each gear a
  // distinct "ratchet up" character on shift.
  const lpfTarget = (PROFILE.lpfBase + gearRpmFrac * (PROFILE.lpfTop - PROFILE.lpfBase)) *
    (onThrottle ? 1.0 : onBrake ? 0.42 : offThrottle ? 0.55 : 0.5);
  engineLowpass.frequency.setTargetAtTime(lpfTarget, ctx.currentTime, 0.06);

  // Tire screech with skrrrt pulse.
  const slipMag = Math.min(1, Math.abs(lateralSlip || 0));
  const skrrrt = 0.6 + 0.4 * Math.abs(Math.sin(ctx.currentTime * 28));
  const screechBase = racing && slipMag > 0.25 && sp > 0.3 ? Math.min(0.36, slipMag * 0.55) : 0;
  tireGain.gain.setTargetAtTime(screechBase * skrrrt, ctx.currentTime, 0.025);
  tireBandpass.frequency.setTargetAtTime(1500 + slipMag * 700, ctx.currentTime, 0.04);

  // Music level — quieter on the menu, fuller during the race.
  if (musicGain) {
    musicGain.gain.setTargetAtTime((racing ? 0.30 : 0.10) * musicVolume, ctx.currentTime, 0.4);
  }
}

export function setAudioMuted(value) {
  muted = !!value;
  if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : masterVolume, ctx.currentTime, 0.05);
}

export function isAudioMuted() {
  return muted;
}

export function setMasterVolume(vol) {
  masterVolume = Math.max(0, Math.min(1, vol));
  if (master && ctx && !muted) master.gain.setTargetAtTime(masterVolume, ctx.currentTime, 0.05);
}

export function setMusicVolume(vol) {
  musicVolume = Math.max(0, Math.min(1, vol));
  // updateAudio multiplies its target gain by musicVolume below.
}

export function setSfxVolume(vol) {
  sfxVolume = Math.max(0, Math.min(1, vol));
  if (sfxBus && ctx) sfxBus.gain.setTargetAtTime(sfxVolume, ctx.currentTime, 0.05);
}

// Update wind noise amplitude based on current speed fraction (0..1).
export function updateWind(speedFraction) {
  if (!ctx || !windGain) return;
  const sp = Math.max(0, Math.min(1, speedFraction));
  const target = sp * sp * 0.18;     // quadratic, peaks at ~0.18 gain
  windGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
  windBandpass.frequency.setTargetAtTime(220 + sp * 1500, ctx.currentTime, 0.08);
}

// One-shot countdown beep (T-1 / T-2 / T-3 lower pitch + GO higher chord).
export function playCountdownBeep(level = 0) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const freq = level === "go" ? 880 : 440;
  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (level === "go" ? 0.5 : 0.25));
  osc.connect(g);
  g.connect(sfxBus);
  osc.start(t);
  osc.stop(t + 0.6);
  if (level === "go") {
    // 5th + octave for the chord punch.
    for (const f of [1320, 1760]) {
      const o2 = ctx.createOscillator();
      o2.type = "triangle";
      o2.frequency.value = f;
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.exponentialRampToValueAtTime(0.10, t + 0.01);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o2.connect(g2);
      g2.connect(sfxBus);
      o2.start(t);
      o2.stop(t + 0.7);
    }
  }
}

// Turbo whoosh — sweeping bandpass on white noise. Used on boost activation.
export function playTurboWhoosh() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const len = 0.45;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 4;
  bp.frequency.setValueAtTime(800, t);
  bp.frequency.exponentialRampToValueAtTime(3200, t + len);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18, t + 0.06);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(bp);
  bp.connect(g);
  g.connect(sfxBus);
  src.start(t);
  src.stop(t + len + 0.05);
}

// Brake hiss — short high-frequency noise burst on hard brake application.
export function playBrakeHiss() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const len = 0.18;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.45;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 2400;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.10, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(hp);
  hp.connect(g);
  g.connect(sfxBus);
  src.start(t);
  src.stop(t + len + 0.05);
}

// Gear-shift "thunk" — a quick filtered noise burst plus, on downshift, a
// rev-match blip (short pitched tone above the engine note).
export function playShift(direction = 1) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const len = 0.10;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.6;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = direction > 0 ? 380 : 240;
  bp.Q.value = 5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(bp);
  bp.connect(g);
  g.connect(sfxBus);
  src.start(t);

  // Rev-match blip on downshift.
  if (direction < 0) {
    const blipOsc = ctx.createOscillator();
    blipOsc.type = "sawtooth";
    blipOsc.frequency.setValueAtTime(180, t);
    blipOsc.frequency.exponentialRampToValueAtTime(260, t + 0.06);
    blipOsc.frequency.exponentialRampToValueAtTime(150, t + 0.14);
    const blipLp = ctx.createBiquadFilter();
    blipLp.type = "lowpass";
    blipLp.frequency.value = 1200;
    blipLp.Q.value = 4;
    const blipG = ctx.createGain();
    blipG.gain.setValueAtTime(0.0001, t);
    blipG.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
    blipG.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    blipOsc.connect(blipLp);
    blipLp.connect(blipG);
    blipG.connect(sfxBus);
    blipOsc.start(t);
    blipOsc.stop(t + 0.20);
  }
}
