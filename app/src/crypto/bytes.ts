const encoder = new TextEncoder();

export const utf8 = (value: string): Uint8Array => encoder.encode(value);
export const hex = (bytes: Uint8Array): string => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
export const concat = (...parts: Uint8Array[]): Uint8Array => {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
};

export function fromHex(value: string, expectedBytes?: number): Uint8Array {
  const raw = value.startsWith('0x') ? value.slice(2) : value;
  if (!/^[0-9a-fA-F]*$/.test(raw) || raw.length % 2 !== 0) throw new Error('Expected hexadecimal bytes.');
  const bytes = Uint8Array.from(raw.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));
  if (expectedBytes !== undefined && bytes.length !== expectedBytes) throw new Error(`Expected ${expectedBytes} bytes.`);
  return bytes;
}

export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource));
}

export function base64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
