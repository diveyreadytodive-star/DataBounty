import { describe, expect, it } from 'vitest';
import { isWalrusBlobId } from '../src/crypto/seal';

describe('Walrus blob IDs', () => {
  it('accepts the standard Base64 identifier returned by a live Walrus publish', () => {
    expect(isWalrusBlobId('RURvajktRVRaYloxMF93bFNDVEZCM0tsN3B5LUt1RGI2UWMxaDlieXE5Yw==')).toBe(true);
  });

  it('rejects path-like identifiers', () => {
    expect(isWalrusBlobId('../not-a-blob')).toBe(false);
  });
});
