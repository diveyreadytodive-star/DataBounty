import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Config } from './config.js';
import { loadConfig } from './config.js';
import { AuthService, SuiSignatureVerifier, type SignatureVerifier } from './auth/auth-service.js';
import { DraftProofDb } from './db/database.js';
import { LiveSuiGateway } from './chain/live-sui.js';
import type { ChainGateway } from './chain/types.js';
import { LiveWalrusStorage, type WalrusStorage } from './storage/walrus.js';
import { assertEncryptedObjectBinding, LiveSealReader, type SealReader } from './seal/reader.js';
import { OpenAiCompatibleProvider, type AiProvider } from './ai/provider.js';
import { AiRunService } from './ai/run-service.js';
import { ApiError, fail } from './errors.js';
import { address, asRecord, base64, nonEmptyString, objectId, requireExactKeys, sha256, sha256Bytes } from './validation.js';
import type { AgentDescriptor, HealthResponse, StoragePublishRequest, ReviewRequest, BountyResponse } from './api/types.js';

export interface AppDependencies { config?: Config; db?: DraftProofDb; verifier?: SignatureVerifier; chain?: ChainGateway; storage?: WalrusStorage; seal?: SealReader; provider?: AiProvider; }
const COOKIE_NAME = 'draftproof_session';

function originGuard(config: Config) { return async (request: FastifyRequest): Promise<void> => { const origin = request.headers.origin; if (origin !== config.appOrigin) throw new ApiError('FORBIDDEN', 'Request origin is not allowed', 403); }; }
function sessionAddress(request: FastifyRequest, auth: AuthService) { return auth.sessionAddress(request.cookies[COOKIE_NAME]); }

