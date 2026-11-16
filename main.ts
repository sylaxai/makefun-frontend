// makefun-frontend-01 entry (Node 22, standard library only).
//
// The frontend is this directory's app/: plain static files a browser opens at
// app/index.html — ES modules, CSS, no build step — reading make.fun's public
// API at https://make.fun/api. This program hands it in: it copies app/ and
// screenshots/ from beside this file to /output and writes /output/dossier.json,
// the summary the judge reads (the screenshots, the first load's files and
// bytes, and the source), built with the vendored make.fun library.
// vendor/makefun-frontend.ts stays exactly as the kit shipped it: the scorer
// rebuilds the dossier with its own copy and requires a byte-for-byte match.
//
// Serve the app locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The gate's caps, from the kit: 3 screenshots at most 256 KiB each, app/ at
// most 993 files and directories and 16 MiB in all. buildDossier refuses an
// entry past them, so a bad hand-in fails here instead of on the server.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, { text_max_bytes: 163840, screenshots: { max: 3, max_bytes: 262144 }, app_max_files: 993, app_max_bytes: 16777216 }),
);
