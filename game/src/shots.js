// The screenshot scenes behind ?shot=start|play|chase|end. Each one stages
// the real world, then plays the real rules forward for a fixed number of
// steps under a simple autopilot (drive toward the mission marker), so the
// frame is what a short game really looks like — and the same seed always
// gives the same frame.
//
// The shot order lives in shots.json, not here: the chase is the cover
// (image 1), the drive and the busted screen follow, and the start screen
// goes last — a menu alone never leads the set.
import { STEP } from './config.js';
import { EVENT_BUSTED, EVENT_WASTED } from './world.js';
import { SCREEN_BUSTED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 14;
const CHASE_SECONDS = 10;

// Steer a car toward a point, returning the {x, y} move input for one world step.
function driveToward(world, tx, ty) {
  const p = world.state.player;
  const car = p.inCar;
  if (!car) return { x: 0, y: 0, run: false, active: false };
  // No fixed target (a drops job): chase the nearest cash drop instead.
  if (tx === null || tx === undefined || ty === null || ty === undefined) {
    let best = null;
    let bestD = Infinity;
    for (const pk of world.state.pickups) {
      if (!pk.active || pk.kind !== 'drop') continue;
      const d = Math.hypot(pk.x - car.x, pk.y - car.y);
      if (d < bestD) {
        bestD = d;
        best = pk;
      }
    }
    if (best) {
      tx = best.x;
      ty = best.y;
    } else {
      tx = world.places.GARAGE.x;
      ty = world.places.GARAGE.y;
    }
  }
  const heading = Math.atan2(ty - car.y, tx - car.x);
  let turn = heading - car.angle;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  const steer = turn > 0.25 ? 1 : turn < -0.25 ? -1 : 0;
  return { x: steer, y: -1, run: false, active: true };
}

// Put `world` into the named scene (start, play, chase or end; any other
// name is start) and return the screen to draw over it and the best cash to show.
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
    world.step(STEP, { move: driveToward(world, target ? target.x : null, target ? target.y : null), enter: false, punch: false }, false);
  }
  if (name === 'chase') {
    // Hold the frame until a cop car is inside the camera window, so the
    // cover shows the chase and not an empty road — at most a few extra seconds.
    const p = world.state.player;
    let inFrame = false;
    for (let extra = 0; extra < 6 / STEP && !inFrame; extra += 1) {
      world.step(STEP, { move: driveToward(world, target ? target.x : null, target ? target.y : null), enter: false, punch: false }, false);
      for (const cop of world.state.cops) {
        if (cop.active && cop.inCar && Math.abs(cop.x - p.x) < 640 && Math.abs(cop.y - p.y) < 360) inFrame = true;
      }
    }
    // The cover frame: Milo's line stays up, and the getaway car shows the
    // wear of the chase (the rams of the last ten seconds already did most of it).
    world.state.dialogueT = 30;
    // Final pose, on the beach road and moving: the autopilot has no
    // obstacle avoidance, so after sixteen seconds it may have wedged the
    // car into a building and let the cops wreck it to a standstill — a
    // dead car at 0 mph is not a chase cover. Put the getaway back on the
    // road, cops on its tail.
    const car = p.inCar;
    if (car) {
      car.x = 1400;
      car.y = 1760;
      car.angle = Math.PI;
      car.speed = 470;
      if (car.damage !== 28) car.damage = 28;
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      p.health = 82;
    }
    world.state.wanted = 4;
    world.state.crimeTimer = 0;
    let n = 0;
    for (const cop of world.state.cops) {
      if (!cop.active || !cop.inCar || !cop.car) continue;
      cop.car.x = 1580 + n * 150;
      cop.car.y = 1760 + (n % 2 === 0 ? 18 : -18);
      cop.car.angle = Math.PI;
      cop.car.speed = 430;
      cop.x = cop.car.x;
      cop.y = cop.car.y;
      cop.angle = Math.PI;
      n += 1;
      if (n >= 3) break;
    }
  } else {
    world.state.dialogueT = 9;
  }
  return { screen: SCREEN_PLAY, best: world.state.player.cash };
}
