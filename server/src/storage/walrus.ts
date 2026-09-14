import type { Config } from '../config.js';
import { fail } from '../errors.js';
import { sha256Bytes } from '../validation.js';
import type { Sha256Hex, StoragePublishResponse, WalrusBlobId } from '../api/types.js';

export interface WalrusStorage { publish(ciphertext: Uint8Array, digest: Sha256Hex): Promise<Omit<StoragePublishResponse, 'bountyId' | 'submissionId' | 'ciphertextDigest'>>; read(blobId: WalrusBlobId): Promise<Uint8Array>; health(): Promise<{ publisher: boolean; aggregator: boolean }>; }

export class LiveWalrusStorage implements WalrusStorage {
  constructor(private readonly config: Config, private readonly fetchImpl: typeof fetch = fetch) {}
  async publish(ciphertext: Uint8Array, digest: Sha256Hex): Promise<Omit<StoragePublishResponse, 'bountyId' | 'submissionId' | 'ciphertextDigest'>> {
    if (!this.config.walrusPublisherUrl || !this.config.walrusAggregatorUrl) throw fail.storage();
    const url = new URL('/v1/blobs', this.config.walrusPublisherUrl); url.searchParams.set('epochs', String(this.config.walrusStorageEpochs));
    let body: unknown;
    try { const response = await this.fetchImpl(url, { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: Buffer.from(ciphertext) as unknown as BodyInit }); if (!response.ok) throw new Error(`publisher ${response.status}`); body = await response.json(); } catch { throw fail.storage(); }
    const parsed = body as { newlyCreated?: { blobObject?: { blobId?: unknown; storage?: { endEpoch?: unknown } } }; alreadyCertified?: { blobId?: unknown; endEpoch?: unknown } };
    const blobId = parsed.newlyCreated?.blobObject?.blobId ?? parsed.alreadyCertified?.blobId;
    const endEpoch = parsed.newlyCreated?.blobObject?.storage?.endEpoch ?? parsed.alreadyCertified?.endEpoch;
    if (typeof blobId !== 'string' || blobId.length === 0 || (typeof endEpoch !== 'number' && typeof endEpoch !== 'string')) throw fail.storage();
    const downloaded = await this.read(blobId);
    if (sha256Bytes(downloaded) !== digest) throw fail.storage();
    return { blobId, storageEndEpoch: String(endEpoch), publisherReceipt: typeof parsed.newlyCreated === 'object' ? 'newlyCreated' : 'alreadyCertified', verifiedDownloadAt: new Date().toISOString() };
  }
  async read(blobId: WalrusBlobId): Promise<Uint8Array> {
    if (!this.config.walrusAggregatorUrl || !/^[A-Za-z0-9_-]{16,200}$/.test(blobId)) throw fail.storage();
    const url = new URL(`/v1/blobs/${encodeURIComponent(blobId)}`, this.config.walrusAggregatorUrl);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try { const response = await this.fetchImpl(url); if (response.ok) return new Uint8Array(await response.arrayBuffer()); if (response.status !== 404 && response.status < 500) throw fail.storage(); } catch (error) { if (error instanceof Error && error.name === 'ApiError') throw error; }
    }
    throw fail.storage();
  }
  async health(): Promise<{ publisher: boolean; aggregator: boolean }> {
    const probe = async (base: string | undefined): Promise<boolean> => { if (!base) return false; try { return (await this.fetchImpl(new URL('/v1/api', base), { method: 'GET' })).ok; } catch { return false; } };
    return { publisher: await probe(this.config.walrusPublisherUrl), aggregator: await probe(this.config.walrusAggregatorUrl) };
  }
}
