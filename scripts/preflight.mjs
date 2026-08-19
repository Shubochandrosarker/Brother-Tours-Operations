import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = process.cwd();
const web = resolve(root, 'apps/web');
const src = resolve(web, 'src');
const envFile = process.argv[2] || '.env.production';
const envPath = resolve(web, envFile);
const failures = [];

const major = Number(process.versions.node.split('.')[0]);
if (major < 20 || major >= 23) failures.push(`Node ${process.versions.node} is outside the supported >=20 <23 range.`);

let env = '';
try { env = readFileSync(envPath, 'utf8'); } catch { failures.push(`apps/web/${envFile} is missing.`); }
const configuredApi = process.env.VITE_BT_API_BASE?.trim() || '';
const fileApi = env.match(/^VITE_BT_API_BASE=(.+)$/m)?.[1]?.trim() || '';
const api = configuredApi || fileApi;
if (!/^https:\/\/[^\s]+\/wp-json\/bridgistic\/v1\/?$/.test(api)) failures.push('VITE_BT_API_BASE must be an HTTPS bridgistic/v1 endpoint.');

const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    else if (/\.(js|jsx)$/.test(name)) files.push(path);
  }
}
walk(src);
const source = files.map((file) => readFileSync(file, 'utf8')).join('\n');

const forbidden = [
  ['/dashboard/snapshot', 'invented dashboard endpoint'],
  ['/dashboard/attention', 'invented dashboard endpoint'],
  ['/dashboard/alerts', 'invented dashboard endpoint'],
  ['/dashboard/activity', 'invented dashboard endpoint'],
  ['/dashboard/upcoming', 'invented dashboard endpoint'],
  ['X-CSRF-Token', 'wrong CSRF header'],
  // The connector plane authorises as an HMAC key with no WordPress user. Its
  // key must never reach a browser bundle — that would hand every visitor
  // php:execute, db:write and fs:write on production.
  ['X-Bridgistic-Key', 'connector HMAC header in client source'],
  ['X-Bridgistic-Signature', 'connector HMAC header in client source'],
  ['X-Bridgistic-Timestamp', 'connector HMAC header in client source'],
  ['bridgistic_secret', 'connector secret reference in client source'],
  // Insightistic's get_dashboard_data() returns a pre-rendered html string from
  // another plugin. Nothing in this app may inject raw markup.
  ['dangerouslySetInnerHTML', 'raw HTML injection'],
];
for (const [needle, label] of forbidden) if (source.includes(needle)) failures.push(`${label} found: ${needle}`);
if (source.includes('localStorage') || source.includes('sessionStorage')) failures.push('Browser storage reference found in production source; auth state must remain server/runtime based.');
if (!source.includes("'X-BT-CSRF'") && !source.includes('"X-BT-CSRF"')) failures.push('X-BT-CSRF write protection is missing from the API client.');

if (failures.length) {
  console.error('Preflight failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Preflight passed · Node ${process.versions.node} · ${files.length} source files · API ${api}${configuredApi ? ' · process env override' : ''}`);
