// Keyboard + gamepad input — read() returns a normalized snapshot of held controls.
// Gamepad mapping (Xbox-style): left stick = steer, RT = throttle, LT = brake,
// A = drift, B/RB = boost. Falls back to keyboard if no pad connected.
const KEYS = new Set();
const DEAD = 0.12;

window.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code)) e.preventDefault();
  KEYS.add(e.code);
});
window.addEventListener("keyup", (e) => { KEYS.delete(e.code); });

// Read the first connected gamepad and return its derived control state, or null
// if no pad is present.
function readGamepad() {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return null;
  const pads = navigator.getGamepads();
  for (const pad of pads) {
    if (!pad) continue;
    // Standard mapping:
    //   axes[0] = left X (-1..1), axes[1] = left Y (-1..1)
    //   buttons[0]=A, [1]=B, [2]=X, [3]=Y, [4]=LB, [5]=RB, [6]=LT, [7]=RT
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
      if (pad) {
        // Combine pad with any held keys so they can mix (analog stick + arrow keys).
        const left = KEYS.has("ArrowLeft") || KEYS.has("KeyA");
        const right = KEYS.has("ArrowRight") || KEYS.has("KeyD");
        const kbSteer = (left ? -1 : 0) + (right ? 1 : 0);
        return {
          steer: Math.max(-1, Math.min(1, pad.steer + kbSteer)),
          throttle: pad.throttle || KEYS.has("ArrowUp") || KEYS.has("KeyW"),
          brake: pad.brake || KEYS.has("ArrowDown") || KEYS.has("KeyS"),
          drift: pad.drift || KEYS.has("Space"),
          boost: pad.boost || KEYS.has("ShiftLeft") || KEYS.has("ShiftRight")
        };
      }
      const left = KEYS.has("ArrowLeft") || KEYS.has("KeyA");
      const right = KEYS.has("ArrowRight") || KEYS.has("KeyD");
      return {
        steer: (left ? -1 : 0) + (right ? 1 : 0),
        throttle: KEYS.has("ArrowUp") || KEYS.has("KeyW"),
        brake: KEYS.has("ArrowDown") || KEYS.has("KeyS"),
        drift: KEYS.has("Space"),
        boost: KEYS.has("ShiftLeft") || KEYS.has("ShiftRight")
      };
    }
  };
}
