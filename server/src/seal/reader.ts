import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Secp256k1Keypair } from '@mysten/sui/keypairs/secp256k1';
import { Secp256r1Keypair } from '@mysten/sui/keypairs/secp256r1';
import { Transaction } from '@mysten/sui/transactions';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { EncryptedObject, SealClient, SessionKey } from '@mysten/seal';
import type { Config } from '../config.js';
import type { AgentRole, ObjectId, SuiAddress } from '../api/types.js';
import { ApiError } from '../errors.js';
import { sha256Bytes } from '../validation.js';

export interface SubmissionBundle { formatVersion: 1; bountyId: ObjectId; submissionId: ObjectId; salt: Uint8Array; content: Uint8Array; }
export interface SealReader { delegateAddress(role: AgentRole): SuiAddress; decrypt(input: { role: AgentRole; bountyId: ObjectId; submissionId: ObjectId; ciphertext: Uint8Array }): Promise<SubmissionBundle>; health(): Promise<boolean>; }

export function encodeSealIdentity(bountyId: ObjectId, submissionId: ObjectId): Uint8Array {
  if (!/^0x[0-9a-f]{64}$/.test(bountyId) || !/^0x[0-9a-f]{64}$/.test(submissionId)) throw new ApiError('INVALID_BINDING', 'Seal identity is malformed');
  return Buffer.from(`${bountyId.slice(2)}${submissionId.slice(2)}`, 'hex');
}
export function assertEncryptedObjectBinding(ciphertext: Uint8Array, packageId: ObjectId, bountyId: ObjectId, submissionId: ObjectId): void {
  try {
    const encrypted = EncryptedObject.parse(ciphertext);
    if (encrypted.packageId !== packageId || encrypted.id !== Buffer.from(encodeSealIdentity(bountyId, submissionId)).toString('hex')) throw new ApiError('INVALID_BINDING', 'Ciphertext Seal bindings do not match the requested bounty and submission');
  } catch (error) { if (error instanceof ApiError) throw error; throw new ApiError('INVALID_BINDING', 'Ciphertext is not a valid Seal encrypted object'); }
}
function takeUleb(bytes: Uint8Array, offset: number): [number, number] { let value = 0; let shift = 0; for (let i = offset; i < bytes.length && i < offset + 5; i += 1) { const next = bytes[i]!; value += (next & 0x7f) * 2 ** shift; if ((next & 0x80) === 0) return [value, i + 1]; shift += 7; } throw new ApiError('INTEGRITY_FAILED', 'Bundle has an invalid BCS length'); }
function take(bytes: Uint8Array, offset: number): [Uint8Array, number] { const [length, start] = takeUleb(bytes, offset); const end = start + length; if (end > bytes.length) throw new ApiError('INTEGRITY_FAILED', 'Bundle is truncated'); return [bytes.slice(start, end), end]; }
function fixed(bytes: Uint8Array, offset: number, length: number): [Uint8Array, number] { const end = offset + length; if (end > bytes.length) throw new ApiError('INTEGRITY_FAILED', 'Bundle is truncated'); return [bytes.slice(offset, end), end]; }
function utf8(bytes: Uint8Array): string { try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new ApiError('INTEGRITY_FAILED', 'Bundle contains invalid UTF-8'); } }
function id(bytes: Uint8Array): ObjectId { return `0x${Buffer.from(bytes).toString('hex')}` as ObjectId; }
export function decodeSubmissionBundle(bytes: Uint8Array): SubmissionBundle {
  if (bytes.length < 2 || bytes[0] !== 1 || bytes[1] !== 0) throw new ApiError('INTEGRITY_FAILED', 'Bundle schema is unsupported');
  let offset = 2; let part: Uint8Array; [part, offset] = fixed(bytes, offset, 32); const bountyId = id(part); [part, offset] = fixed(bytes, offset, 32); const submissionId = id(part); [part, offset] = fixed(bytes, offset, 32); const salt = part; [part, offset] = take(bytes, offset);
  if (offset !== bytes.length || part.length > 200 * 1024) throw new ApiError('INTEGRITY_FAILED', 'Bundle bounds are invalid');
  utf8(part);
  return { formatVersion: 1, bountyId, submissionId, salt, content: part };
}
export function contentCommitment(salt: Uint8Array, content: Uint8Array): string { return sha256Bytes(Buffer.concat([Buffer.from('databounty-content-v1', 'utf8'), Buffer.from(salt), Buffer.from(content)])); }

