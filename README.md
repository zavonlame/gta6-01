# SOLMAR HEAT — 8 story jobs · crew of 3 · saves · radio · 5-star PD chase

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/zavonlame/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/zavonlame/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta-01)

A pseudo-3D open-world crime game in the fictional city of Solmar, at golden hour. Cruise the streets on foot or behind the wheel, take whatever car you want, run **eight story jobs** for the fixer Milo, recruit a **crew of three** — DANA the driver, RICO the muscle, LENA the hacker, each with a real perk — and try to stay ahead of the Solmar PD as your wanted level climbs from zero to five stars, with the CONDOR-1 helicopter circling overhead at three stars and up. The city is alive — traffic, pedestrians, foot cops and patrol cars — and everything is tracked on a HUD with a live minimap, a police-dispatch panel, a mission tracker, Milo's dialogue, crew cards and three radio stations. Your progress (cash, jobs, crew) is **saved in localStorage**, so you pick up where you left off. It runs entirely from static files, no network needed, in desktop Chrome.

## How to run

```sh
node serve.ts
```

Then open http://localhost:8080 in your browser.

## Controls

- **WASD** — walk, hold to run
- **E** — steal a car / get out of a car
- **Punch** — fight back while on foot (Space or F)
- **R** — change radio station (Solmar FM 88.5, Heat 101.2, Pier 95.7)
- **P** — pause · **M** — mute
- **Missions** — Milo's eight jobs, in order: WHEELS, THE PIER DROP, HEAT, PAYDAY RUN, CREW CALL, THE VAULT, AIR SUPPORT, THE BIG SCORE. Finish all eight to complete the story.
- **Wanted level 0–5** — the higher it goes, the harder the police come after you. Get BUSTED or WASTED and you restart from your last save. Ram the police too much and your car takes damage — at 100% the engine dies and you need new wheels.

## Tips

- Stealing a fast car makes the getaway jobs much easier, but a high wanted level means patrol cars will ram you — and every ram wrecks your car a little more.
- Recruit the crew in job 5: DANA adds top speed, RICO hits harder, LENA makes the heat fade faster.
- The minimap shows mission markers, cops, the helicopter and your car — check it before you drive into a dead end.
- Sound is synthesized in the browser with WebAudio; there are no audio files to download.

---

Built for the make.fun bounty — [make.fun](https://make.fun/r/ye09dzcs)
