// Boot and the single loop: input is read every frame, the world moves in
// fixed 1/60 s steps (several on a slow frame, none on a fast one), and the
// renderer paints what is there. The game has six screens: title, play,
// paused, busted, wasted and story complete. Progress (cash, missions,
// story) is written to localStorage whenever a mission pays out.
//
// ?seed=N fixes the city. ?shot=start|play|chase|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_CASH, EVENT_CRIME, EVENT_MISSION, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, ACTION_RADIO, createInput } from './input.js';
import {
  createRenderer,
  SCREEN_BUSTED,
  SCREEN_COMPLETE,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WASTED,
} from './render.js';
import { stageShot } from './shots.js';
import { createSound } from './sound.js';

// The longest frame the loop catches up on; a longer stall (a hidden tab)
// is dropped, not replayed.
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const sound = createSound();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best cash then lasts this visit only.
  }
}

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.serialize()));
  } catch {
    // Same as above: progress then lasts this visit only.
  }
}

// A screenshot scene: stage it, paint it twice, flag it ready.
function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, { station: 'SOLMAR FM 88.5 — SUNSET DRIVE', save: null });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // A saved game resumes where its owner left it: cash and missions kept.
  const save = readSave();
  if (save) world.loadSave(save);

  // Screen readers (and anyone watching the page's text) hear the screen
  // changes and each payout through the status line.
  function say(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    const existing = readSave();
    if (existing) world.loadSave(existing);
    accumulator = 0;
    screen = SCREEN_PLAY;
    say('Playing. Steal a car: walk up to one and press E.');
  }

  function endRun(nextScreen, message) {
    screen = nextScreen;
    if (world.state.player.cash > best) {
      best = world.state.player.cash;
      saveBest(best);
    }
    saveGame();
    say(message);
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      sound.unlock();
      const muted = sound.toggleMute();
      say(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_RADIO && screen === SCREEN_PLAY) {
      sound.unlock();
      const station = sound.nextStation();
      say(`Radio: ${station}.`);
    }
    if (actions & ACTION_CONFIRM) sound.unlock();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_BUSTED || screen === SCREEN_WASTED)) {
      startGame();
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_COMPLETE) {
      screen = SCREEN_PLAY;
      say('Free roam. Solmar is yours.');
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      say('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      say('Playing.');
    }
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { move: { x: 0, y: 0, run: false, active: false }, enter: false, punch: false }, true);
      return;
    }
    const move = input.move();
    const events = world.step(
      STEP,
      {
        move,
        enter: !!(actions & ACTION_ENTER),
        punch: !!(actions & ACTION_PUNCH),
      },
      false,
    );
    if (events & EVENT_BUSTED) {
      sound.busted();
      endRun(SCREEN_BUSTED, `Busted. Cash kept $${world.state.player.cash}.`);
    } else if (events & EVENT_WASTED) {
      sound.busted();
      endRun(SCREEN_WASTED, `Wasted. Cash kept $${world.state.player.cash}.`);
    } else if (events & EVENT_MISSION) {
      sound.mission();
      saveGame();
      say(world.state.storyComplete ? 'Story complete! Solmar is yours.' : `Job done. ${world.state.missionText}`);
      if (world.state.storyComplete) endRun(SCREEN_COMPLETE, 'Story complete! Solmar is yours.');
    } else if (events & EVENT_CASH) {
      sound.coin();
    } else if (events & EVENT_CRIME) {
      say(`Wanted level ${world.state.wanted}. Lose the heat!`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // One take of the one-shot presses per frame: handleActions reads them,
    // and the steps that follow in the same frame share the same flags.
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(actions);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const p = world.state.player;
    sound.frame(!p.onFoot && !!p.inCar, p.inCar ? Math.abs(p.inCar.speed) : 0, world.state.wanted, STEP);
    renderer.draw(world.state, screen, best, { station: sound.stationName(), save: readSave() });
  }

  // Leaving the tab pauses a running game rather than letting the police
  // close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      say('Paused.');
    }
  });

  say('Solmar Heat. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
