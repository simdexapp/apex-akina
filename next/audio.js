// Audio module for the 3D engine — ported from the canvas game's synth approach.
// Engine: dual oscillator + lowpass + tremolo LFO, frequency tracks speed/RPM.
// Tire: filtered noise with skrrrt LFO modulation.
// Music: arp + bass loop scheduled on the AudioContext timeline.

let ctx = null;
let master = null;
let sfxBus = null;
let osc1, osc2, osc3, osc3Gain, engineGain, engineLowpass;
let pulseLfo, pulseLfoGain;
let tireNoise, tireGain, tireBandpass;
let windNoise, windGain, windBandpass;
let musicGain, musicReverbIn, musicScheduler, musicBeatTime, musicBeatIdx;
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
  if (profile.drums) {
    if (profile.drums.kick)  DRUMS_KICK = profile.drums.kick;
    if (profile.drums.snare) DRUMS_SNARE = profile.drums.snare;
    if (profile.drums.hat)   DRUMS_HAT = profile.drums.hat;
  }
  if (profile.chords && profile.chords.length) CHORDS = profile.chords;
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

    // Engine — three-oscillator stack for richer harmonic content:
    //   osc1 = sawtooth fundamental (gravelly low)
    //   osc2 = square detuned above (mid bite)
    //   osc3 = sawtooth at 2× fundamental (top-end scream — only active high RPM)
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
    // Top-end scream — sawtooth at 2× fundamental, gain modulated by RPM.
    osc3 = ctx.createOscillator();
    osc3.type = "sawtooth";
    osc3.frequency.value = PROFILE.idleHz * 2;
    osc3.detune.value = 12;
    osc3Gain = ctx.createGain();
    osc3Gain.gain.value = 0;

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
    osc3.connect(osc3Gain);
    osc3Gain.connect(engineLowpass);
    engineLowpass.connect(engineGain);
    engineGain.connect(sfxBus);
    osc1.start();
    osc2.start();
    osc3.start();
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

    // Reverb-style send — feedback delay through a lowpass filter for a
    // dub-style ambient tail. Snare and chord-pad sends route here.
    musicReverbIn = ctx.createGain();
    musicReverbIn.gain.value = 0.35;
    const delay = ctx.createDelay(1.2);
    delay.delayTime.value = 0.32;
    const fb = ctx.createGain();
    fb.gain.value = 0.42;
    const lpf = ctx.createBiquadFilter();
    lpf.type = "lowpass";
    lpf.frequency.value = 2400;
    lpf.Q.value = 0.7;
    musicReverbIn.connect(delay);
    delay.connect(lpf);
    lpf.connect(fb);
    fb.connect(delay);    // feedback path
    lpf.connect(musicGain); // wet to mix
    startMusic();
  } catch (e) {
    ctx = null;
  }
}

let _arpPanIdx = 0;
function playArpNote(freq, time, duration) {
  if (!ctx || freq <= 0) return;
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = freq;
  // Add a subtle detuned 5th for sweetness.
  const osc2 = ctx.createOscillator();
  osc2.type = "sine";
  osc2.frequency.value = freq * 1.5;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2400;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(0.16, time + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  // Stereo panner — arpeggio alternates left / right for width.
  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (pan) {
    pan.pan.value = (_arpPanIdx++ % 2 === 0) ? -0.45 : 0.45;
  }
  osc.connect(lp);
  osc2.connect(lp);
  lp.connect(g);
  if (pan) {
    g.connect(pan);
    pan.connect(musicGain);
  } else {
    g.connect(musicGain);
  }
  osc.start(time);
  osc2.start(time);
  osc.stop(time + duration + 0.02);
  osc2.stop(time + duration + 0.02);
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

// Pad chord — long sustained sound with multiple notes for atmosphere.
// Spread across the stereo field via panner per note.
function playChordPad(freqs, time, duration) {
  if (!ctx || !freqs?.length) return;
  freqs.forEach((f, i) => {
    if (f <= 0) return;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.04, time + 0.05);
    g.gain.setTargetAtTime(0.04, time + 0.10, 0.30);
    g.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(lp);
    lp.connect(g);
    // Spread chord notes across stereo: lowest left, highest right.
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan && freqs.length > 1) {
      pan.pan.value = (i / (freqs.length - 1) - 0.5) * 0.8;
      g.connect(pan);
      pan.connect(musicGain);
      // Reverb send.
      const wet = ctx.createGain();
      wet.gain.value = 0.20;
      pan.connect(wet);
      if (musicReverbIn) wet.connect(musicReverbIn);
    } else {
      g.connect(musicGain);
      const wet = ctx.createGain();
      wet.gain.value = 0.20;
      g.connect(wet);
      if (musicReverbIn) wet.connect(musicReverbIn);
    }
    osc.start(time);
    osc.stop(time + duration + 0.05);
  });
}

