// Keyboard and pointer input.
//
// Held keys produce a movement vector; one-shot presses (enter a car,
// punch, pause, confirm) are queued as bit flags and taken once by the
// loop, so a press that lands between two frames is never lost and never
// counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;
export const ACTION_RADIO = 32;

// Key code -> what it does. A plain string is a held key; a ['once', flag]
// pair fires once per press (repeats ignored).
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  Enter: ['once', ACTION_CONFIRM],
  KeyP: ['once', ACTION_PAUSE], Escape: ['once', ACTION_PAUSE],
  KeyE: ['once', ACTION_ENTER],
  Space: ['once', ACTION_PUNCH], KeyF: ['once', ACTION_PUNCH],
  KeyM: ['once', ACTION_MUTE],
  KeyR: ['once', ACTION_RADIO],
};

export function createInput(target) {
  const held = { up: false, down: false, left: false, right: false, run: false };
  let queued = 0;

  window.addEventListener('keydown', (event) => {
    const binding = KEYMAP[event.code];
    if (!binding) return;
    if (Array.isArray(binding)) {
      if (!event.repeat) queued |= binding[1];
    } else {
      held[binding] = true;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    const binding = KEYMAP[event.code];
    if (binding && !Array.isArray(binding)) held[binding] = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of
  // everything on blur, so the player never walks off on their own.
  window.addEventListener('blur', () => {
    held.up = held.down = held.left = held.right = held.run = false;
  });
  // A click anywhere counts as confirm (start the game, try again).
  target.addEventListener('pointerdown', () => {
    queued |= ACTION_CONFIRM;
  });

  return {
    // Normalised x/y movement vector from the held keys, plus run state.
    move() {
      const x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      const y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      const len = Math.hypot(x, y) || 1;
      return { x: x / len, y: y / len, run: held.run, active: x !== 0 || y !== 0 };
    },
    // The one-shot presses since the last call, as ACTION_* flags.
    takeActions() {
      const taken = queued;
      queued = 0;
      return taken;
    },
  };
}
