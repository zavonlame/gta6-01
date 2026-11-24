# SOLMAR HEAT — 10 STORY JOBS · CREW OF 3 · SAVES · RADIO · RACES · GARAGE · 5-STAR PD CHASE

A sun-soaked open-world crime game in the fictional coastal city of Solmar.
Ten story jobs for fixer Cassia Voss, a crew of three, a five-star Solmar PD
that answers with named dispatch units, roadblocks and the CONDOR-1 air unit,
street races, a garage, radio, saves and district standing — all in static
files under `game/`, no network, no build step.

## Play

Serve it and open it in desktop Chrome:

```
node serve.ts
```

Then open http://localhost:8080.

- **WASD / arrows** — walk, or drive when in a car
- **E** — steal / enter / leave a car
- **F** — fire
- **R** — change radio station (SOLMAR FM 98.1, PIER RADIO 101.4, NIGHT DRIVE 104.7)
- **G** — garage upgrades near Juno's Garage (engine, armour, nitro)
- **Q** — start the Sunset Sprint street race at the start line
- **1 / 2 / 3** — crew abilities: Juno Park slipstream, Bram Okafor ram plate, Tess Marlowe ghost signal
- **P** — pause · **M** — mute

## The game

- **City**: a seeded grid city — Downtown Solmar, Marina Row, Old Pier, Hotel Strip,
  Dockside, Palm Courts — with traffic, pedestrians, palms, a beach and a sea edge.
- **Jobs**: 10 story missions (FIRST WHEELS, THE PIER DROP, HOTEL HEAT, PAYDAY RUN,
  CREW CALL, THE VAULT CUT, SKYHOOK, RACE THE SUN, THE LONG NIGHT, THE BIG SCORE),
  each with stages, a mission tracker and dialogue from Cassia Voss.
- **Crew**: Juno Park (driver), Bram Okafor (muscle), Tess Marlowe (hacker) — three
  ability cards on the HUD with cooldowns.
- **Police**: 5-star wanted, SOLMAR PD dispatch board with six named units (role,
  distance, tactic), cruisers in pursuit, roadblocks at 3+ stars, CONDOR-1
  helicopter with a searchlight cone at 4+ stars.
- **Progression**: money, respect ranks (NOBODY → CITY LEGEND), district standing,
  garage upgrades, car damage and condition, weapon slots (7, one LOCKED),
  burning wrecks, and three save slots plus autosave in localStorage.
- **Presentation**: golden-hour sky and skyline, isometric chase view, circular
  minimap, health and armour bars, speed and car condition, effects and
  synthesised sound (WebAudio only — no audio files).

## Shots

`screenshots/` holds four real renders of the game's own code (see `shots.json`):
1-chase (cover — the Vault Cut escape), 2-foot (the Pier Drop on foot),
3-race (Race the Sun), 4-start (title screen with save slots).

## Hand in

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes
`dossier.json` with the vendored make.fun library. It is a copy program only.

## Originality

Every name, character, place, vehicle and story in SOLMAR HEAT is original —
nothing is taken from any commercial game. The city, the crew and the jobs
were written for this entry.
