import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import type { ClientWithCoreApi } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { createApp } from '../src/app.js';
import { AuthService, SuiSignatureVerifier } from '../src/auth/auth-service.js';
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

test('signature verifier passes its injected Sui client and address to the SDK', async () => {
  const client = {} as unknown as ClientWithCoreApi;
  const address = `0x${'22'.repeat(32)}` as `0x${string}`;
  let observed: { client: ClientWithCoreApi; address: string } | undefined;
  const verifier = new SuiSignatureVerifier(config, client, async (_message, _signature, options) => {
    observed = options;
  });

  await verifier.verify(new TextEncoder().encode('message'), 'opaque-signature', address);

  assert.equal(observed?.client, client);
  assert.equal(observed?.address, address);
});

test('successful verification creates a session address atomically', async () => {
  const db = new DraftProofDb(':memory:');
  const auth = new AuthService(db, config);
  const keypair = Ed25519Keypair.generate();
  const issued = auth.challenge(keypair.toSuiAddress());
  const { signature } = await keypair.signPersonalMessage(new TextEncoder().encode(issued.message));
  const verified = await auth.verify(issued.challengeId, issued.message, signature);
  assert.equal(auth.sessionAddress(verified.token), keypair.toSuiAddress());
  db.close();
});

test('a verified session survives loss of ephemeral session rows', async () => {
  const db = new DraftProofDb(':memory:');
  const auth = new AuthService(db, config);
  const keypair = Ed25519Keypair.generate();
  const issued = auth.challenge(keypair.toSuiAddress());
  const { signature } = await keypair.signPersonalMessage(new TextEncoder().encode(issued.message));
  const verified = await auth.verify(issued.challengeId, issued.message, signature);
  db.database.exec('DELETE FROM sessions');
  assert.equal(auth.sessionAddress(verified.token), keypair.toSuiAddress());
  db.close();
});

test('session insert failure rolls back challenge claim so it remains retryable', () => {
  const db = new DraftProofDb(':memory:');
  const address = `0x${'11'.repeat(32)}` as `0x${string}`;
  const challengeId = 'challenge-session-rollback';
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  db.createChallenge(challengeId, address, 'message', expiresAt);
  db.createSession('duplicate-token-hash', address, expiresAt);
  assert.throws(() => db.claimChallengeAndCreateSession(challengeId, 'duplicate-token-hash', address, expiresAt));
  assert.equal(db.findChallenge(challengeId)?.usedAt, null);
  const claimed = db.claimChallengeAndCreateSession(challengeId, createHash('sha256').update('fresh-token-hash').digest('hex'), address, expiresAt);
  assert.equal(claimed?.id, challengeId);
  db.close();
});

test('default verifier rejects a tampered challenge message', async () => {
  const { app, db } = await setup();
  const keypair = Ed25519Keypair.generate();
  const issued = await challenge(app, keypair.toSuiAddress());
  const { signature } = await keypair.signPersonalMessage(new TextEncoder().encode(issued.message));
  const response = await app.inject({ method: 'POST', url: '/api/auth/verify', headers: { origin: ORIGIN }, payload: { challengeId: issued.challengeId, message: `${issued.message}\ntampered`, signature } });
  assert.equal(response.statusCode, 401);
  assert.equal((response.json() as { error: { code: string } }).error.code, 'UNAUTHENTICATED');
  const retry = await app.inject({ method: 'POST', url: '/api/auth/verify', headers: { origin: ORIGIN }, payload: { challengeId: issued.challengeId, message: issued.message, signature } });
  assert.equal(retry.statusCode, 200);
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
  const { signature: validSignature } = await owner.signPersonalMessage(new TextEncoder().encode(issued.message));
  const retry = await app.inject({ method: 'POST', url: '/api/auth/verify', headers: { origin: ORIGIN }, payload: { challengeId: issued.challengeId, message: issued.message, signature: validSignature } });
  assert.equal(retry.statusCode, 200);
  await app.close(); db.close();
});

test('racing valid verifications claim a challenge exactly once', async () => {
  const { app, db } = await setup();
  const keypair = Ed25519Keypair.generate();
  const issued = await challenge(app, keypair.toSuiAddress());
  const { signature } = await keypair.signPersonalMessage(new TextEncoder().encode(issued.message));
  const responses = await Promise.all([1, 2].map(() => app.inject({ method: 'POST', url: '/api/auth/verify', headers: { origin: ORIGIN }, payload: { challengeId: issued.challengeId, message: issued.message, signature } })));
  assert.deepEqual(responses.map((response) => response.statusCode).sort(), [200, 401]);
  await app.close(); db.close();
});
