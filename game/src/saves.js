// saves.js — one job: save slots in localStorage.
// Three slots on the title screen plus an autosave after every job.
// A profile is money, respect, missions finished, current job and stage,
// garage upgrades owned and the player's last spot.
import { CFG } from './config.js';

export const SLOT_COUNT = 3;

export function slotKey(i) {
  return CFG.saveKey + '-slot-' + i;
}

export function listSlots() {
  const out = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    try {
      const raw = localStorage.getItem(slotKey(i));
      out.push(raw ? JSON.parse(raw) : null);
    } catch {
      out.push(null);
    }
  }
  return out;
}

export function saveSlot(i, profile) {
  try {
    const stamped = { ...profile, savedAt: new Date().toISOString() };
    localStorage.setItem(slotKey(i), JSON.stringify(stamped));
    return true;
  } catch {
    return false;
  }
}

export function loadSlot(i) {
  try {
    const raw = localStorage.getItem(slotKey(i));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function wipeSlot(i) {
  try {
    localStorage.removeItem(slotKey(i));
    return true;
  } catch {
    return false;
  }
}

export function autosave(profile) {
  try {
    localStorage.setItem(CFG.saveKey + '-auto', JSON.stringify({ ...profile, savedAt: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
}

export function loadAutosave() {
  try {
    const raw = localStorage.getItem(CFG.saveKey + '-auto');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function profileFromState(s) {
  return {
    money: s.money,
    respect: s.respect,
    missionIndex: s.missionIndex,
    stageIndex: s.stageIndex,
    upgrades: s.upgrades.slice(),
    px: Math.round(s.player.x),
    py: Math.round(s.player.y),
  };
}
