import { describe, expect, it } from 'vitest';
import { bcsU16, bcsVector, uleb128 } from '../src/crypto/bcs';
import { createCommitment, decodeSubmissionBundle, encodeSealIdentity, encodeSubmissionBundle } from '../src/crypto/commitment';
import { hex } from '../src/crypto/bytes';

const bountyId = `0x${'11'.repeat(32)}` as const;
const submissionId = `0x${'22'.repeat(32)}` as const;
describe('DataBounty BCS wire format', () => {
  it('uses canonical ULEB128 and little-endian u16', () => { expect([...uleb128(128)]).toEqual([0x80, 0x01]); expect([...bcsU16(0x1234)]).toEqual([0x34, 0x12]); expect([...bcsVector(Uint8Array.of(1, 2))]).toEqual([2, 1, 2]); });
  it('encodes identity as exactly 64 bytes in bounty then submission order', () => { expect(hex(encodeSealIdentity(bountyId, submissionId))).toBe(`${'11'.repeat(32)}${'22'.repeat(32)}`); });
  it('round trips the fixed bundle without filename or title fields', () => { const bundle = { formatVersion: 1 as const, bountyId, submissionId, salt: new Uint8Array(32).fill(7), content: new TextEncoder().encode('message: hello') }; const bytes = encodeSubmissionBundle(bundle); expect(bytes.length).toBe(2 + 32 + 32 + 32 + 1 + bundle.content.length); expect(decodeSubmissionBundle(bytes)).toEqual(bundle); });
  it('uses the fixed domain plus salt and content for commitment', async () => { const result = await createCommitment(new TextEncoder().encode('hello'), new Uint8Array(32).fill(7)); expect(result.contentDigest).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'); expect(result.contentCommitment).toBe('46742444c08f7076db03cff5aef23247bb692562ecb6e553a16951e2253e9a48'); });
});
