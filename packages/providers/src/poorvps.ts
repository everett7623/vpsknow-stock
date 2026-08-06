import { createDecipheriv, createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { load } from 'cheerio';

const OPENSSL_PREFIX = Buffer.from('Salted__', 'ascii');
const KEY_AND_IV_BYTES = 48;
const POORVPS_CDN_HOST = 'cdn.poorvps.com';
const MAX_ASSET_COUNT = 20;
const MAX_BUNDLE_LENGTH = 2_000_000;
const MAX_PASSWORD_CANDIDATES = 2_048;
const MAX_CATALOG_CANDIDATES = 32;
const DISCOVERY_TTL_MS = 60 * 60 * 1000;

interface DiscoveredCatalogSource {
  dataUrl: string;
  password: string;
  discoveredAt: number;
}

const discoveredSources = new Map<string, DiscoveredCatalogSource>();

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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractAssetUrls(html: string, pageUrl: string): string[] {
  const $ = load(html);
  const urls = new Set<string>();

  $('script[src], link[href]').each((_index, element) => {
    const reference = $(element).attr('src') ?? $(element).attr('href');
    if (!reference) return;

    try {
      const url = new URL(reference, pageUrl);
      if (
        url.protocol === 'https:' &&
        url.hostname === POORVPS_CDN_HOST &&
        url.pathname.endsWith('.js')
      ) {
        urls.add(url.href);
      }
    } catch {
      // Ignore malformed third-party asset references from the public page.
    }
  });

  return [...urls].slice(0, MAX_ASSET_COUNT);
}

function extractCatalogFiles(bundle: string, catalogName: string): string[] {
  const pattern = new RegExp(
    `["'\`]${escapeRegExp(catalogName)}["'\`]\\s*:\\s*["'\`](cache-[A-Za-z0-9_-]+\\.txt)["'\`]`,
  );
  const directFile = bundle.match(pattern)?.[1];
  if (directFile) return [directFile];
  if (!bundle.includes(catalogName)) return [];

  return [...new Set(bundle.match(/cache-[A-Za-z0-9_-]+\.txt/g) ?? [])].slice(
    0,
    MAX_CATALOG_CANDIDATES,
  );
}

function extractPasswordCandidates(bundle: string): string[] {
  const candidates = new Set<string>();
  const pattern = /(["'`])([A-Za-z0-9_-]{8,128})\1/g;

  for (const match of bundle.matchAll(pattern)) {
    if (match[2]) candidates.add(match[2]);
  }

  return [...candidates];
}

async function fetchPublicText(
  provider: string,
  url: string,
  referer: string,
  accept: string,
): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: accept,
      Referer: referer,
      'User-Agent': 'VPSKnow-Stock/1.0',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) throw new Error(`${provider} PoorVPS discovery HTTP ${response.status}`);
  return response.text();
}

export async function fetchDiscoveredPoorVpsCatalog(
  provider: string,
  pageUrl: string,
  catalogName: string,
  validateCatalog: (catalog: Record<string, unknown>) => boolean = () => true,
): Promise<Record<string, unknown>> {
  const cacheKey = `${pageUrl}\u0000${catalogName}`;
  const cachedSource = discoveredSources.get(cacheKey);
  if (cachedSource && Date.now() - cachedSource.discoveredAt < DISCOVERY_TTL_MS) {
    try {
      const encryptedPayload = await fetchPublicText(
        provider,
        cachedSource.dataUrl,
        pageUrl,
        'text/plain,*/*',
      );
      const catalog = decodePoorVpsCatalog(encryptedPayload, cachedSource.password);
      if (!validateCatalog(catalog)) throw new Error('Cached catalog failed validation');
      return catalog;
    } catch {
      discoveredSources.delete(cacheKey);
    }
  } else if (cachedSource) {
    discoveredSources.delete(cacheKey);
  }

  const html = await fetchPublicText(provider, pageUrl, pageUrl, 'text/html,*/*');
  const assetUrls = extractAssetUrls(html, pageUrl);
  if (assetUrls.length === 0) {
    throw new Error(`${provider} PoorVPS discovery found no trusted JavaScript assets`);
  }

  const dataUrls = new Set<string>();
  const passwordCandidates = new Set<string>();

  for (const assetUrl of assetUrls) {
    let bundle: string;
    try {
      bundle = await fetchPublicText(
        provider,
        assetUrl,
        pageUrl,
        'text/javascript,application/javascript,*/*',
      );
    } catch {
      continue;
    }
    if (bundle.length > MAX_BUNDLE_LENGTH) continue;

    for (const candidate of extractPasswordCandidates(bundle)) {
      if (passwordCandidates.size >= MAX_PASSWORD_CANDIDATES) break;
      passwordCandidates.add(candidate);
    }

    for (const catalogFile of extractCatalogFiles(bundle, catalogName)) {
      if (dataUrls.size >= MAX_CATALOG_CANDIDATES) break;
      dataUrls.add(new URL(`/data/${catalogFile}`, assetUrl).href);
    }
  }

  if (dataUrls.size === 0) {
    throw new Error(`${provider} PoorVPS discovery did not publish ${catalogName}`);
  }
  if (passwordCandidates.size === 0) {
    throw new Error(`${provider} PoorVPS discovery found no decryption candidates`);
  }

  for (const dataUrl of dataUrls) {
    let encryptedPayload: string;
    try {
      encryptedPayload = await fetchPublicText(provider, dataUrl, pageUrl, 'text/plain,*/*');
    } catch {
      continue;
    }

    for (const password of passwordCandidates) {
      try {
        const catalog = decodePoorVpsCatalog(encryptedPayload, password);
        if (!validateCatalog(catalog)) continue;
        discoveredSources.set(cacheKey, { dataUrl, password, discoveredAt: Date.now() });
        return catalog;
      } catch {
        // Public bundles contain many string literals; only one decrypts the current payload.
      }
    }
  }

  throw new Error(`${provider} PoorVPS discovery could not decrypt and validate ${catalogName}`);
}

export function clearPoorVpsDiscoveryCache(): void {
  discoveredSources.clear();
}
