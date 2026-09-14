import { concat, utf8 } from './bytes';

/** Minimal BCS primitives used by the frozen DraftProof wire format. */
export function uleb128(value: number): Uint8Array {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('BCS vector length is invalid.');
  const bytes: number[] = [];
  do {
    let byte = value & 0x7f;
    value = Math.floor(value / 128);
    if (value > 0) byte |= 0x80;
    bytes.push(byte);
  } while (value > 0);
  return Uint8Array.from(bytes);
}

export function bcsVector(bytes: Uint8Array): Uint8Array { return concat(uleb128(bytes.length), bytes); }
export function bcsString(value: string): Uint8Array { return bcsVector(utf8(value)); }
export function bcsU16(value: number): Uint8Array {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) throw new Error('Invalid BCS u16.');
  return Uint8Array.of(value & 0xff, value >>> 8);
}
