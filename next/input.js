// Keyboard input — read() returns a normalized snapshot of held controls.
const KEYS = new Set();

window.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code)) e.preventDefault();
  KEYS.add(e.code);
});
window.addEventListener("keyup", (e) => { KEYS.delete(e.code); });

export function createInput() {
  return {
    read() {
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
