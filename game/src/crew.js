// crew.js — one job: the three crew members and what they do for you.
// Juno drives, Bram hits, Tess hacks. Each ability has a cooldown and a
// one-line effect the HUD cards show. Press 1, 2 or 3 to call one in.
export const CREW = [
  {
    id: 'juno', name: 'Juno Park', role: 'DRIVER', ability: 'SLIPSTREAM',
    desc: '+speed 8s', cooldown: 20, color: '#7ddc7d',
  },
  {
    id: 'bram', name: 'Bram Okafor', role: 'MUSCLE', ability: 'RAM PLATE',
    desc: 'smash roadblocks', cooldown: 25, color: '#ff9a5a',
  },
  {
    id: 'tess', name: 'Tess Marlowe', role: 'HACKER', ability: 'GHOST SIGNAL',
    desc: '-1 wanted star', cooldown: 30, color: '#7ab8ff',
  },
];

export function crewById(id) {
  return CREW.find((c) => c.id === id);
}

export function cooldownLeft(state, id) {
  return Math.max(0, state.crewCooldown[id] || 0);
}

// Apply an ability to the live game state. Returns a toast line or null
// when the ability is still cooling down.
export function useAbility(state, id) {
  const member = crewById(id);
  if (!member) return null;
  const left = state.crewCooldown[id] || 0;
  if (left > 0) return member.name + ' is cooling down (' + Math.ceil(left) + 's)';
  state.crewCooldown[id] = member.cooldown;
  if (id === 'juno') {
    state.boost = 8;
    return 'JUNO: slipstream engaged — hold on!';
  }
  if (id === 'bram') {
    state.ramPlate = 10;
    state.car.condition = Math.min(100, (state.car.condition || 80) + 10);
    return 'BRAM: ram plate up — roadblocks won\'t stop us.';
  }
  if (id === 'tess') {
    state.police.wanted = Math.max(0, state.police.wanted - 1);
    return 'TESS: ghost signal — one star scrubbed from the board.';
  }
  return null;
}

export function tickCooldowns(state, dt) {
  for (const c of CREW) {
    if (state.crewCooldown[c.id] > 0) state.crewCooldown[c.id] -= dt;
  }
  if (state.boost > 0) state.boost -= dt;
  if (state.ramPlate > 0) state.ramPlate -= dt;
}
