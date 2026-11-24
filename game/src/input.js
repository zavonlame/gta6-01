// input.js — one job: keyboard state with edge detection.
// WASD / arrows drive and walk, E enters and leaves cars, F fires,
// R cycles radio, G uses the garage, Q starts a street race, P pauses,
// M mutes, 1-3 pick a crew ability, Enter confirms menus.
export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  enter: ['KeyE'],
  fire: ['KeyF'],
  radio: ['KeyR'],
  garage: ['KeyG'],
  race: ['KeyQ'],
  pause: ['KeyP', 'Escape'],
  mute: ['KeyM'],
  save: ['KeyL'],
  crew1: ['Digit1'],
  crew2: ['Digit2'],
  crew3: ['Digit3'],
  confirm: ['Enter', 'Space'],
  newGame: ['KeyN'],
};

const held = new Set();
const tapped = new Set();
let attached = false;

export function bindInput() {
  if (attached) return;
  attached = true;
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!held.has(e.code)) tapped.add(e.code);
    held.add(e.code);
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());
}

export function down(action) {
  return KEYS[action].some((c) => held.has(c));
}

export function pressed(action) {
  return KEYS[action].some((c) => tapped.has(c));
}

export function endFrameInput() {
  tapped.clear();
}

// Steering helper: -1 left, +1 right, 0 none.
export function steerAxis() {
  return (down('right') ? 1 : 0) - (down('left') ? 1 : 0);
}

// Throttle helper: +1 forward, -1 brake/reverse, 0 coast.
export function throttleAxis() {
  return (down('up') ? 1 : 0) - (down('down') ? 1 : 0);
}
