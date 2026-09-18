import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const lines = readFileSync('.env', 'utf8').split(/\r?\n/);
const local = Object.fromEntries(lines.filter((line) => line && !line.startsWith('#')).map((line) => {
  const separator = line.indexOf('=');
  return separator < 0 ? [line, ''] : [line.slice(0, separator), line.slice(separator + 1)];
}));
const required = [
  'DATABOUNTY_PACKAGE_ID', 'WALRUS_PUBLISHER_URL', 'WALRUS_AGGREGATOR_URL', 'SEAL_KEY_SERVER_IDS',
  'SEAL_AGGREGATOR_URL', 'REVIEWER_DELEGATE_PRIVATE_KEY', 'AI_PROVIDER', 'AI_BASE_URL', 'AI_API_KEY', 'AI_MODEL',
  'VITE_SUI_NETWORK', 'VITE_SUI_GRPC_URL', 'VITE_DATABOUNTY_PACKAGE_ID', 'VITE_SEAL_KEY_SERVER_IDS',
  'VITE_SEAL_AGGREGATOR_URL', 'VITE_WALRUS_AGGREGATOR_URL',
];
for (const key of required) if (!local[key]) throw new Error(`Missing required local deployment setting: ${key}`);
const values = {
  APP_ORIGIN: 'https://databounty-wine.vercel.app',
  COOKIE_SECRET: randomBytes(32).toString('base64url'),
  SQLITE_PATH: '/tmp/databounty.db',
  NODE_ENV: 'production',
  WALRUS_STORAGE_EPOCHS: local.WALRUS_STORAGE_EPOCHS || '5',
  SEAL_THRESHOLD: local.SEAL_THRESHOLD || '1',
  ...Object.fromEntries(required.map((key) => [key, local[key]])),
};
for (const [key, value] of Object.entries(values)) {
  execFileSync('npx', ['vercel', 'env', 'add', key, 'production', '--force'], { input: value, stdio: ['pipe', 'pipe', 'pipe'] });
  process.stdout.write(`configured ${key}\n`);
}
