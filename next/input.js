// Keyboard + gamepad + touch input — read() returns a normalized snapshot.
//
// Touch model:
//   • Left side has an analog drag-pad. Putting a finger on the pad starts a
//     drag; horizontal offset / radius gives a steer value in [-1, 1].
//   • Right side has stacked tap buttons (throttle + brake), boost + drift
//     are smaller buttons clustered above.
//
// Gamepad: standard mapping. Left stick = steer, RT throttle, LT brake,
// A drift, B/RB boost.
//
// Keyboard: WASD or arrows + Space drift + Shift boost. Mixes with touch
// + gamepad.

const KEYS = new Set();
const DEAD = 0.12;

// Touch state.
const TOUCH = {
  steerAnalog: 0,    // -1..1, set by drag pad
  throttle: false,
  brake: false,
  drift: false,
  boost: false,
  enabled: false
};

window.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code)) e.preventDefault();
  KEYS.add(e.code);
});
window.addEventListener("keyup", (e) => { KEYS.delete(e.code); });

// Initialize touch listeners on the on-screen controls.
export function initTouchControls() {
  const isCoarse = window.matchMedia("(pointer: coarse)").matches;
  const steer = document.getElementById("touch-steer");
  const right = document.getElementById("touch-right");
  const extras = document.getElementById("touch-extras");
  if (!steer || !right || !extras) return;
  if (!isCoarse) {
    steer.hidden = true; right.hidden = true; extras.hidden = true;
    return;
  }
  steer.hidden = false; right.hidden = false; extras.hidden = false;
  TOUCH.enabled = true;

  // ---- Analog drag-pad steering ----
  const track = document.getElementById("steer-track");
  const knob = document.getElementById("steer-knob");
  let dragId = null;            // active touch identifier
  const RADIUS = 65 - 30;       // half of (track-knob) = (130-60)/2 = 35

  function updateKnob(clientX, clientY) {
    if (!track || !knob) return;
    const rect = track.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    // Clamp to circle (use just X for steer; Y is visual only).
    const r = RADIUS;
    const norm = Math.max(-r, Math.min(r, dx));
    knob.style.left = (rect.width / 2 - knob.offsetWidth / 2 + norm) + "px";
    // Vertical follow within ±r/2 for tactile feedback.
    const ny = Math.max(-r * 0.5, Math.min(r * 0.5, dy));
    knob.style.top = (rect.height / 2 - knob.offsetHeight / 2 + ny) + "px";
    TOUCH.steerAnalog = norm / r;
  }

  function resetKnob() {
    if (!track || !knob) return;
    knob.style.left = (track.offsetWidth / 2 - knob.offsetWidth / 2) + "px";
    knob.style.top = (track.offsetHeight / 2 - knob.offsetHeight / 2) + "px";
    TOUCH.steerAnalog = 0;
  }

  track?.addEventListener("touchstart", (e) => {
    e.preventDefault();
    track.classList.add("is-active");
    const t = e.changedTouches[0];
    dragId = t.identifier;
    updateKnob(t.clientX, t.clientY);
  }, { passive: false });
  track?.addEventListener("touchmove", (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === dragId) {
        updateKnob(t.clientX, t.clientY);
        break;
      }
    }
  }, { passive: false });
  const releaseSteer = (e) => {
    if (e) e.preventDefault();
    track?.classList.remove("is-active");
    dragId = null;
    resetKnob();
  };
  track?.addEventListener("touchend", releaseSteer, { passive: false });
  track?.addEventListener("touchcancel", releaseSteer, { passive: false });

  // Mouse fallback for desktop testing of the drag pad.
  let mouseSteer = false;
  track?.addEventListener("mousedown", (e) => {
    e.preventDefault();
    mouseSteer = true;
    track.classList.add("is-active");
    updateKnob(e.clientX, e.clientY);
  });
  window.addEventListener("mousemove", (e) => {
    if (!mouseSteer) return;
    updateKnob(e.clientX, e.clientY);
  });
  window.addEventListener("mouseup", () => {
    if (!mouseSteer) return;
    mouseSteer = false;
    track?.classList.remove("is-active");
    resetKnob();
  });

  resetKnob();

  // ---- Tap buttons (throttle, brake, boost, drift) ----
  const bind = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    const press = (e) => {
      e.preventDefault();
      TOUCH[key] = true;
      el.classList.add("is-pressed");
    };
    const release = (e) => {
      e.preventDefault();
      TOUCH[key] = false;
      el.classList.remove("is-pressed");
    };
    el.addEventListener("touchstart", press, { passive: false });
    el.addEventListener("touchend", release, { passive: false });
    el.addEventListener("touchcancel", release, { passive: false });
    el.addEventListener("mousedown", press);
    el.addEventListener("mouseup", release);
    el.addEventListener("mouseleave", release);
  };
  bind("touch-throttle", "throttle");
  bind("touch-brake", "brake");
  bind("touch-boost", "boost");
  bind("touch-drift", "drift");
}

