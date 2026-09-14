import { chmod, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Secp256k1Keypair } from '@mysten/sui/keypairs/secp256k1';
import { Secp256r1Keypair } from '@mysten/sui/keypairs/secp256r1';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const envPath = `${projectRoot}.env`;
const examplePath = `${projectRoot}.env.example`;
const keys = ['PLANNER_DELEGATE_PRIVATE_KEY', 'WRITER_DELEGATE_PRIVATE_KEY', 'REVIEWER_DELEGATE_PRIVATE_KEY'];

function setValue(lines, name) {
  const indexes = lines.flatMap((line, index) => line.startsWith(`${name}=`) ? [index] : []);
  if (indexes.length > 1) throw new Error(`${name} is declared more than once in .env`);
  if (indexes.length === 0) {
    const value = new Ed25519Keypair().getSecretKey();
    lines.push(`${name}=${value}`);
    return value;
  }
  const index = indexes[0];
  const existing = lines[index].slice(name.length + 1);
  if (existing.trim().length > 0) return existing;
  const value = new Ed25519Keypair().getSecretKey();
  lines[index] = `${name}=${value}`;
  return value;
}

function addressFor(privateKey) {
  const decoded = decodeSuiPrivateKey(privateKey);
  if (decoded.scheme === 'ED25519') return Ed25519Keypair.fromSecretKey(decoded.secretKey).toSuiAddress();
  if (decoded.scheme === 'Secp256k1') return Secp256k1Keypair.fromSecretKey(decoded.secretKey).toSuiAddress();
  if (decoded.scheme === 'Secp256r1') return Secp256r1Keypair.fromSecretKey(decoded.secretKey).toSuiAddress();
  throw new Error('Unsupported Sui private key scheme');
}

function setDerivedAddress(lines, name, privateKey) {
  const indexes = lines.flatMap((line, index) => line.startsWith(`${name}=`) ? [index] : []);
  if (indexes.length > 1) throw new Error(`${name} is declared more than once in .env`);
  const expected = addressFor(privateKey);
  if (indexes.length === 0) {
    lines.push(`${name}=${expected}`);
    return expected;
  }
  const index = indexes[0];
  const existing = lines[index].slice(name.length + 1).trim();
  if (existing.length > 0 && existing !== expected) throw new Error(`${name} does not match ${name.replace('_ADDRESS', '_PRIVATE_KEY')}`);
  lines[index] = `${name}=${expected}`;
  return expected;
}

const source = await readFile(existsSync(envPath) ? envPath : examplePath, 'utf8');
const newline = source.includes('\r\n') ? '\r\n' : '\n';
const lines = source.split(/\r?\n/);
if (lines.at(-1) === '') lines.pop();
const values = new Map(keys.map((name) => [name, setValue(lines, name)]));
const addresses = keys.map((name) => addressFor(values.get(name)));
if (new Set(addresses).size !== addresses.length) {
  throw new Error('Delegate keys must resolve to different Sui addresses');
}
setDerivedAddress(lines, 'REVIEWER_DELEGATE_ADDRESS', values.get('REVIEWER_DELEGATE_PRIVATE_KEY'));
await writeFile(envPath, `${lines.join(newline)}${newline}`, { mode: 0o600 });
await chmod(envPath, 0o600);
console.log('Local Seal delegate setup complete. Private keys were not printed.');
