import { execFile } from 'node:child_process';

const REQUEST_TIMEOUT_MS = 15_000;
const CURL_STATUS_MARKER = '__VPSKNOW_HTTP_STATUS__:';
const CURL_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';

const BROWSER_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'User-Agent': 'VPSKnow-Stock/1.0',
} as const;

export interface FetchProviderHtmlOptions {
  /** Optional HTTP(S) proxy URL. Secrets in userinfo are never logged. */
  proxyUrl?: string;
}

function isChallengePage(html: string): boolean {
  return /<title>\s*(?:just a moment|attention required)|id=["']challenge-form["']|cf-browser-verification/i.test(html);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Redact credentials from proxy URLs before including them in errors. */
export function redactProxyUrl(proxyUrl: string): string {
  try {
    const parsed = new URL(proxyUrl);
    if (parsed.username) parsed.username = '***';
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    return '[invalid-proxy-url]';
  }
}

/**
 * Resolve an optional provider proxy from env.
 * Prefers provider-specific vars (e.g. VMISS_PROXY_URL), then PROVIDER_PROXY_URL.
 */
export function resolveProviderProxyUrl(provider: string): string | undefined {
  const slug = provider.trim().toLowerCase().replace(/\s+/g, '');
  const specific =
    slug === 'vmiss'
      ? process.env.VMISS_PROXY_URL
      : undefined;
  const value = specific?.trim() || process.env.PROVIDER_PROXY_URL?.trim();
  return value || undefined;
}

interface CurlResult {
  html: string;
  status: number;
}

function fetchWithCurl(url: string, proxyUrl?: string): Promise<CurlResult> {
  const binary = process.platform === 'win32' ? 'curl.exe' : 'curl';
  const args = [
    '--ipv4',
    '--silent',
    '--show-error',
    '--location',
    '--compressed',
    '--max-time',
    String(REQUEST_TIMEOUT_MS / 1_000),
    '--user-agent',
    CURL_USER_AGENT,
    '--header',
    'X-VPSKnow-Agent: VPSKnow-Stock/1.0',
  ];

  if (proxyUrl) {
    args.push('--proxy', proxyUrl);
  }

  args.push(
    '--write-out',
    `\n${CURL_STATUS_MARKER}%{http_code}`,
    url,
  );

  return new Promise((resolve, reject) => {
    execFile(
      binary,
      args,
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: REQUEST_TIMEOUT_MS + 2_000 },
      (error, stdout, stderr) => {
        if (error) {
          const detail = stderr ? `: ${stderr.trim()}` : '';
          const proxyHint = proxyUrl ? ` via ${redactProxyUrl(proxyUrl)}` : '';
          reject(new Error(`${error.message}${detail}${proxyHint}`));
          return;
        }

        const markerIndex = stdout.lastIndexOf(CURL_STATUS_MARKER);
        if (markerIndex < 0) {
          reject(new Error('curl response did not include an HTTP status'));
          return;
        }

        const html = stdout.slice(0, markerIndex).trimEnd();
        const status = Number.parseInt(stdout.slice(markerIndex + CURL_STATUS_MARKER.length), 10);
        resolve({ html, status });
      },
    );
  });
}

export async function fetchProviderHtml(
  provider: string,
  url: string,
  options: FetchProviderHtmlOptions = {},
): Promise<string> {
  const proxyUrl = options.proxyUrl ?? resolveProviderProxyUrl(provider);

  // Node fetch has no built-in proxy support here — route proxied requests through curl.
  if (proxyUrl) {
    let fallback: CurlResult;
    try {
      fallback = await fetchWithCurl(url, proxyUrl);
    } catch (error) {
      throw new Error(
        `${provider} proxied request failed for ${url} via ${redactProxyUrl(proxyUrl)}: ${errorMessage(error)}`,
      );
    }

    if (fallback.status >= 200 && fallback.status < 300 && !isChallengePage(fallback.html)) {
      return fallback.html;
    }

    const fallbackFailure = isChallengePage(fallback.html)
      ? 'curl returned a challenge page'
      : `curl HTTP ${fallback.status}`;
    throw new Error(
      `${provider} proxied request failed for ${url} via ${redactProxyUrl(proxyUrl)}: ${fallbackFailure}`,
    );
  }

  let nativeFailure = 'unknown fetch failure';

  try {
    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const html = await response.text();

    if (response.ok && !isChallengePage(html)) return html;
    nativeFailure = response.ok
      ? 'challenge page returned by native fetch'
      : `native fetch HTTP ${response.status}`;
  } catch (error) {
    nativeFailure = `native fetch ${errorMessage(error)}`;
  }

  let fallback: CurlResult;
  try {
    fallback = await fetchWithCurl(url);
  } catch (error) {
    throw new Error(`${provider} request failed for ${url}: ${nativeFailure}; ${errorMessage(error)}`);
  }

  if (fallback.status >= 200 && fallback.status < 300 && !isChallengePage(fallback.html)) {
    return fallback.html;
  }

  const fallbackFailure = isChallengePage(fallback.html)
    ? 'curl returned a challenge page'
    : `curl HTTP ${fallback.status}`;
  throw new Error(`${provider} request failed for ${url}: ${nativeFailure}; ${fallbackFailure}`);
}