let _activePad = null;
function readGamepad() {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return null;
  const pads = navigator.getGamepads();
  for (const pad of pads) {
    if (!pad) continue;
    _activePad = pad;
    const lx = Math.abs(pad.axes[0] ?? 0) > DEAD ? pad.axes[0] : 0;
    const rt = pad.buttons[7]?.value ?? 0;
    const lt = pad.buttons[6]?.value ?? 0;
    const a  = pad.buttons[0]?.pressed ?? false;
    const b  = pad.buttons[1]?.pressed ?? false;
    const rb = pad.buttons[5]?.pressed ?? false;
    return {
      steer: lx,
      throttle: rt > 0.18,
      brake: lt > 0.18,
      drift: a,
      boost: b || rb
    };
  }
  _activePad = null;
  return null;
}

export function vibrate(weak = 0.4, strong = 0.6, duration = 200) {
  const pad = _activePad;
  if (!pad || !pad.vibrationActuator) return;
  try {
    pad.vibrationActuator.playEffect("dual-rumble", {
      duration,
      strongMagnitude: Math.max(0, Math.min(1, strong)),
      weakMagnitude: Math.max(0, Math.min(1, weak))
    });
  } catch (_) {}
}

// Smooth keyboard steering: ramp from 0 → ±1 over RAMP_TIME seconds rather
// than snapping. Tracked here so the same module owns all input shaping.
let kbSteerVal = 0;
let kbSteerLastT = performance.now();
const KB_RAMP = 4.5;   // units per second toward target

function readKeyboardSteer() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - kbSteerLastT) / 1000);
  kbSteerLastT = now;
  const left = KEYS.has("ArrowLeft") || KEYS.has("KeyA");
  const right = KEYS.has("ArrowRight") || KEYS.has("KeyD");
  const target = (left ? -1 : 0) + (right ? 1 : 0);
  // Centering pull is faster than steer-out so release feels snappy.
  const rate = (target === 0) ? KB_RAMP * 1.6 : KB_RAMP;
  if (target > kbSteerVal) kbSteerVal = Math.min(target, kbSteerVal + rate * dt);
  else if (target < kbSteerVal) kbSteerVal = Math.max(target, kbSteerVal - rate * dt);
  return kbSteerVal;
}

export function createInput() {
  return {
    read() {
      const pad = readGamepad();
      const kbSteer = readKeyboardSteer();
      const touchSteer = TOUCH.steerAnalog;
      // Combine: prefer the strongest non-zero signal.
      const candidates = [pad?.steer || 0, kbSteer, touchSteer];
      let steer = 0;
      for (const c of candidates) if (Math.abs(c) > Math.abs(steer)) steer = c;
      return {
        steer: Math.max(-1, Math.min(1, steer)),
        throttle: (pad?.throttle) || KEYS.has("ArrowUp") || KEYS.has("KeyW") || TOUCH.throttle,
        brake: (pad?.brake) || KEYS.has("ArrowDown") || KEYS.has("KeyS") || TOUCH.brake,
        drift: (pad?.drift) || KEYS.has("Space") || TOUCH.drift,
        boost: (pad?.boost) || KEYS.has("ShiftLeft") || KEYS.has("ShiftRight") || TOUCH.boost
      };
    }
  };
}
