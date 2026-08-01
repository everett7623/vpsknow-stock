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

function isChallengePage(html: string): boolean {
  return /<title>\s*(?:just a moment|attention required)|id=["']challenge-form["']|cf-browser-verification/i.test(html);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface CurlResult {
  html: string;
  status: number;
}

function fetchWithCurl(url: string): Promise<CurlResult> {
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
    '--write-out',
    `\n${CURL_STATUS_MARKER}%{http_code}`,
    url,
  ];

  return new Promise((resolve, reject) => {
    execFile(
      binary,
      args,
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: REQUEST_TIMEOUT_MS + 2_000 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`${error.message}${stderr ? `: ${stderr.trim()}` : ''}`));
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

export async function fetchProviderHtml(provider: string, url: string): Promise<string> {
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
