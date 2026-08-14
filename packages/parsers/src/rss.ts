import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';

export function loadRssDocument(xml: string, source: string): CheerioAPI {
  const $ = cheerio.load(xml, { xmlMode: true });
  if ($('rss').length === 0 || $('channel').length === 0) {
    throw new Error(`${source} response is not an RSS document`);
  }
  return $;
}

export function assertRssParseResult(
  source: string,
  itemCount: number,
  parsedCount: number,
): void {
  if (itemCount > 0 && parsedCount === 0) {
    throw new Error(`${source} RSS contains items but none could be parsed`);
  }
}
