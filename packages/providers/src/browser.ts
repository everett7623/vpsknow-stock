import { chromium, type Browser, type BrowserContextOptions } from 'playwright-core';
import { parseProxyForPlaywright, resolveProviderProxyUrl } from './http.js';

const USER_AGENT = 'VPSKnow-Stock/1.0';
const NAVIGATION_TIMEOUT_MS = 30_000;
const READY_TIMEOUT_MS = 15_000;

export type BrowserPageResult =
  | { url: string; ok: true; html: string }
  | { url: string; ok: false; error: string };

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function launchBrowser(proxyUrl?: string): Promise<Browser> {
  const options: Parameters<typeof chromium.launch>[0] = {
    headless: true,
    args: ['--disable-dev-shm-usage'],
    ...(proxyUrl ? { proxy: parseProxyForPlaywright(proxyUrl) } : {}),
  };

  try {
    return await chromium.launch(options);
  } catch (bundledError) {
    if (process.platform !== 'win32') throw bundledError;

    try {
      return await chromium.launch({ ...options, channel: 'chrome' });
    } catch (chromeError) {
      throw new Error(
        `bundled Chromium failed: ${messageFrom(bundledError)}; `
        + `Chrome channel failed: ${messageFrom(chromeError)}`,
      );
    }
  }
}

export async function fetchProviderPagesWithBrowser(
  provider: string,
  urls: readonly string[],
  readySelector: string,
): Promise<BrowserPageResult[]> {
  const proxyUrl = resolveProviderProxyUrl(provider);
  let browser: Browser;
  try {
    browser = await launchBrowser(proxyUrl);
  } catch (error) {
    throw new Error(`${provider} could not launch Chromium: ${messageFrom(error)}`);
  }

  const results: BrowserPageResult[] = [];
  const contextOptions: BrowserContextOptions = {
    userAgent: USER_AGENT,
    locale: 'en-US',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  };
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  try {
    for (const url of urls) {
      try {
        const response = await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: NAVIGATION_TIMEOUT_MS,
        });
        if (!response) throw new Error('navigation returned no HTTP response');
        if (!response.ok()) throw new Error(`HTTP ${response.status()}`);

        await page.locator(readySelector).first().waitFor({
          state: 'attached',
          timeout: READY_TIMEOUT_MS,
        });
        results.push({ url, ok: true, html: await page.content() });
      } catch (error) {
        results.push({ url, ok: false, error: messageFrom(error) });
      }
    }
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }

  return results;
}
