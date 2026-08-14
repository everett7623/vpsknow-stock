import * as cheerio from 'cheerio';
import { parseLetOffer, type LetDiscussion, type ParsedLetOffer } from './lowendtalk.js';
import { assertRssParseResult, loadRssDocument } from './rss.js';

type ExternalSource = 'lowendbox' | 'lowendspirit';

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function comparable(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function validSourceUrl(value: string, source: ExternalSource): URL | null {
  try {
    const url = new URL(value);
    const hosts: Record<ExternalSource, readonly string[]> = {
      lowendbox: ['lowendbox.com', 'www.lowendbox.com'],
      lowendspirit: ['lowendspirit.com', 'www.lowendspirit.com'],
    };
    return url.protocol === 'https:' && hosts[source].includes(url.hostname) ? url : null;
  } catch {
    return null;
  }
}

function parseRss(
  xml: string,
  source: ExternalSource,
  idFrom: (url: URL, guid: string) => string | null,
): LetDiscussion[] {
  const $ = loadRssDocument(xml, source);
  const entries = new Map<string, LetDiscussion>();
  const itemCount = $('item').length;

  $('item').each((_, item) => {
    const title = normalizeText($(item).find('title').first().text());
    const link = normalizeText($(item).find('link').first().text());
    const guid = normalizeText($(item).find('guid').first().text());
    const author = normalizeText($(item).find('dc\\:creator, creator, author').first().text());
    const postedAt = new Date(normalizeText($(item).find('pubDate, date').first().text()));
    const contentHtml = (
      $(item).find('content\\:encoded').first().text()
      || $(item).find('description').first().text()
    ).trim();
    const url = validSourceUrl(link, source);
    if (!title || !url || Number.isNaN(postedAt.getTime())) return;

    const sourceId = idFrom(url, guid);
    if (!sourceId || entries.has(sourceId)) return;

    entries.set(sourceId, {
      discussionId: `${source}:${sourceId}`,
      title,
      author,
      postedAt,
      url: url.href,
      ...(contentHtml ? { contentHtml } : {}),
    });
  });

  assertRssParseResult(source, itemCount, entries.size);
  return [...entries.values()];
}

function titleBrand(title: string, candidate: string): string | null {
  const target = comparable(candidate);
  if (!target) return null;

  const tokens = title.match(/[A-Za-z0-9][A-Za-z0-9.'-]*/g) ?? [];
  for (let start = 0; start < tokens.length; start++) {
    for (let length = 1; length <= 3 && start + length <= tokens.length; length++) {
      const phrase = tokens.slice(start, start + length).join(' ');
      if (comparable(phrase) === target) return phrase;
    }
  }
  return null;
}

export function parseLowEndBoxRss(xml: string): LetDiscussion[] {
  return parseRss(xml, 'lowendbox', (url, guid) => {
    if (!url.pathname.startsWith('/blog/')) return null;
    return guid.match(/[?&]p=(\d+)/)?.[1] ?? null;
  });
}

export function parseLowEndSpiritRss(xml: string): LetDiscussion[] {
  return parseRss(xml, 'lowendspirit', (url, guid) => {
    const discussionId = url.pathname.match(/^\/discussion\/(\d+)(?:\/|$)/)?.[1];
    const guidId = guid.match(/^(\d+)@\/discussions$/)?.[1];
    if (!discussionId || (guidId && guidId !== discussionId)) return null;
    return discussionId;
  });
}

export function parseLowEndBoxOffer(title: string, html: string): ParsedLetOffer {
  const $ = cheerio.load(html);
  const candidates = [
    ...$('meta[property="og:image:alt"]')
      .map((_, element) => $(element).attr('content') ?? '')
      .get(),
    ...$('meta[property="og:article:tag"]')
      .map((_, element) => $(element).attr('content') ?? '')
      .get(),
  ];
  const provider = candidates
    .map((candidate) => titleBrand(title, candidate))
    .find((candidate): candidate is string => candidate !== null) ?? '';
  const content = $('.post_content').first().html() ?? $('article').first().html() ?? html;

  return parseLetOffer(title, `<article>${content}</article>`, provider);
}
