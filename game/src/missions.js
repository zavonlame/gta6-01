// missions.js — one job: the 10-job story for fixer Cassia Voss.
// Every job is stages of "go here, then do that". The tracker in main.js
// reads currentStage() and completes a stage when the player arrives,
// loses the heat, or clears the race gates.
import { PLACES } from './world.js';

export const FIXER = { name: 'Cassia Voss', role: 'Fixer', color: '#f7b733' };

export const MISSIONS = [
  {
    id: 1, title: 'FIRST WHEELS',
    brief: 'Cassia needs wheels. Borrow a car and bring it to the garage.',
    reward: 400, respect: 40,
    stages: [
      { text: 'Steal a car (walk up and press E)', kind: 'steal', x: 900, y: 900 },
      { text: 'Drive to Juno\'s Garage', kind: 'go', x: PLACES.garage.x, y: PLACES.garage.y },
    ],
  },
  {
    id: 2, title: 'THE PIER DROP',
    brief: 'A package waits at the Old Pier. Pick it up, then lose anyone watching.',
    reward: 650, respect: 60,
    stages: [
      { text: 'Reach the Old Pier drop point', kind: 'go', x: PLACES.pier.x, y: PLACES.pier.y },
      { text: 'Lose the heat — get wanted down to zero', kind: 'lose' },
    ],
  },
  {
    id: 3, title: 'HOTEL HEAT',
    brief: 'Hotel Miramar is crawling with Solmar PD. Slip in, grab the ledger, get out.',
    reward: 900, respect: 80,
    stages: [
      { text: 'Reach Hotel Miramar', kind: 'go', x: PLACES.hotel.x, y: PLACES.hotel.y },
      { text: 'Escape to Palm Plaza', kind: 'go', x: PLACES.plaza.x, y: PLACES.plaza.y },
    ],
  },
  {
    id: 4, title: 'PAYDAY RUN',
    brief: 'Payday cash moves through Dockside at dusk. Intercept the courier van.',
    reward: 1200, respect: 100,
    stages: [
      { text: 'Reach Dockside', kind: 'go', x: PLACES.docks.x, y: PLACES.docks.y },
      { text: 'Bring the cash to the Casino Sol', kind: 'go', x: PLACES.casino.x, y: PLACES.casino.y },
    ],
  },
  {
    id: 5, title: 'CREW CALL',
    brief: 'Time to meet the crew properly. Juno, Bram and Tess are waiting at the plaza.',
    reward: 800, respect: 90,
    stages: [
      { text: 'Meet the crew at Palm Plaza', kind: 'go', x: PLACES.plaza.x, y: PLACES.plaza.y },
      { text: 'Drive the crew to the garage', kind: 'go', x: PLACES.garage.x, y: PLACES.garage.y },
    ],
  },
  {
    id: 6, title: 'THE VAULT CUT',
    brief: 'The Harbour Vault. Tess cracks it, Bram holds the door, you drive. Go loud.',
    reward: 2000, respect: 150,
    stages: [
      { text: 'Reach the Harbour Vault', kind: 'go', x: PLACES.vault.x, y: PLACES.vault.y },
      { text: 'Escape the PD dragnet — lose all stars', kind: 'lose' },
    ],
  },
  {
    id: 7, title: 'SKYHOOK',
    brief: 'A helicopter lift from Skyhook Field. Get there before the air unit does.',
    reward: 1500, respect: 120,
    stages: [
      { text: 'Reach Skyhook Field', kind: 'go', x: PLACES.airfield.x, y: PLACES.airfield.y },
      { text: 'Shake the air unit — lose the heat', kind: 'lose' },
    ],
  },
  {
    id: 8, title: 'RACE THE SUN',
    brief: 'Sunset sprint: three gates from Sunset Start to the pier. Fastest crew wins the strip.',
    reward: 1800, respect: 140,
    stages: [
      { text: 'Gate 1/3 — race to the first gate', kind: 'race', x: 1350, y: 2700, gate: 1 },
      { text: 'Gate 2/3 — keep the pace', kind: 'race', x: 900, y: 1800, gate: 2 },
      { text: 'Gate 3/3 — finish at the Old Pier', kind: 'race', x: PLACES.pier.x, y: PLACES.pier.y, gate: 3 },
    ],
  },
  {
    id: 9, title: 'THE LONG NIGHT',
    brief: 'One long night of runs: plaza, docks, hotel. No mistakes, no witnesses.',
    reward: 2200, respect: 170,
    stages: [
      { text: 'Run one — Palm Plaza', kind: 'go', x: PLACES.plaza.x, y: PLACES.plaza.y },
      { text: 'Run two — Dockside', kind: 'go', x: PLACES.docks.x, y: PLACES.docks.y },
      { text: 'Run three — Hotel Miramar', kind: 'go', x: PLACES.hotel.x, y: PLACES.hotel.y },
    ],
  },
  {
    id: 10, title: 'THE BIG SCORE',
    brief: 'Everything leads here: Casino Sol, the vault, the crew, one clean getaway.',
    reward: 5000, respect: 300,
    stages: [
      { text: 'Reach Casino Sol', kind: 'go', x: PLACES.casino.x, y: PLACES.casino.y },
      { text: 'Hit the Harbour Vault', kind: 'go', x: PLACES.vault.x, y: PLACES.vault.y },
      { text: 'Lose the whole city — zero stars', kind: 'lose' },
    ],
  },
];

export function missionCount() {
  return MISSIONS.length;
}

export function missionAt(index) {
  return MISSIONS[Math.min(index, MISSIONS.length - 1)];
}

export function stageAt(mission, stageIndex) {
  return mission.stages[Math.min(stageIndex, mission.stages.length - 1)];
}

// NEXT objective line for the HUD tracker.
export function nextObjective(mission, stageIndex) {
  const s = stageAt(mission, stageIndex);
  return s ? s.text : 'Job done';
}

// Every job title in order, for the title screen and the dossier outline.
export function allTitles() {
  return MISSIONS.map((m) => m.id + '. ' + m.title);
}
