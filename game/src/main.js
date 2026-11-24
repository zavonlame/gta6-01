// main.js — one job: run the game.
// Boots the world, steps the loop, wires input to the player, the car,
// the police, the missions, the crew, the radio, the garage and the
// saves, and hands every frame to render.js. Shot mode (?shot=) stages
// a fixed scene instead of starting at the title screen.
import { CFG } from './config.js';
import { bindInput, down, pressed, endFrameInput, steerAxis, throttleAxis } from './input.js';
import { buildWorld, updateTraffic, buildingAt, nearestTrafficCar, onRoad, PLACES } from './world.js';
import { MISSIONS, missionAt, stageAt, FIXER } from './missions.js';
import { useAbility, tickCooldowns } from './crew.js';
import { Police } from './police.js';
import { Radio } from './radio.js';
import { Sound } from './sound.js';
import { listSlots, saveSlot, loadSlot, autosave, profileFromState } from './saves.js';
import { draw } from './render.js';
import { shotFromUrl, seedFromUrl, applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = CFG.canvasW;
canvas.height = CFG.canvasH;

const state = {
  mode: 'title',
  time: 0,
  paused: false,
  money: 0,
  respect: 0,
  standing: 'UNKNOWN',
  missionIndex: 0,
  stageIndex: 0,
  weapon: 0,
  upgrades: [],
  crewCooldown: {},
  boost: 0,
  ramPlate: 0,
  toast: '',
  toastT: 0,
  banner: '',
  bannerT: 0,
  dialogue: null,
  dialogueT: 0,
  particles: [],
  tracers: [],
  wrecks: [],
  race: null,
  slots: [],
  shot: null,
  shotReady: false,
  player: {
    x: 900, y: 900, angle: 0, speed: 0,
    inCar: false, car: null, hp: 100, armour: 0,
  },
  world: null,
  police: new Police(),
  radio: new Radio(),
  sound: new Sound(),
};

function say(name, role, color, text, secs) {
  state.dialogue = { name, role, color, text };
  state.dialogueT = secs || 7;
}

function toast(text, secs) {
  state.toast = text;
  state.toastT = secs || 4;
}

function banner(text, secs) {
  state.banner = text;
  state.bannerT = secs || 3;
}

function newGame() {
  state.mode = 'play';
  state.money = 0;
  state.respect = 0;
  state.missionIndex = 0;
  state.stageIndex = 0;
  state.player.x = 900;
  state.player.y = 900;
  state.player.inCar = false;
  state.player.car = null;
  state.player.hp = 100;
  state.player.armour = 0;
  state.police.clear();
  say(FIXER.name, FIXER.role, '#f7b733', 'First job, kid. Borrow a car — any car — and bring it to Juno\'s garage. Solmar rewards the bold.', 8);
  toast('JOB 1/10 · FIRST WHEELS');
}

function completeStage() {
  const mission = missionAt(state.missionIndex);
  state.stageIndex++;
  state.sound.sting();
  if (state.stageIndex >= mission.stages.length) {
    state.money += mission.reward;
    state.respect += mission.respect;
    banner('JOB COMPLETE: ' + mission.title + '  +$' + mission.reward);
    autosave(profileFromState(state));
    if (state.missionIndex < MISSIONS.length - 1) {
      state.missionIndex++;
      state.stageIndex = 0;
      const next = missionAt(state.missionIndex);
      say(FIXER.name, FIXER.role, '#f7b733', 'Clean work. Next job is ' + next.title + ': ' + next.brief, 8);
    } else {
      banner('SOLMAR HEAT COMPLETE — YOU OWN THIS CITY');
      say(FIXER.name, FIXER.role, '#f7b733', 'Ten jobs. Ten clean getaways. Solmar is yours now, kid.', 10);
    }
  } else {
    const s = stageAt(mission, state.stageIndex);
    toast('NEXT: ' + s.text);
  }
}

function tryEnterCar() {
  const p = state.player;
  if (p.inCar) {
    p.inCar = false;
    p.car = null;
    p.speed = 0;
    toast('On foot — stay sharp.');
    return;
  }
  const car = nearestTrafficCar(state.world, p.x, p.y, 130);
  if (!car) { toast('No car close enough.'); return; }
  state.world.traffic = state.world.traffic.filter((c) => c !== car);
  p.inCar = true;
  p.car = { name: car.model.name, model: car.model, color: car.color, condition: 82, top: car.model.top };
  p.angle = car.angle;
  p.speed = 0;
  state.police.addHeat(22);
  state.sound.siren();
  toast('Car taken — Solmar PD noticed. (' + p.car.name + ')');
  say(FIXER.name, FIXER.role, '#f7b733', 'Nice wheels. Now drive like you stole it — because you did.', 5);
}

function fireWeapon() {
  const p = state.player;
  const range = 420;
  const tx = p.x + Math.cos(p.angle) * range;
  const ty = p.y + Math.sin(p.angle) * range;
  state.tracers.push({ x0: p.x, y0: p.y, x1: tx, y1: ty, life: 0.12 });
  state.sound.shot();
  state.police.addHeat(8);
  for (const c of state.police.cruisers) {
    if (Math.hypot(c.x - tx, c.y - ty) < 160) {
      c.hp -= 34;
      if (c.hp <= 0) {
        state.wrecks.push({ x: c.x, y: c.y, angle: c.angle });
        state.police.cruisers = state.police.cruisers.filter((x) => x !== c);
        state.money += 150;
        toast('Cruiser down — burning wreck. +$150');
      }
    }
  }
}

function update(dt) {
  state.time += dt;
  const p = state.player;
  if (state.dialogueT > 0) { state.dialogueT -= dt; if (state.dialogueT <= 0) state.dialogue = null; }
  if (state.toastT > 0) { state.toastT -= dt; if (state.toastT <= 0) state.toast = ''; }
  if (state.bannerT > 0) { state.bannerT -= dt; if (state.bannerT <= 0) state.banner = ''; }
  updateTraffic(state.world, dt, p);
  state.police.update(dt, p, state.world);
  tickCooldowns(state, dt);
  for (const pt of state.particles) { pt.life -= dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.z = (pt.z || 0) + (pt.vz || 0) * dt; }
  state.particles = state.particles.filter((pt) => pt.life > 0);
  for (const t of state.tracers) t.life -= dt;
  state.tracers = state.tracers.filter((t) => t.life > 0);
  for (const w of state.wrecks) {
    if (Math.random() < dt * 6) {
      state.particles.push({ x: w.x, y: w.y, z: 26, vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20, vz: 42, life: 1.6, max: 1.6, size: 5 + Math.random() * 7, color: 'rgba(60,60,66,0.8)' });
    }
  }

  // Movement.
  const steer = steerAxis();
  const throttle = throttleAxis();
  if (p.inCar && p.car) {
    const top = p.car.top * (state.boost > 0 ? 1.25 : 1) * (1 + state.upgrades.length * 0.06);
    if (throttle > 0) p.speed = Math.min(top, p.speed + p.car.model.accel * dt);
    else if (throttle < 0) p.speed = Math.max(-CFG.carReverse, p.speed - 500 * dt);
    else p.speed *= Math.max(0, 1 - 0.7 * dt);
    p.angle += steer * (p.speed / top) * CFG.carGrip * dt * (p.speed >= 0 ? 1 : -1);
    const nx = p.x + Math.cos(p.angle) * p.speed * dt;
    const ny = p.y + Math.sin(p.angle) * p.speed * dt;
    if (!buildingAt(state.world, nx, ny, 12)) {
      p.x = Math.max(40, Math.min(CFG.worldW - 40, nx));
      p.y = Math.max(40, Math.min(CFG.worldH - 40, ny));
    } else {
      p.speed *= 0.4;
      p.car.condition = Math.max(0, p.car.condition - Math.abs(p.speed) * dt * 0.02);
      if (p.car.condition <= 0) {
        state.wrecks.push({ x: p.x, y: p.y, angle: p.angle });
        p.inCar = false; p.car = null; p.speed = 0;
        toast('Your car is wrecked — it burned out.');
      }
    }
    if (!onRoad(p.x, p.y)) p.speed *= Math.max(0, 1 - 0.4 * dt);
    state.sound.engine(Math.abs(p.speed) / top);
  } else {
    p.speed = 0;
    const mx = (down('right') ? 1 : 0) - (down('left') ? 1 : 0);
    const my = (down('down') ? 1 : 0) - (down('up') ? 1 : 0);
    if (mx || my) {
      const len = Math.hypot(mx, my);
      p.angle = Math.atan2(my / len, mx / len);
      const nx = p.x + (mx / len) * CFG.walkSpeed * dt;
      const ny = p.y + (my / len) * CFG.walkSpeed * dt;
      if (!buildingAt(state.world, nx, ny, 10)) {
        p.x = Math.max(40, Math.min(CFG.worldW - 40, nx));
        p.y = Math.max(40, Math.min(CFG.worldH - 40, ny));
      }
    }
    state.sound.engineOff();
  }

  // Roadblock smash with Bram's plate.
  for (const rb of state.police.roadblocks) {
    if (Math.hypot(rb.x - p.x, rb.y - p.y) < 70) {
      if (state.ramPlate > 0) {
        state.police.roadblocks = state.police.roadblocks.filter((x) => x !== rb);
        toast('BRAM: roadblock smashed through!');
      } else if (p.inCar) {
        p.speed *= 0.3;
        p.car.condition = Math.max(0, p.car.condition - 12);
        state.police.roadblocks = state.police.roadblocks.filter((x) => x !== rb);
        toast('Roadblock hit — car took damage.');
      }
    }
  }

  // Standing follows the district mood and respect.
  state.standing = state.respect >= 250 ? 'RESPECTED' : state.respect >= 100 ? 'KNOWN' : 'NEUTRAL';

  // Mission stages.
  const mission = missionAt(state.missionIndex);
  const stage = stageAt(mission, state.stageIndex);
  if (stage) {
    if (stage.kind === 'steal' && p.inCar) completeStage();
    else if ((stage.kind === 'go' || stage.kind === 'race') && stage.x !== undefined) {
      if (Math.hypot(stage.x - p.x, stage.y - p.y) < 130) {
        state.sound.pickup();
        completeStage();
      }
    } else if (stage.kind === 'lose' && state.police.wanted === 0) {
      completeStage();
    }
  }

  // Garage upgrades.
  if (pressed('garage') && p.inCar) {
    const g = PLACES.garage;
    if (Math.hypot(g.x - p.x, g.y - p.y) < 260) {
      const next = state.upgrades.length;
      if (next >= 3) { toast('Garage: this car is maxed out.'); }
      else {
        const price = [1200, 900, 1500][next];
        const names = ['Tuned Engine', 'Armour Plating', 'Nitro Kit'];
        if (state.money >= price) {
          state.money -= price;
          state.upgrades.push(names[next]);
          p.car.condition = 100;
          toast('Garage fitted: ' + names[next] + ' (-$' + price + '). Car restored to 100%.');
          state.sound.sting();
        } else toast('Garage: ' + names[next] + ' costs $' + price + ' — you have $' + state.money + '.');
      }
    } else toast('Garage is at Juno\'s — follow the beacon.');
  }

  // Street race starter.
  if (pressed('race')) {
    const s = PLACES.startLine;
    if (Math.hypot(s.x - p.x, s.y - p.y) < 300 && p.inCar) {
      state.missionIndex = 7;
      state.stageIndex = 0;
      state.race = { gates: 3, gate: 1, started: true };
      toast('STREET RACE — RACE THE SUN started! Gate 1/3.');
      say('Juno Park', 'DRIVER', '#7ddc7d', 'Three gates to the pier. Do not lift.', 5);
    }
  }

  // Actions.
  if (pressed('enter')) tryEnterCar();
  if (pressed('fire')) fireWeapon();
  if (pressed('radio')) { state.radio.next(); toast('Radio: ' + state.radio.shortLine()); state.sound.blip(880, 0.08, 'sine', 0.05); }
  if (pressed('mute')) { const m = state.sound.toggleMute(); toast(m ? 'Sound muted.' : 'Sound on.'); }
  if (pressed('save')) { saveSlot(0, profileFromState(state)); toast('Progress saved to slot 1.'); }
  if (pressed('crew1')) { const t = useAbility(state, 'juno'); if (t) toast(t); }
  if (pressed('crew2')) { const t = useAbility(state, 'bram'); if (t) toast(t); }
  if (pressed('crew3')) { const t = useAbility(state, 'tess'); if (t) toast(t); }
  if (pressed('pause')) state.paused = !state.paused;
}

function applyProfile(prof) {
  state.mode = 'play';
  state.money = prof.money || 0;
  state.respect = prof.respect || 0;
  state.missionIndex = prof.missionIndex || 0;
  state.stageIndex = prof.stageIndex || 0;
  state.upgrades = (prof.upgrades || []).slice();
  state.player.x = prof.px || 900;
  state.player.y = prof.py || 900;
  state.player.inCar = false;
  state.player.car = null;
  state.player.hp = 100;
  state.player.armour = 0;
  state.police.clear();
  const mission = missionAt(state.missionIndex);
  say(FIXER.name, FIXER.role, '#f7b733', 'Back in Solmar. Job ' + mission.id + ' — ' + mission.title + ' — is still open.', 7);
  toast('CONTINUED — JOB ' + mission.id + '/' + MISSIONS.length + ' · ' + mission.title);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - (frame.last || now)) / 1000);
  frame.last = now;
  if (state.mode === 'title') {
    if (pressed('confirm') || pressed('newGame')) newGame();
    if (pressed('crew1') || pressed('crew2') || pressed('crew3')) {
      const idx = pressed('crew1') ? 0 : pressed('crew2') ? 1 : 2;
      const prof = loadSlot(idx);
      if (prof) applyProfile(prof);
      else toast('Slot ' + (idx + 1) + ' is empty.');
    }
    draw(ctx, state);
    endFrameInput();
    return;
  }
  if (!state.paused && !state.shot) update(dt);
  if (state.shot) {
    // Staged shot: one frozen frame, no simulation drift.
    state.time += 0.001;
    draw(ctx, state);
  } else {
    draw(ctx, state);
  }
  endFrameInput();
}

function boot() {
  bindInput();
  state.world = buildWorld(seedFromUrl());
  state.slots = listSlots();
  window.__solmar = state; // live state for play-testing and screenshots
  const shot = shotFromUrl();
  if (shot) {
    applyShot(state, shot);
    draw(ctx, state);
    window.__shotReady = true;
    document.title = 'SOLMAR HEAT — shot ' + shot;
    return;
  }
  // Title screen offers continue when a slot exists.
  const status = document.getElementById('status');
  if (status) status.textContent = 'SOLMAR HEAT. Press Enter to play.';
  requestAnimationFrame(frame);
}

boot();
