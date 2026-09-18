import { EncryptedObject, SealClient, SessionKey } from '@mysten/seal';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { config } from '../config';
import type { ObjectId } from '../domain';
import { hex, sha256 } from './bytes';
import { decodeSubmissionBundle, encodeSealIdentity, encodeSubmissionBundle, type SubmissionBundleV1 } from './commitment';
import { sealApprovalTx } from '../chain/transactions';

function clients() {
  if (!config.packageId || !config.sealAggregatorUrl || config.sealServerIds.length === 0) throw new Error('Seal is not configured. Set DataBounty package ID, key-server IDs, and aggregator URL.');
  const suiClient = new SuiGrpcClient({ network: 'testnet', baseUrl: config.grpcUrl });
  return { suiClient, sealClient: new SealClient({ suiClient, serverConfigs: config.sealServerIds.map((objectId) => ({ objectId, weight: 1, aggregatorUrl: config.sealAggregatorUrl })) }) };
}
export interface SealedPayload { ciphertext: Uint8Array; ciphertextDigest: string; identity: Uint8Array; }
/** Walrus blob IDs may use standard Base64 or URL-safe Base64 characters. */
export function isWalrusBlobId(value: string): boolean { return /^[A-Za-z0-9+/_=-]{16,512}$/.test(value); }
export async function encryptBundle(bountyId: ObjectId, submissionId: ObjectId, bundle: SubmissionBundleV1): Promise<SealedPayload> {
  const { sealClient } = clients(); const identity = encodeSealIdentity(bountyId, submissionId);
  const response = await sealClient.encrypt({ threshold: Math.min(config.sealServerIds.length, 1), packageId: config.packageId!, id: `0x${hex(identity)}`, data: encodeSubmissionBundle(bundle) });
  const ciphertext = response.encryptedObject instanceof Uint8Array ? response.encryptedObject : new Uint8Array(response.encryptedObject as ArrayBuffer);
  return { ciphertext, ciphertextDigest: hex(await sha256(ciphertext)), identity };
}
export async function fetchCiphertext(blobId: string): Promise<Uint8Array> { if (!config.walrusAggregatorUrl) throw new Error('Walrus is not configured.'); if (!isWalrusBlobId(blobId)) throw new Error('Walrus blob ID is invalid.'); const response = await fetch(new URL(`/v1/blobs/${encodeURIComponent(blobId)}`, config.walrusAggregatorUrl)); if (!response.ok) throw new Error(`Walrus did not return the encrypted blob (${response.status}).`); return new Uint8Array(await response.arrayBuffer()); }
export async function decryptBundle(args: { address: string; bountyId: ObjectId; submissionId: ObjectId; ciphertext: Uint8Array; signPersonalMessage(message: Uint8Array): Promise<string> }): Promise<SubmissionBundleV1> {
  const { suiClient, sealClient } = clients(); const identity = encodeSealIdentity(args.bountyId, args.submissionId); const encrypted = EncryptedObject.parse(args.ciphertext); const encryptedId = encrypted.id.replace(/^0x/, '').toLowerCase();
  if (encrypted.packageId.toLowerCase() !== config.packageId!.toLowerCase() || encryptedId !== hex(identity)) throw new Error('Seal header does not bind this ciphertext to the selected bounty and submission.');
  const sessionKey = await SessionKey.create({ address: args.address, packageId: config.packageId!, ttlMin: 2, suiClient }); await sessionKey.setPersonalMessageSignature(await args.signPersonalMessage(sessionKey.getPersonalMessage()));
  const txBytes = await sealApprovalTx(args.bountyId, args.submissionId, identity).build({ client: suiClient, onlyTransactionKind: true }); const plaintext = await sealClient.decrypt({ data: args.ciphertext, sessionKey, txBytes });
  return decodeSubmissionBundle(plaintext);
}
