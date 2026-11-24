// SOLMAR HEAT — every number the game tunes by, in one place.
//
// The city is a fixed 3840 x 2560 map; the camera shows a 1280 x 720 slice
// of it, scaled to whatever window the player has. None of these values
// depends on screen size, and none of them is read from anywhere else.

export const VIEW = { width: 1280, height: 720 };

// The simulation advances in fixed 1/60 s ticks. The display loop runs as
// many ticks as a frame owes, so the world moves at the same speed on a
// 60 Hz screen and a 144 Hz one.
export const STEP = 1 / 60;

export const WORLD = {
  width: 3840,
  height: 2560,
  roadGap: 320, // distance between street centrelines
  roadWidth: 72,
  sidewalk: 14,
  beachY: 2300, // sand begins here; the sea further south
  seaY: 2440,
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 170,
  runSpeed: 265,
  health: 100,
  punchRange: 34,
  punchDamage: 34,
  punchCooldown: 0.45,
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 520,
  maxReverse: 160,
  // radians per second at full lock, scaled down at low speed
  turnRate: 2.6,
  grip: 3.2,
  trafficSpeed: 150,
  trafficCount: 14,
};

export const PED = { radius: 9, speed: 55, fleeSpeed: 120, count: 26 };

export const COP = {
  radius: 13,
  footSpeed: 205,
  // a clean driver can pull away: the patrol car tops out just below the player
  carSpeed: 500,
  // seconds a foot cop must hold the player before the bust lands
  arrestTime: 1.6,
  // health lost per second while a cop car rams the player's car
  ramDamage: 4,
  punchDamage: 12,
};

export const WANTED = {
  max: 5,
  // quiet seconds after the last crime before stars start to fall
  decayDelay: 6,
  // seconds per star lost while the player stays out of trouble
  decayStep: 4,
  bustRadius: 34,
};

// Payouts, in dollars. Stealing a car pays nothing — the car is the reward.
export const CASH = {
  stealCar: 0,
  mission1: 250,
  mission2: 500,
  mission3: 800,
  mission4: 1500,
  mission5: 900,
  mission6: 1200,
  mission7: 1500,
  mission8: 2500,
  drop: 150,
};

// Milo's eight jobs, in story order. Each has the brief the HUD shows, the
// line it shows when the job pays out, and the line Milo says when it starts.
export const MISSIONS = [
  {
    id: 0,
    name: 'WHEELS',
    brief: 'Milo needs wheels. Steal any parked car. Walk up to one and press E.',
    done: 'Car acquired. Milo is impressed.',
    dialogue: 'Solmar runs on wheels, kid. Go steal us a ride.',
  },
  {
    id: 1,
    name: 'THE PIER DROP',
    brief: 'A package waits at the pier, south end of the beach road. Pick it up, then take it to the garage in Old Town.',
    done: 'Package delivered. $500 in your pocket.',
    dialogue: 'Package at the pier. Grab it, bring it to my garage. No detours.',
  },
  {
    id: 2,
    name: 'HEAT',
    brief: 'The pickup was a setup — the Solmar PD is on you. Lose the heat and reach the safehouse in Marina.',
    done: 'You shook them. Milo owes you one.',
    dialogue: 'It was a setup! Lose the heat, then get to the Marina safehouse.',
  },
  {
    id: 3,
    name: 'PAYDAY RUN',
    brief: 'Three cash drops are waiting across the city. Grab them all in two minutes and bring them to Milo.',
    done: 'Payday! The crew eats tonight.',
    dialogue: 'Three drops, two minutes. The crew eats tonight — move!',
  },
  {
    id: 4,
    name: 'CREW CALL',
    brief: 'A crew makes the job. Find DANA the driver, RICO the muscle and LENA the hacker — all three, across the city.',
    done: 'The crew is yours. DANA, RICO and LENA ride with you now.',
    dialogue: 'A crew makes the job. Find DANA, RICO and LENA — all three.',
  },
  {
    id: 5,
    name: 'THE VAULT',
    brief: 'Vault cash, ninety seconds, PD everywhere. Get it to Milo\u2019s garage before the clock dies.',
    done: 'Vault cash delivered. $1,200 — clean.',
    dialogue: 'Vault cash, ninety seconds, PD everywhere. Drive like you mean it.',
  },
  {
    id: 6,
    name: 'AIR SUPPORT',
    brief: 'Four stars and CONDOR-1 overhead. Vanish from the PD, then reach the Marina safehouse.',
    done: 'You vanished under the chopper. Even the air unit lost you.',
    dialogue: 'Four stars and a chopper overhead. Vanish, then safehouse.',
  },
  {
    id: 7,
    name: 'THE BIG SCORE',
    brief: 'Four cash drops across the whole city, three minutes, then bring it all to Milo. This is the one we retire on.',
    done: 'THE BIG SCORE — $2,500. Solmar is yours.',
    dialogue: 'Four drops, one payday. This is the one we retire on.',
  },
];

