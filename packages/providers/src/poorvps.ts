import { createDecipheriv, createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';

const OPENSSL_PREFIX = Buffer.from('Salted__', 'ascii');
const KEY_AND_IV_BYTES = 48;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deriveKeyAndIv(password: Buffer, salt: Buffer): { key: Buffer; iv: Buffer } {
  const blocks: Buffer[] = [];
  let previous = Buffer.alloc(0);
  let length = 0;

  while (length < KEY_AND_IV_BYTES) {
    previous = createHash('md5')
      .update(Buffer.concat([previous, password, salt]))
      .digest();
    blocks.push(previous);
    length += previous.length;
  }

  const material = Buffer.concat(blocks);
  return {
    key: material.subarray(0, 32),
    iv: material.subarray(32, KEY_AND_IV_BYTES),
  };
}

export function decodePoorVpsCatalog(
  encryptedPayload: string,
  password: string,
): Record<string, unknown> {
  const encrypted = Buffer.from(encryptedPayload.trim(), 'base64');
  if (
    encrypted.length <= 16 ||
    !encrypted.subarray(0, OPENSSL_PREFIX.length).equals(OPENSSL_PREFIX)
  ) {
    throw new Error('PoorVPS payload is not an OpenSSL salted message');
  }

  const salt = encrypted.subarray(8, 16);
  const { key, iv } = deriveKeyAndIv(Buffer.from(password, 'utf8'), salt);
  const decipher = createDecipheriv('aes-256-cbc', key, iv);

  let compressed: Buffer;
  try {
    compressed = Buffer.concat([decipher.update(encrypted.subarray(16)), decipher.final()]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`PoorVPS payload decryption failed: ${message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(inflateSync(compressed).toString('utf8')) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`PoorVPS payload decompression failed: ${message}`);
  }

  if (!isRecord(parsed)) throw new Error('PoorVPS payload did not contain a product object');
  return parsed;
}

export async function fetchPoorVpsCatalog(
  provider: string,
  url: string,
  password: string,
): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/plain,*/*',
      Referer: 'https://poorvps.com/',
      'User-Agent': 'VPSKnow-Stock/1.0',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) throw new Error(`${provider} PoorVPS source HTTP ${response.status}`);
  return decodePoorVpsCatalog(await response.text(), password);
}
