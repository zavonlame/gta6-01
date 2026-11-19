// The screenshot scenes behind ?shot=start|play|chase|end. Each one stages the real world
// and then plays the real rules forward for a fixed number of steps, steered by a simple
// autopilot (drive toward the mission marker, steer around buildings), so the frame is what
// a short game really looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { EVENT_BUSTED, EVENT_WASTED } from './world.js';
import { SCREEN_BUSTED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 14;
const CHASE_SECONDS = 10;

/** Steer a car toward a point: returns {x, y} move input for the world step. */
function driveToward(world, tx, ty) {
  const p = world.state.player;
  const car = p.inCar;
  if (!car) return { x: 0, y: 0, run: false, active: false };
  const want = Math.atan2(ty - car.y, tx - car.x);
  let da = want - car.angle;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  const steer = da > 0.25 ? 1 : da < -0.25 ? -1 : 0;
  return { x: steer, y: -1, run: false, active: true };
}

/**
 * Set `world` to the named scene (start, play, chase or end; any other name is start)
 * and return the screen to draw over it and the best cash to show.
 */
export function stageShot(name, world) {
  world.stage(name === 'play' || name === 'chase' || name === 'end' ? name : 'start');
  if (name !== 'play' && name !== 'chase' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, { move: { x: 0, y: 0, run: false, active: false }, enter: false, punch: false }, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'end') {
    // Let the cops close in until the bust lands, then hold the busted screen.
    let busted = false;
    for (let i = 0; i < 60 / STEP && !busted; i += 1) {
      const events = world.step(STEP, { move: { x: 0, y: 0, run: false, active: false }, enter: false, punch: false }, false);
      if (events & EVENT_BUSTED || events & EVENT_WASTED) busted = true;
    }
    return { screen: SCREEN_BUSTED, best: world.state.player.cash };
  }
  const seconds = name === 'chase' ? CHASE_SECONDS : PLAY_SECONDS;
  const target = world.state.missionTarget;
  for (let i = 0; i < seconds / STEP; i += 1) {
    world.step(STEP, { move: driveToward(world, target.x, target.y), enter: false, punch: false }, false);
  }
  return { screen: SCREEN_PLAY, best: world.state.player.cash };
}