// The crew, recruited in job 5 (CREW CALL). Every perk changes how the game
// actually plays — they are not flavour text.
export const CREW = [
  { name: 'DANA', role: 'DRIVER', perk: 'TOP SPEED +8%' },
  { name: 'RICO', role: 'MUSCLE', perk: 'PUNCH +16 DMG' },
  { name: 'LENA', role: 'HACKER', perk: 'HEAT FADES FAST' },
];

// Where each crew member waits to be recruited: street corners, always reachable.
export const CREW_SPOTS = [
  { x: 800, y: 480 },
  { x: 3360, y: 800 },
  { x: 1920, y: 1440 },
];

// The four drops of the final job, all on street intersections.
export const DROPS7 = [
  { x: 1120, y: 1760 },
  { x: 2880, y: 1120 },
  { x: 2080, y: 400 },
  { x: 3360, y: 2080 },
];

// Respect titles, by jobs finished: index 0 is a fresh player, 8 is the kingpin.
export const RESPECT_RANKS = ['STREET', 'STREET', 'HUSTLER', 'HUSTLER', 'MADE', 'MADE', 'HEAVYWEIGHT', 'HEAVYWEIGHT', 'KINGPIN'];

// One tracker line per stage of each job, shown under the wanted stars.
// Job 3's first stage is written live (drops left plus the clock), so its
// entry here is only a fallback the tracker never has to use.
export const MISSION_STAGES = [
  ['Steal any parked car — walk up to one and press E.'],
  ['Pick up the package at the pier, south end of the beach road.', 'Deliver the package to Milo\u2019s garage in Old Town.'],
  ['Lose the heat — reach the safehouse in Marina.'],
  ['Grab the drops across the city, then bring the cash to Milo.', 'Bring the cash to Milo\u2019s garage in Old Town.'],
  ['Find your crew: DANA · RICO · LENA — 3 to recruit.'],
  ['Deliver the vault cash to Milo\u2019s garage — 90 seconds, PD on your tail.'],
  ['Lose the 4-star heat — then reach the safehouse in Marina.'],
  ['Grab the drops across the city, then bring the cash to Milo.', 'Bring the cash to Milo\u2019s garage in Old Town.'],
];

// Solmar PD callsigns, one per cop slot in spawn order, so the dispatch
// panel always names the same unit when a given slot joins the chase.
export const DISPATCH_CALLSIGNS = [
  'TARPON 12', 'GULL 07', 'MARLIN 23', 'REEF 41',
  'HERON 55', 'PELICAN 68', 'OSPREY 71', 'MANATEE 84',
  'DOLPHIN 90', 'SHARK 03', 'STINGRAY 17', 'BARRACUDA 29',
];

// The player's only weapon: fists, thrown with Space or F, on a short cooldown.
export const WEAPON = { name: 'FISTS', key: 'SPACE / F' };

export const PALETTE = {
  backdrop: '#0d0f14',
  grass: '#3f6b3a',
  park: '#4c7a44',
  sand: '#c9b183',
  sea: '#1f6f8b',
  road: '#2b2f38',
  roadLine: '#d8c95a',
  sidewalk: '#565c66',
  building: '#7a6a58',
  building2: '#5d6b7a',
  building3: '#8a5f56',
  buildingRoof: '#3a3f4a',
  player: '#f2c94c',
  playerCar: '#e5534b',
  trafficCar: '#7fb3d5',
  trafficCar2: '#d5a06a',
  copCar: '#3f6fd8',
  cop: '#3f6fd8',
  ped: '#c9c2b4',
  ped2: '#9db38a',
  cash: '#37d67a',
  marker: '#ff5fa2',
  text: '#eef1f5',
  muted: '#aab2c0',
  panel: '#1c212b',
  star: '#ffd23f',
  health: '#37d67a',
  healthLow: '#e5534b',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// Where progress lives between visits (this browser only).
export const SAVE_KEY = 'solmar-heat.save.v1';
export const BEST_KEY = 'solmar-heat.best.v1';
