// shots.js — one job: stage the four screenshots.
// ?shot=chase | foot | race | start (plus ?seed=) puts the game in a
// fixed, deterministic pose and renders one frame, so every screenshot
// is a real render of the game's own code. Chase is the cover: mission 6
// mid-escape, four stars, CONDOR-1 overhead, dispatch board, crew cards,
// dialogue, weapon slots, radio, minimap, speed and a burning wreck.
import { PLACES } from './world.js';
import { FIXER } from './missions.js';
import { CARS } from './config.js';

export function shotFromUrl() {
  const q = new URLSearchParams(window.location.search);
  return q.get('shot') || null;
}

// The four staged shots, in dossier order: chase is the cover.
export const SHOT_LIST = ['chase', 'foot', 'race', 'start'];

export function seedFromUrl() {
  const q = new URLSearchParams(window.location.search);
  const s = parseInt(q.get('seed') || '7', 10);
  return Number.isFinite(s) ? s : 7;
}

export function applyShot(state, name) {
  state.shot = name;
  const p = state.player;
  if (name === 'chase') {
    state.mode = 'play';
    state.missionIndex = 5;
    state.stageIndex = 1;
    state.money = 18450;
    state.respect = 320;
    state.standing = 'RESPECTED';
    p.x = 1800; p.y = 1800;
    p.angle = Math.PI / 4;
    p.speed = 51; // ~112 km/h on the HUD
    p.inCar = true;
    p.car = { name: 'Vantara GT', model: CARS[0], color: '#c22f2f', condition: 62, top: 430 };
    p.hp = 78; p.armour = 55;
    state.police.heat = 88;
    state.police.recalc();
    state.police.heli.active = true;
    state.police.heli.x = p.x + 60;
    state.police.heli.y = p.y - 260;
    state.police.cruisers.push(
      { x: p.x - 260, y: p.y - 180, angle: 0.6, speed: 300, hp: 100 },
      { x: p.x + 320, y: p.y + 120, angle: -2.4, speed: 310, hp: 100 },
      { x: p.x - 120, y: p.y + 300, angle: 1.8, speed: 290, hp: 100 },
    );
    state.police.roadblocks.push({ x: p.x + 420, y: p.y - 260 });
    state.wrecks.push({ x: p.x - 420, y: p.y + 180, angle: 0.9 });
    state.dialogue = {
      name: FIXER.name, role: FIXER.role, color: '#f7b733',
      text: 'Vault cut is live, kid. Tess cracked the door — now drive like the whole city is watching. Because it is.',
    };
    state.weapon = 2;
    state.toast = 'THE VAULT CUT — escape the dragnet';
    state.time = 4.2;
  } else if (name === 'foot') {
    state.mode = 'play';
    state.missionIndex = 1;
    state.stageIndex = 0;
    state.money = 1050;
    state.respect = 65;
    state.standing = 'NEUTRAL';
    p.x = 450; p.y = 3150;
    p.angle = -Math.PI / 2;
    p.speed = 0;
    p.inCar = false;
    p.car = null;
    p.hp = 100; p.armour = 25;
    state.police.heat = 22;
    state.police.recalc();
    state.police.cruisers.push({ x: p.x + 420, y: p.y - 260, angle: 2.6, speed: 200, hp: 100 });
    state.dialogue = {
      name: FIXER.name, role: FIXER.role, color: '#f7b733',
      text: 'Package is at the end of the pier. Walk in quiet, walk out with it. No sirens, no heroes.',
    };
    state.weapon = 1;
    state.toast = 'THE PIER DROP — on foot at the Old Pier';
    state.time = 2.0;
  } else if (name === 'race') {
    state.mode = 'play';
    state.missionIndex = 7;
    state.stageIndex = 0;
    state.money = 12300;
    state.respect = 210;
    state.standing = 'KNOWN';
    p.x = 900; p.y = 2700;
    p.angle = 0;
    p.speed = 58; // ~128 km/h
    p.inCar = true;
    p.car = { name: 'Night Comet', model: CARS[5], color: '#23232e', condition: 91, top: 460 };
    p.hp = 100; p.armour = 80;
    state.police.heat = 0;
    state.police.recalc();
    state.race = { gates: 3, gate: 1, started: true };
    state.dialogue = {
      name: 'Juno Park', role: 'DRIVER', color: '#7ddc7d',
      text: 'Three gates to the pier and the sun is dropping. Keep it pinned — I did not tune this Comet to lose.',
    };
    state.weapon = 0;
    state.toast = 'RACE THE SUN — gate 1 of 3';
    state.time = 6.5;
  } else if (name === 'start') {
    state.mode = 'title';
    state.slots = [
      { money: 18450, missionIndex: 5, respect: 320 },
      { money: 1050, missionIndex: 1, respect: 65 },
      null,
    ];
    state.time = 0;
  }
  state.shotReady = true;
}