export async function createApp(dependencies: AppDependencies = {}): Promise<FastifyInstance> {
  const config = dependencies.config ?? loadConfig(); const db = dependencies.db ?? new DraftProofDb(config.sqlitePath);
  const auth = new AuthService(db, config, dependencies.verifier ?? new SuiSignatureVerifier()); const chain = dependencies.chain ?? new LiveSuiGateway(config);
  const storage = dependencies.storage ?? new LiveWalrusStorage(config); const seal = dependencies.seal ?? new LiveSealReader(config); const provider = dependencies.provider ?? new OpenAiCompatibleProvider(config);
  const aiRuns = new AiRunService(db, chain, storage, seal, provider, config.packageId); const app = Fastify({ logger: { level: config.logLevel, redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'] } });
  await app.register(cookie);
  app.setErrorHandler((error, request, reply) => { const apiError = error instanceof ApiError ? error : new ApiError('INVALID_REQUEST', 'Request could not be completed', 500); request.log.warn({ code: apiError.code, requestId: request.id }, 'Request rejected'); return reply.status(apiError.statusCode).send({ error: { code: apiError.code, message: apiError.message, retryable: apiError.retryable, requestId: request.id } }); });
  app.addHook('onClose', () => { if (!dependencies.db) db.close(); });
  const guard = originGuard(config);

  app.post('/api/auth/challenge', { preHandler: guard }, async (request) => { const body = asRecord(request.body); requireExactKeys(body, ['address']); return auth.challenge(address(body.address)); });
  app.post('/api/auth/verify', { preHandler: guard }, async (request, reply) => { const body = asRecord(request.body); requireExactKeys(body, ['challengeId', 'message', 'signature']); const verified = await auth.verify(nonEmptyString(body.challengeId, 'challengeId', 200), nonEmptyString(body.message, 'message', 4000), nonEmptyString(body.signature, 'signature', 2048)); reply.setCookie(COOKIE_NAME, verified.token, { httpOnly: true, sameSite: 'lax', secure: new URL(config.appOrigin).protocol === 'https:', path: '/', maxAge: config.sessionTtlSeconds }); return verified.response; });
  app.get('/api/agents', async (): Promise<{ agents: AgentDescriptor[] }> => {
    // This endpoint is intentionally public and exposes only the address
    // derived from the configured reviewer signer. Missing signer/configuration
    // is represented as null so optional AI review never becomes a 500.
    const delegateAddress = config.delegates.reviewer.privateKey ? config.delegates.reviewer.address ?? null : null;
    return { agents: [{ role: 'reviewer', displayName: '검수 AI', delegateAddress }] };
  });
  app.get('/api/bounties/:bountyId', async (request): Promise<BountyResponse> => { const viewer = sessionAddress(request, auth); const { bountyId } = request.params as { bountyId: unknown }; const bounty = await chain.readBounty(objectId(bountyId, 'bountyId')); const submissions = await Promise.all(bounty.submissionIds.map((id) => chain.readSubmission(id))); const isRequester = bounty.requester === viewer; const visible = isRequester ? submissions : submissions.filter((submission) => submission.contributor === viewer); if (!isRequester && visible.length === 0) throw fail.forbidden(); const { submissionIds: _submissionIds, policyRevision: _policyRevision, ...summary } = bounty; void _submissionIds; void _policyRevision; const publicSubmissions = visible.map(({ reviewerGrants: _reviewerGrants, ...submission }) => { void _reviewerGrants; return submission; }); return { bounty: summary, submissions: publicSubmissions }; });
  app.post('/api/storage/publish', { preHandler: guard }, async (request) => { const contributor = sessionAddress(request, auth); const body = asRecord(request.body); requireExactKeys(body, ['bountyId', 'submissionId', 'ciphertextBase64', 'ciphertextDigest']); const parsed: StoragePublishRequest = { bountyId: objectId(body.bountyId, 'bountyId'), submissionId: objectId(body.submissionId, 'submissionId'), ciphertextBase64: nonEmptyString(body.ciphertextBase64, 'ciphertextBase64', 400 * 1024), ciphertextDigest: sha256(body.ciphertextDigest, 'ciphertextDigest') }; const ciphertext = base64(parsed.ciphertextBase64, 'ciphertextBase64', 300 * 1024); if (sha256Bytes(ciphertext) !== parsed.ciphertextDigest) throw new ApiError('INTEGRITY_FAILED', 'ciphertextDigest does not match uploaded bytes'); const bounty = await chain.readBounty(parsed.bountyId); const submission = await chain.readSubmission(parsed.submissionId); if (submission.bountyId !== bounty.id || submission.contributor !== contributor || submission.state !== 'RESERVED') throw fail.forbidden('Only the contributor may publish a RESERVED submission'); if (!config.packageId) throw new ApiError('INVALID_BINDING', 'DataBounty package is not configured', 503); assertEncryptedObjectBinding(ciphertext, config.packageId, bounty.id, submission.id); const receipt = await storage.publish(ciphertext, parsed.ciphertextDigest); db.recordUpload(parsed.submissionId, parsed.bountyId, contributor, parsed.ciphertextDigest, receipt.blobId, receipt.storageEndEpoch); return { ...receipt, bountyId: parsed.bountyId, submissionId: parsed.submissionId, ciphertextDigest: parsed.ciphertextDigest }; });
  app.post('/api/bounties/:bountyId/reviews', { preHandler: guard }, async (request) => { const requester = sessionAddress(request, auth); const { bountyId } = request.params as { bountyId: unknown }; const body = asRecord(request.body); requireExactKeys(body, ['requestId', 'submissionId', 'comparisonSubmissionIds']); if (!Array.isArray(body.comparisonSubmissionIds)) throw fail.invalid('comparisonSubmissionIds must be an array'); const review: ReviewRequest = { requestId: nonEmptyString(body.requestId, 'requestId', 200), submissionId: objectId(body.submissionId, 'submissionId'), comparisonSubmissionIds: body.comparisonSubmissionIds.map((id) => objectId(id, 'comparisonSubmissionIds')) }; return aiRuns.run(requester, objectId(bountyId, 'bountyId'), review); });
  app.get('/api/bounties/:bountyId/reviews/:requestId', async (request) => { const requester = sessionAddress(request, auth); const params = request.params as { bountyId?: string; requestId?: string }; if (!params.requestId) throw fail.invalid('requestId is invalid'); return aiRuns.status(requester, objectId(params.bountyId, 'bountyId'), params.requestId); });
  app.get('/api/health', async (): Promise<HealthResponse> => { const [sui, sealHealthy, walrus, ai] = await Promise.all([chain.health(), seal.health(), storage.health(), provider.health()]); const dependenciesStatus = { sqlite: 'ok', sui: sui ? 'ok' : 'blocked', seal: sealHealthy ? 'ok' : 'blocked', walrusPublisher: walrus.publisher ? 'ok' : 'blocked', walrusAggregator: walrus.aggregator ? 'ok' : 'blocked', ai: ai ? 'ok' : 'blocked' } as const; const status = Object.values(dependenciesStatus).every((value) => value === 'ok') ? 'ok' : 'blocked'; return { status, network: 'testnet', packageConfigured: config.packageId !== undefined, dependencies: dependenciesStatus }; });
  const staticRoot = resolve(fileURLToPath(new URL('../../app/dist/', import.meta.url)));
  if (existsSync(staticRoot)) {
    await app.register(fastifyStatic, { root: staticRoot, wildcard: true, index: false });
    app.get('/', (_request, reply) => reply.sendFile('index.html'));
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) return reply.status(404).send({ error: { code: 'INVALID_REQUEST', message: 'API route was not found', retryable: false, requestId: request.id } });
      return reply.sendFile('index.html');
    });
  }
  return app;
}