// Kick drum — short low sine with pitch envelope, plus a 50Hz sub layer
// for chest-thump on better speakers.
function playKick(time) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(120, time);
  osc.frequency.exponentialRampToValueAtTime(40, time + 0.10);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(0.45, time + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
  osc.connect(g);
  g.connect(musicGain);
  osc.start(time);
  osc.stop(time + 0.20);
  // Sub layer — pure 50Hz sine, longer decay.
  const sub = ctx.createOscillator();
  sub.type = "sine";
  sub.frequency.value = 50;
  const subG = ctx.createGain();
  subG.gain.setValueAtTime(0.0001, time);
  subG.gain.exponentialRampToValueAtTime(0.32, time + 0.012);
  subG.gain.exponentialRampToValueAtTime(0.0001, time + 0.30);
  sub.connect(subG);
  subG.connect(musicGain);
  sub.start(time);
  sub.stop(time + 0.32);
}

// Snare — filtered noise burst with a reverb send for ambient tail.
function playSnare(time) {
  if (!ctx) return;
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1500;
  bp.Q.value = 1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(0.18, time + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.13);
  src.connect(bp);
  bp.connect(g);
  g.connect(musicGain);
  // Reverb send — 30% wet.
  const wet = ctx.createGain();
  wet.gain.value = 0.30;
  g.connect(wet);
  if (musicReverbIn) wet.connect(musicReverbIn);
  src.start(time);
  src.stop(time + 0.16);
}

// Hi-hat — short high-passed noise.
function playHat(time, accent = false) {
  if (!ctx) return;
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.4;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 7000;
  const g = ctx.createGain();
  const peak = accent ? 0.10 : 0.06;
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(peak, time + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
  src.connect(hp);
  hp.connect(g);
  g.connect(musicGain);
  src.start(time);
  src.stop(time + 0.06);
}

// Drum pattern: 16-step grid, 1 = hit, 0 = silent. Default: standard 4-on-floor.
let DRUMS_KICK   = [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,1,0];
let DRUMS_SNARE  = [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0];
let DRUMS_HAT    = [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1];
// Chord progression — array of arrays of note frequencies. One per "phrase",
// usually 4 phrases per loop. Default: i-VI-VII-i in A minor.
let CHORDS = [
  [110, 130.81, 164.81],     // Am
  [98, 130.81, 174.61],      // F
  [98, 123.47, 164.81],      // G  (approx)
  [110, 130.81, 164.81]      // Am
];

function startMusic() {
  musicBeatTime = ctx.currentTime + 0.1;
  musicBeatIdx = 0;
  if (musicScheduler) clearInterval(musicScheduler);
  musicScheduler = setInterval(() => {
    if (!ctx) return;
    while (musicBeatTime < ctx.currentTime + 0.25) {
      const i = musicBeatIdx;
      // Arp + bass on every step.
      playArpNote(ARP[i % ARP.length], musicBeatTime, MUSIC_BEAT_SEC * 1.6);
      playBassNote(BASS[i % BASS.length], musicBeatTime, MUSIC_BEAT_SEC * 2.2);
      // Drum grid (16-step). Trigger only if pattern[step] is 1.
      const step = i % 16;
      if (DRUMS_KICK[step])  playKick(musicBeatTime);
      if (DRUMS_SNARE[step]) playSnare(musicBeatTime);
      if (DRUMS_HAT[step])   playHat(musicBeatTime, step % 4 === 0);
      // Chord pad on phrase boundaries (every 16 beats = one bar of 8th notes
      // since beat = half a beat at user-perceived tempo).
      if (i % 32 === 0 && CHORDS.length) {
        const chord = CHORDS[(i / 32) % CHORDS.length | 0];
        playChordPad(chord, musicBeatTime, MUSIC_BEAT_SEC * 28);
      }
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
  // Top-end scream — kicks in above 60% RPM, peaks at redline. Gives high-RPM
  // engine a real "wail" that flat oscillator stacks can't.
  if (osc3) {
    osc3.frequency.setTargetAtTime(targetFreq * 2, ctx.currentTime, 0.022);
    const screamGain = Math.max(0, (gearRpmFrac - 0.55) / 0.45) * 0.32;
    if (osc3Gain) osc3Gain.gain.setTargetAtTime(racing && onThrottle ? screamGain : 0, ctx.currentTime, 0.04);
  }

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
