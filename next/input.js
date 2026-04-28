// Keyboard + gamepad + touch input — read() returns a normalized snapshot.
// Gamepad mapping (Xbox-style): left stick = steer, RT = throttle, LT = brake,
// A = drift, B/RB = boost. Touch controls auto-show on coarse-pointer devices.

const KEYS = new Set();
const DEAD = 0.12;

// Touch state — set by the on-screen buttons in the HUD overlay.
const TOUCH = {
  steerL: false,
  steerR: false,
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

// Initialize touch listeners on the on-screen buttons. Auto-hide pads on
// fine-pointer devices (desktop with mouse). Re-hides if no touch event ever
// fires within 5 seconds of pageload (to be conservative on hybrid laptops).
export function initTouchControls() {
  const isCoarse = window.matchMedia("(pointer: coarse)").matches;
  const left = document.getElementById("touch-left");
  const right = document.getElementById("touch-right");
  if (!left || !right) return;
  if (!isCoarse) {
    left.hidden = true;
    right.hidden = true;
    return;
  }
  left.hidden = false;
  right.hidden = false;
  TOUCH.enabled = true;

  const bind = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    const press = (e) => { e.preventDefault(); TOUCH[key] = true; };
    const release = (e) => { e.preventDefault(); TOUCH[key] = false; };
    el.addEventListener("touchstart", press, { passive: false });
    el.addEventListener("touchend", release, { passive: false });
    el.addEventListener("touchcancel", release, { passive: false });
    // Mouse fallback for testing on desktop.
    el.addEventListener("mousedown", press);
    el.addEventListener("mouseup", release);
    el.addEventListener("mouseleave", release);
  };
  bind("touch-steer-l", "steerL");
  bind("touch-steer-r", "steerR");
  bind("touch-throttle", "throttle");
  bind("touch-brake", "brake");
  bind("touch-boost", "boost");
  bind("touch-drift", "drift");
}

function readGamepad() {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return null;
  const pads = navigator.getGamepads();
  for (const pad of pads) {
    if (!pad) continue;
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
  return null;
}

export function createInput() {
  return {
    read() {
      const pad = readGamepad();
      const left = KEYS.has("ArrowLeft") || KEYS.has("KeyA") || TOUCH.steerL;
      const right = KEYS.has("ArrowRight") || KEYS.has("KeyD") || TOUCH.steerR;
      const kbSteer = (left ? -1 : 0) + (right ? 1 : 0);
      if (pad) {
        return {
          steer: Math.max(-1, Math.min(1, pad.steer + kbSteer)),
          throttle: pad.throttle || KEYS.has("ArrowUp") || KEYS.has("KeyW") || TOUCH.throttle,
          brake: pad.brake || KEYS.has("ArrowDown") || KEYS.has("KeyS") || TOUCH.brake,
          drift: pad.drift || KEYS.has("Space") || TOUCH.drift,
          boost: pad.boost || KEYS.has("ShiftLeft") || KEYS.has("ShiftRight") || TOUCH.boost
        };
      }
      return {
        steer: kbSteer,
        throttle: KEYS.has("ArrowUp") || KEYS.has("KeyW") || TOUCH.throttle,
        brake: KEYS.has("ArrowDown") || KEYS.has("KeyS") || TOUCH.brake,
        drift: KEYS.has("Space") || TOUCH.drift,
        boost: KEYS.has("ShiftLeft") || KEYS.has("ShiftRight") || TOUCH.boost
      };
    }
  };
}
