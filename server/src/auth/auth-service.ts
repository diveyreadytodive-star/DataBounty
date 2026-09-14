import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AuthChallengeResponse, AuthVerifyResponse, SuiAddress } from '../api/types.js';
import { ApiError, fail } from '../errors.js';
import type { Config } from '../config.js';
import { DraftProofDb } from '../db/database.js';

export interface SignatureVerifier { verify(message: Uint8Array, signature: string, address: SuiAddress): Promise<void>; }

export class SuiSignatureVerifier implements SignatureVerifier {
  async verify(message: Uint8Array, signature: string, address: SuiAddress): Promise<void> {
    try {
      const { verifyPersonalMessageSignature } = await import('@mysten/sui/verify');
      await verifyPersonalMessageSignature(message, signature, { address });
    } catch { throw new ApiError('UNAUTHENTICATED', 'The wallet signature is invalid', 401); }
  }
}

export class AuthService {
  constructor(private readonly db: DraftProofDb, private readonly config: Config, private readonly verifier: SignatureVerifier = new SuiSignatureVerifier()) {}
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
    const challenge = this.db.consumeChallenge(challengeId);
    if (!challenge) throw new ApiError('UNAUTHENTICATED', 'Challenge is expired, consumed, or unknown', 401);
    if (message !== challenge.message) throw new ApiError('UNAUTHENTICATED', 'Signed message does not match the issued challenge', 401);
    await this.verifier.verify(Buffer.from(message, 'utf8'), signature, challenge.address);
    const token = randomBytes(32).toString('base64url'); const expiresAt = new Date(Date.now() + this.config.sessionTtlSeconds * 1000).toISOString();
    this.db.createSession(this.tokenHash(token), challenge.address, expiresAt);
    return { response: { address: challenge.address, network: 'testnet', expiresAt }, token };
  }
  sessionAddress(token: string | undefined): SuiAddress { if (!token) throw fail.unauthenticated(); const address = this.db.sessionAddress(this.tokenHash(token)); if (!address) throw fail.unauthenticated(); return address; }
  private tokenHash(token: string): string { return createHash('sha256').update(`${this.config.cookieSecret}:${token}`).digest('hex'); }
}
