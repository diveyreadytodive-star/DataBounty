import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { verifyPersonalMessageSignature } from '@mysten/sui/verify';
import type { ClientWithCoreApi } from '@mysten/sui/client';
import type { AuthChallengeResponse, AuthVerifyResponse, SuiAddress } from '../api/types.js';
import { ApiError, fail } from '../errors.js';
import type { Config } from '../config.js';
import { DraftProofDb } from '../db/database.js';

export interface SignatureVerifier { verify(message: Uint8Array, signature: string, address: SuiAddress): Promise<void>; }

type PersonalMessageSignatureVerifier = (
  message: Uint8Array,
  signature: string,
  options: { client: ClientWithCoreApi; address: SuiAddress },
) => Promise<unknown>;

export class SuiSignatureVerifier implements SignatureVerifier {
  private readonly client: ClientWithCoreApi;
  private readonly verifyPersonalMessage: PersonalMessageSignatureVerifier;

  constructor(
    config: Config,
    client: ClientWithCoreApi = new SuiGrpcClient({ network: 'testnet', baseUrl: config.suiGrpcUrl }),
    verifyPersonalMessage: PersonalMessageSignatureVerifier = verifyPersonalMessageSignature,
  ) {
    this.client = client;
    this.verifyPersonalMessage = verifyPersonalMessage;
  }

  async verify(message: Uint8Array, signature: string, address: SuiAddress): Promise<void> {
    try {
      await this.verifyPersonalMessage(message, signature, { client: this.client, address });
    } catch { throw new ApiError('UNAUTHENTICATED', 'The wallet signature is invalid', 401); }
  }
}

export class AuthService {
  constructor(private readonly db: DraftProofDb, private readonly config: Config, private readonly verifier: SignatureVerifier = new SuiSignatureVerifier(config)) {}
  challenge(address: SuiAddress): AuthChallengeResponse {
    const challengeId = randomUUID(); const issuedAt = new Date(); const expiresAt = new Date(issuedAt.getTime() + this.config.nonceTtlSeconds * 1000);
    const nonce = randomBytes(32).toString('base64url');
    const message = [
      'DataBounty wallet authentication', `Domain: ${this.config.authDomain}`, `Origin: ${this.config.appOrigin}`,
      'Network: testnet', `Address: ${address}`, `Nonce: ${nonce}`, `Issued At: ${issuedAt.toISOString()}`,
      `Expires At: ${expiresAt.toISOString()}`, `Challenge ID: ${challengeId}`
    ].join('\n');
    this.db.createChallenge(challengeId, address, message, expiresAt.toISOString());
    return { challengeId, message, network: 'testnet', expiresAt: expiresAt.toISOString() };
  }
  async verify(challengeId: string, message: string, signature: string): Promise<{ response: AuthVerifyResponse; token: string }> {
    const challenge = this.db.findChallenge(challengeId);
    if (!challenge || challenge.usedAt || Date.parse(challenge.expiresAt) <= Date.now()) throw new ApiError('UNAUTHENTICATED', 'Challenge is expired, consumed, or unknown', 401);
    if (message !== challenge.message) throw new ApiError('UNAUTHENTICATED', 'Signed message does not match the issued challenge', 401);
    await this.verifier.verify(Buffer.from(message, 'utf8'), signature, challenge.address);
    const expiresAt = new Date(Date.now() + this.config.sessionTtlSeconds * 1000).toISOString();
    // A signed token keeps the browser session valid across serverless cold
    // starts, where an ephemeral SQLite file may no longer contain sessions.
    // We still create the database row for local auditability and backwards
    // compatible tests, but authorization never depends on that volatile row.
    const token = this.sessionToken(challenge.address, expiresAt);
    const claimed = this.db.claimChallengeAndCreateSession(challengeId, this.tokenHash(token), challenge.address, expiresAt);
    if (!claimed) throw new ApiError('UNAUTHENTICATED', 'Challenge is expired, consumed, or unknown', 401);
    return { response: { address: claimed.address, network: 'testnet', expiresAt }, token };
  }
  sessionAddress(token: string | undefined): SuiAddress {
    if (!token) throw fail.unauthenticated();
    const signedAddress = this.verifySessionToken(token);
    if (signedAddress) return signedAddress;
    const address = this.db.sessionAddress(this.tokenHash(token));
    if (!address) throw fail.unauthenticated();
    return address;
  }
  private tokenHash(token: string): string { return createHash('sha256').update(`${this.config.cookieSecret}:${token}`).digest('hex'); }
  private sessionToken(address: SuiAddress, expiresAt: string): string {
    const payload = Buffer.from(JSON.stringify({ address, expiresAt }), 'utf8').toString('base64url');
    return `v1.${payload}.${this.sign(payload)}`;
  }
  private verifySessionToken(token: string): SuiAddress | undefined {
    const [version, payload, signature, ...extra] = token.split('.');
    if (version !== 'v1' || !payload || !signature || extra.length) return undefined;
    const expected = this.sign(payload);
    const receivedBytes = Buffer.from(signature, 'base64url');
    const expectedBytes = Buffer.from(expected, 'base64url');
    if (receivedBytes.length !== expectedBytes.length || !timingSafeEqual(receivedBytes, expectedBytes)) return undefined;
    try {
      const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { address?: unknown; expiresAt?: unknown };
      if (typeof parsed.address !== 'string' || typeof parsed.expiresAt !== 'string' || Date.parse(parsed.expiresAt) <= Date.now()) return undefined;
      return parsed.address as SuiAddress;
    } catch { return undefined; }
  }
  private sign(value: string): string { return createHmac('sha256', this.config.cookieSecret).update(value).digest('base64url'); }
}
