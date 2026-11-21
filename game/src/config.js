// SOLMAR HEAT — every tuning number and colour in one place.
// The city is a fixed 3840x2560 world; the camera shows a 1280x720 window of it,
// scaled to the browser window, so no rule below depends on the screen size.
export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const WORLD = {
  width: 3840,
  height: 2560,
  roadGap: 320, // distance between street centrelines
  roadWidth: 72,
  sidewalk: 14,
  beachY: 2300, // sand and sea below this line
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
  turnRate: 2.6, // radians per second at full steer, scaled by speed
  grip: 3.2,
  trafficSpeed: 150,
  trafficCount: 14,
};

export const PED = { radius: 9, speed: 55, fleeSpeed: 120, count: 26 };

export const COP = {
  radius: 13,
  footSpeed: 205,
  carSpeed: 500, // a touch slower than the player's car: a good driver can pull away
  arrestTime: 1.6, // seconds a cop must hold the player on foot to bust them
  ramDamage: 4, // health lost per second while a cop car rams the player's car
  punchDamage: 12,
};

export const WANTED = {
  max: 5,
  decayDelay: 6, // seconds after the last crime before stars start to fall
  decayStep: 4, // seconds per star lost while unseen
  bustRadius: 34,
};

/** Cash drops and mission rewards, in dollars. */
export const CASH = { stealCar: 0, mission1: 250, mission2: 500, mission3: 800, mission4: 1500, drop: 150 };

export const MISSIONS = [
  {
    id: 0,
    name: 'WHEELS',
    brief: 'Milo needs wheels. Steal any parked car. Walk up to one and press E.',
    done: 'Car acquired. Milo is impressed.',
  },
  {
    id: 1,
    name: 'THE PIER DROP',
    brief: 'A package waits at the pier, south end of the beach road. Pick it up, then take it to the garage in Old Town.',
    done: 'Package delivered. $500 in your pocket.',
  },
  {
    id: 2,
    name: 'HEAT',
    brief: 'The pickup was a setup — the Solmar PD is on you. Lose the heat and reach the safehouse in Marina.',
    done: 'You shook them. Milo owes you one.',
  },
  {
    id: 3,
    name: 'PAYDAY RUN',
    brief: 'Three cash drops are waiting across the city. Grab them all in two minutes and bring them to Milo.',
    done: 'Payday! The crew eats tonight.',
  },
];

/**
 * One stage line per mission stage, shown in the mission tracker under the wanted
 * stars. Mission 3's first stage is built live (drops left and time on the clock),
 * so its slot here is a fallback only.
 */
export const MISSION_STAGES = [
  ['Steal any parked car — walk up to one and press E.'],
  ['Pick up the package at the pier, south end of the beach road.', 'Deliver the package to Milo\u2019s garage in Old Town.'],
  ['Lose the heat — reach the safehouse in Marina.'],
  ['Grab the drops across the city, then bring the cash to Milo.', 'Bring the cash to Milo\u2019s garage in Old Town.'],
];

/**
 * Solmar PD unit callsigns, one per cop slot in the order the world spawns them,
 * so the dispatch panel names the same unit every time a slot is on the chase.
 */
export const DISPATCH_CALLSIGNS = [
  'TARPON 12', 'GULL 07', 'MARLIN 23', 'REEF 41',
  'HERON 55', 'PELICAN 68', 'OSPREY 71', 'MANATEE 84',
  'DOLPHIN 90', 'SHARK 03', 'STINGRAY 17', 'BARRACUDA 29',
];

/** The player's only weapon: fists, thrown with Space or F, on a short cooldown. */
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

/** Where progress is kept between visits (this browser only). */
export const SAVE_KEY = 'solmar-heat.save.v1';
export const BEST_KEY = 'solmar-heat.best.v1';
