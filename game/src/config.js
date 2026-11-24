// config.js — every tuning number, name and palette for SOLMAR HEAT.
// One job: hold the game's constants so no other file hard-codes them.
export const CFG = {
  title: 'SOLMAR HEAT',
  canvasW: 1280,
  canvasH: 720,
  worldW: 3600,
  worldH: 3600,
  roadGap: 450,
  roadW: 92,
  walkSpeed: 165,
  carAccel: 620,
  carTop: 430,
  carReverse: 170,
  carGrip: 2.6,
  wantedMax: 5,
  saveKey: 'solmar-heat-save-v1',
};

// Golden-hour palette. The whole game is painted from these swatches.
export const PAL = {
  skyTop: '#2e3a6e',
  skyMid: '#e2703a',
  skyLow: '#f7b733',
  sun: '#ffd98a',
  sea: '#2f6f8f',
  sand: '#e8c98a',
  grass: '#5d7a3a',
  road: '#3d3a44',
  roadLine: '#e8d27a',
  sidewalk: '#8d8578',
  roofA: '#b4552d',
  roofB: '#4a6b8a',
  roofC: '#7a4a68',
  wallA: '#e8dcc0',
  wallB: '#d9b48a',
  wallC: '#c98a6a',
  palm: '#3f7a34',
  hud: 'rgba(12,14,22,0.78)',
  hudEdge: '#f7b733',
  good: '#7ddc7d',
  bad: '#ff5a4e',
  star: '#ffd23e',
};

export const DISTRICTS = [
  { name: 'MARINA ROW', x: 300, y: 300, r: 620 },
  { name: 'OLD PIER', x: 300, y: 3200, r: 560 },
  { name: 'DOWNTOWN SOLMAR', x: 1800, y: 1800, r: 900 },
  { name: 'HOTEL STRIP', x: 3200, y: 900, r: 600 },
  { name: 'DOCKSIDE', x: 3200, y: 3200, r: 620 },
  { name: 'PALM COURTS', x: 1800, y: 300, r: 560 },
];

export const CARS = [
  { name: 'Vantara GT', top: 430, accel: 660, color: '#c22f2f' },
  { name: 'Solmar Cruiser', top: 380, accel: 560, color: '#2f6fb2' },
  { name: 'Dune Runner', top: 350, accel: 520, color: '#d9a03a' },
  { name: 'Harbor Taxi', top: 330, accel: 480, color: '#e8c832' },
  { name: 'Pier Van', top: 300, accel: 430, color: '#7a7d84' },
  { name: 'Night Comet', top: 460, accel: 700, color: '#23232e' },
];

export const STATIONS = [
  { freq: '98.1', name: 'SOLMAR FM', genre: 'Neon Tide', track: 'Sunset Over The Bay — Marisol Rey' },
  { freq: '101.4', name: 'PIER RADIO', genre: 'Coast Rock', track: 'Harbor Lights — The Breakers' },
  { freq: '104.7', name: 'NIGHT DRIVE', genre: 'Synth Cruise', track: 'Golden Hour Run — Vega Static' },
];

export const WEAPONS = [
  { name: 'FISTS', owned: true },
  { name: 'PISTOL', owned: true },
  { name: 'SMG', owned: true },
  { name: 'SHOTGUN', owned: false },
  { name: 'RIFLE', owned: false },
  { name: 'RPG', owned: false },
  { name: 'RAILGUN', owned: false, locked: true },
];

export const UPGRADES = [
  { name: 'Tuned Engine', cost: 1200, desc: '+top speed' },
  { name: 'Armour Plating', cost: 900, desc: '+condition' },
  { name: 'Nitro Kit', cost: 1500, desc: '+acceleration' },
];

export const RESPECT_RANKS = [
  { at: 0, name: 'NOBODY' },
  { at: 100, name: 'STREET HAND' },
  { at: 250, name: 'STREET CAPTAIN' },
  { at: 500, name: 'SOLMAR NAME' },
  { at: 900, name: 'CITY LEGEND' },
];

export const GAME_VERSION = 'r5-clean-room';

export const CONTROLS = [
  'WASD / arrows — walk and drive',
  'E — steal / enter / leave a car',
  'F — fire · R — radio · G — garage',
  'Q — street race · 1/2/3 — crew',
  'P — pause · M — mute',
];

export function respectRank(points) {
  let rank = RESPECT_RANKS[0];
  for (const r of RESPECT_RANKS) if (points >= r.at) rank = r;
  const next = RESPECT_RANKS.find((r) => r.at > points);
  return { rank, next };
}
