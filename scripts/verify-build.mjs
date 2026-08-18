/**
 * Verifies the BUILT OUTPUT, not the source.
 *
 * Every check here corresponds to a defect that actually shipped to production:
 * a stale committed bundle carrying a dead REST namespace and the wrong host,
 * accumulated duplicate chunks from two different builds, and an index.html
 * pointing at assets that were no longer on disk.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.cwd(), 'dist/apps/web');
const failures = [];

if (!existsSync(root)) {
  console.error('Build verification FAILED:');
  console.error('- dist/apps/web does not exist — the build did not run.');
  process.exit(1);
}
if (!existsSync(join(root, 'index.html'))) failures.push('dist/apps/web/index.html is missing.');

let stamp = null;
if (!existsSync(join(root, 'build-info.json'))) {
  failures.push('build-info.json is missing — npm run stamp did not run.');
} else {
  try { stamp = JSON.parse(readFileSync(join(root, 'build-info.json'), 'utf8')); }
  catch (error) { failures.push(`build-info.json is not valid JSON: ${error.message}`); }
}

const expected = (process.env.VITE_BT_API_BASE || '').trim() || (stamp?.apiBase || '').trim();

const assetDir = join(root, 'assets');
const assets = existsSync(assetDir) ? readdirSync(assetDir) : [];
const jsAssets = assets.filter((file) => file.endsWith('.js'));
if (!jsAssets.length) failures.push('No JavaScript chunks were emitted into dist/apps/web/assets.');
const bundle = jsAssets.map((file) => readFileSync(join(assetDir, file), 'utf8')).join('\n');

// The two strings that shipped the outage.
if (bundle.includes('bt-ops/v1')) failures.push('Dead namespace bt-ops/v1 found in the built bundle.');
if (process.env.BT_TARGET === 'production' && bundle.includes('staging.brothertours.com')) {
  failures.push('staging.brothertours.com found in a PRODUCTION bundle.');
}

if (!expected) {
  failures.push('No API base resolved — set VITE_BT_API_BASE or ensure build-info.json carries one.');
} else if (!/^https:\/\/[^\s]+\/wp-json\/bridgistic\/v1\/?$/.test(expected)) {
  failures.push(`Resolved API base is not an HTTPS bridgistic/v1 endpoint: ${expected}`);
} else if (!bundle.includes(expected.replace(/\/$/, ''))) {
  failures.push(`Expected API base ${expected} was not found in any built chunk.`);
}

// Duplicate-chunk detection — proves emptyOutDir wiped the previous build.
const stems = jsAssets.map((file) => file.replace(/-[A-Za-z0-9_-]{8}\.js$/, ''));
const dupes = [...new Set(stems.filter((stem, index) => stems.indexOf(stem) !== index))];
if (dupes.length) failures.push(`Duplicate chunks from a stale build: ${dupes.join(', ')}`);

// Every asset index.html references must exist, or the SPA dies on a module parse error.
if (existsSync(join(root, 'index.html'))) {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const referenced = [...html.matchAll(/(?:src|href)="(\/[^"]+\.(?:js|css))"/g)].map((match) => match[1]);
  for (const ref of referenced) {
    if (!existsSync(join(root, ref.replace(/^\//, '')))) {
      failures.push(`index.html references ${ref}, which is not present in the build output.`);
    }
  }
}

if (failures.length) {
  console.error('Build verification FAILED:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Build verified · api=${expected} · commit=${stamp?.commit ?? 'unknown'} · ${assets.length} assets · no stale artifacts`);