export class LiveSealReader implements SealReader {
  private readonly client: SuiGrpcClient;
  constructor(private readonly config: Config) { this.client = new SuiGrpcClient({ network: 'testnet', baseUrl: config.suiGrpcUrl }); }
  delegateAddress(role: AgentRole): SuiAddress {
    const configured = this.config.delegates[role]?.address;
    if (!configured || !this.config.delegates[role]?.privateKey) throw new ApiError('CHAIN_UNAVAILABLE', 'Reviewer delegate is not configured', 503);
    return configured;
  }
  async decrypt(input: { role: AgentRole; bountyId: ObjectId; submissionId: ObjectId; ciphertext: Uint8Array }): Promise<SubmissionBundle> {
    if (!this.config.packageId || this.config.sealKeyServerIds.length === 0 || this.config.sealThreshold > this.config.sealKeyServerIds.length) throw new ApiError('CHAIN_UNAVAILABLE', 'Seal is not configured', 503);
    const signer = this.keypair(input.role); const identity = encodeSealIdentity(input.bountyId, input.submissionId); assertEncryptedObjectBinding(input.ciphertext, this.config.packageId, input.bountyId, input.submissionId);
    const client = new SealClient({ suiClient: this.client, serverConfigs: this.config.sealKeyServerIds.map((objectId) => ({ objectId, weight: 1, ...(this.config.sealAggregatorUrl ? { aggregatorUrl: this.config.sealAggregatorUrl } : {}), ...(this.config.sealApiKey ? { apiKeyName: this.config.sealApiKeyName ?? 'X-API-Key', apiKey: this.config.sealApiKey } : {}) })), verifyKeyServers: true });
    const sessionKey = await SessionKey.create({ address: signer.toSuiAddress(), packageId: this.config.packageId, ttlMin: 2, signer, suiClient: this.client });
    const tx = new Transaction(); tx.moveCall({ target: `${this.config.packageId}::databounty::seal_approve`, arguments: [tx.pure.vector('u8', identity), tx.object(input.bountyId), tx.object(input.submissionId), tx.object('0x6')] });
    const txBytes = await tx.build({ client: this.client, onlyTransactionKind: true });
    return decodeSubmissionBundle(await client.decrypt({ data: input.ciphertext, sessionKey, txBytes }));
  }
  async health(): Promise<boolean> { try { return this.config.packageId !== undefined && this.config.sealKeyServerIds.length >= this.config.sealThreshold && Boolean(this.config.delegates.reviewer?.privateKey) && Boolean(this.delegateAddress('reviewer')); } catch { return false; } }
  private keypair(role: AgentRole): Ed25519Keypair | Secp256k1Keypair | Secp256r1Keypair { const encoded = this.config.delegates[role]?.privateKey; if (!encoded) throw new ApiError('CHAIN_UNAVAILABLE', 'Reviewer delegate is not configured', 503); const decoded = decodeSuiPrivateKey(encoded); if (decoded.scheme === 'ED25519') return Ed25519Keypair.fromSecretKey(decoded.secretKey); if (decoded.scheme === 'Secp256k1') return Secp256k1Keypair.fromSecretKey(decoded.secretKey); if (decoded.scheme === 'Secp256r1') return Secp256r1Keypair.fromSecretKey(decoded.secretKey); throw new ApiError('CHAIN_UNAVAILABLE', 'Unsupported delegate signing scheme', 503); }
}
