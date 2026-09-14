import assert from 'node:assert/strict';
import test from 'node:test';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config.js';
import { DraftProofDb } from '../src/db/database.js';

const ORIGIN = 'http://app.test';
const config: Config = {
  nodeEnv: 'test', host: '127.0.0.1', port: 0, appOrigin: ORIGIN, authDomain: 'app.test',
  nonceTtlSeconds: 300, sessionTtlSeconds: 300, cookieSecret: 'auth-test-secret', sqlitePath: ':memory:', logLevel: 'silent',
  suiGrpcUrl: 'https://fullnode.testnet.sui.io:443', packageId: undefined, walrusPublisherUrl: undefined, walrusAggregatorUrl: undefined,
  walrusStorageEpochs: 1, sealKeyServerIds: [], sealAggregatorUrl: undefined, sealThreshold: 1, sealApiKeyName: undefined, sealApiKey: undefined,
  delegates: { reviewer: {} }, ai: undefined,
};

async function setup() {
  const db = new DraftProofDb(':memory:');
  const app = await createApp({ config, db });
  return { app, db };
}

async function challenge(app: Awaited<ReturnType<typeof createApp>>, address: string) {
  const response = await app.inject({ method: 'POST', url: '/api/auth/challenge', headers: { origin: ORIGIN }, payload: { address } });
  assert.equal(response.statusCode, 200);
  return response.json() as { challengeId: string; message: string };
}

test('default verifier accepts a real generated Ed25519 personal-message signature', async () => {
  const { app, db } = await setup();
  const keypair = Ed25519Keypair.generate();
  const issued = await challenge(app, keypair.toSuiAddress());
  const { signature } = await keypair.signPersonalMessage(new TextEncoder().encode(issued.message));
  const response = await app.inject({ method: 'POST', url: '/api/auth/verify', headers: { origin: ORIGIN }, payload: { challengeId: issued.challengeId, message: issued.message, signature } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().address, keypair.toSuiAddress());
  assert.match(response.headers['set-cookie'] ?? '', /^draftproof_session=/);
  await app.close(); db.close();
});

test('default verifier rejects a tampered challenge message', async () => {
  const { app, db } = await setup();
  const keypair = Ed25519Keypair.generate();
  const issued = await challenge(app, keypair.toSuiAddress());
  const { signature } = await keypair.signPersonalMessage(new TextEncoder().encode(issued.message));
  const response = await app.inject({ method: 'POST', url: '/api/auth/verify', headers: { origin: ORIGIN }, payload: { challengeId: issued.challengeId, message: `${issued.message}\ntampered`, signature } });
  assert.equal(response.statusCode, 401);
  assert.equal((response.json() as { error: { code: string } }).error.code, 'UNAUTHENTICATED');
  await app.close(); db.close();
});

test('default verifier rejects a signature from the wrong address', async () => {
  const { app, db } = await setup();
  const owner = Ed25519Keypair.generate(); const attacker = Ed25519Keypair.generate();
  const issued = await challenge(app, owner.toSuiAddress());
  const { signature } = await attacker.signPersonalMessage(new TextEncoder().encode(issued.message));
  const response = await app.inject({ method: 'POST', url: '/api/auth/verify', headers: { origin: ORIGIN }, payload: { challengeId: issued.challengeId, message: issued.message, signature } });
  assert.equal(response.statusCode, 401);
  assert.equal((response.json() as { error: { code: string } }).error.code, 'UNAUTHENTICATED');
  await app.close(); db.close();
});
