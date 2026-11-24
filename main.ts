// main.ts — the entrypoint. One job: hand the game in.
// It copies game/ and screenshots/ from beside this file into the output
// directory (MAKEFUN_OUTPUT_DIR outside the grader, /output inside it)
// and writes /output/dossier.json with the vendored make.fun library.
// Standard library only, no network, no build step, no Chrome: the
// grader has no browser, so this program only copies files and writes
// the dossier. Run it locally as: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's caps: dossier text at most 163,840 bytes, at most 4
// screenshots of at most 256 KiB each, game/ at most 993 files and
// 48 MiB in all. buildDossier refuses anything over those caps, so a
// bad entry fails here, loudly, instead of silently at the gate.
// The copy is byte-for-byte, so two runs write identical output.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
