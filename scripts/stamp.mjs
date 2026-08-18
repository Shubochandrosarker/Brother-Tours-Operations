/**
 * Writes dist/apps/web/build-info.json after every build.
 *
 * This is the record of what actually shipped: which API base was compiled into
 * the bundle, from which commit, when. server.mjs serves it from /healthz so a
 * single curl answers "which build is live and where is it pointed".
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), 'dist/apps/web');
const out = resolve(root, 'build-info.json');
const envFile = process.env.BT_ENV_FILE || 'apps/web/.env.production';

if (!existsSync(root)) {
  console.error(`Cannot stamp: ${root} does not exist. The build did not run.`);
  process.exit(1);
}

let api = process.env.VITE_BT_API_BASE?.trim() || '';
if (!api) {
  try {
    api = readFileSync(resolve(process.cwd(), envFile), 'utf8')
      .match(/^VITE_BT_API_BASE=(.+)$/m)?.[1]?.trim() || '';
  } catch { /* leave empty; verify-build.mjs fails on an unresolved base */ }
}

let commit = 'unknown';
try { commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
catch { /* CI or a deploy tarball without git metadata */ }

writeFileSync(out, JSON.stringify({
  app: 'brother-tours-operations-hub',
  apiBase: api,
  commit,
  builtAt: new Date().toISOString(),
  node: process.version,
  target: process.env.BT_TARGET || 'production',
}, null, 2));

console.log(`Stamped ${out} · api=${api || '(unresolved)'} · commit=${commit}`);
