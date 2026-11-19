# SOLMAR HEAT

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/zavonlame/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/zavonlame/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A top-down 2D open-world crime game in the fictional city of Solmar. Cruise the streets on foot or behind the wheel, take whatever car you want, run four story jobs for the fixer Milo, and try to stay ahead of the Solmar PD as your wanted level climbs from zero to five stars. The city is alive — traffic, pedestrians, foot cops and patrol cars — and everything is tracked on a HUD with a live minimap. Your progress is saved in localStorage, so you pick up where you left off. It runs entirely from static files, no network needed, in desktop Chrome.

## How to run

```sh
node serve.ts
```

Then open http://localhost:8080 in your browser.

## Controls

- **WASD** — walk, hold to run
- **E** — steal a car / get out of a car
- **Punch** — fight back while on foot
- **Missions** — Milo's four jobs, in order: WHEELS, THE PIER DROP, HEAT, PAYDAY RUN. Finish all four to complete the story.
- **Wanted level 0–5** — the higher it goes, the harder the police come after you. Get BUSTED or WASTED and you restart from your last save.

## Tips

- Stealing a fast car makes the getaway jobs much easier, but a high wanted level means patrol cars will ram you.
- The minimap shows mission markers, cops and your car — check it before you drive into a dead end.
- Sound is synthesized in the browser with WebAudio; there are no audio files to download.

---

Built for the make.fun bounty — [make.fun](https://make.fun/r/ye09dzcs)
