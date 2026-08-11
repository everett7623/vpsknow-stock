import * as cheerio from 'cheerio';

const CHANNEL_SLUG = 'vmisstz';
export const VMISS_TG_CHANNEL_URL = `https://t.me/s/${CHANNEL_SLUG}`;

export interface VmissTgSignal {
  readonly messageId: number;
  readonly planName: string;
  readonly pid: string | null;
  readonly inStock: boolean;
  readonly statusAt: Date | null;
  readonly locationHint: string | null;
  readonly priceCents: number | null;
  readonly currency: string;
  readonly cpu: string;
  readonly ramMb: number;
  readonly storageGb: number;
  readonly storageType: string;
  readonly bandwidthTb: number;
  readonly portMbps: number;
  readonly ipv4: boolean;
}

function decodeHref(href: string): string {
  return href.replace(/&amp;/g, '&');
}

function parsePriceCents(text: string): { priceCents: number | null; currency: string } {
  const match = text.match(/\$\s*(\d+(?:\.\d+)?)\s*(CAD|USD)?/i);
  if (!match) return { priceCents: null, currency: 'CAD' };
  return {
    priceCents: Math.round(Number.parseFloat(match[1]!) * 100),
    currency: (match[2] ?? 'CAD').toUpperCase(),
  };
}

function parseShanghaiDateTime(value: string): Date | null {
  const statusAt = new Date(value.replace(' ', 'T') + '+08:00');
  return Number.isNaN(statusAt.getTime()) ? null : statusAt;
}

function parseStatus(text: string): { inStock: boolean; statusAt: Date | null } | null {
  const restock = text.match(/✅\s*补货\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
  if (restock) {
    return { inStock: true, statusAt: parseShanghaiDateTime(restock[1]!) };
  }

  const soldOut = text.match(/❌\s*售罄\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
  if (soldOut) {
    return { inStock: false, statusAt: parseShanghaiDateTime(soldOut[1]!) };
  }

  if (/✅\s*补货/.test(text)) return { inStock: true, statusAt: null };
  if (/❌\s*售罄/.test(text)) return { inStock: false, statusAt: null };
  return null;
}

function parseSpecs(text: string): {
  cpu: string;
  ramMb: number;
  storageGb: number;
  storageType: string;
  bandwidthTb: number;
  portMbps: number;
  ipv4: boolean;
} {
  const cores = Number.parseInt(text.match(/(\d+)\s*Cores?/i)?.[1] ?? '0', 10);
  const ramMb = Number.parseInt(text.match(/(\d+)\s*MB\b/i)?.[1] ?? '0', 10);
  const storageMatch = text.match(/(\d+)\s*GB\s*(NVMe|SSD|HDD)/i);
  const storageGb = storageMatch ? Number.parseInt(storageMatch[1]!, 10) : 0;
  const storageType = storageMatch?.[2] ?? 'SSD';
  const bandwidthGb = Number.parseFloat(text.match(/(\d+(?:\.\d+)?)\s*GB\s*Bandwidth/i)?.[1] ?? '0');
  const portMbps = Number.parseInt(text.match(/(\d+)\s*Mbps\s*Port/i)?.[1] ?? '0', 10);

  return {
    cpu: cores > 0 ? `${cores} Core${cores === 1 ? '' : 's'}` : 'Unknown',
    ramMb,
    storageGb,
    storageType,
    bandwidthTb: Math.round((bandwidthGb / 1000) * 1000) / 1000,
    portMbps,
    ipv4: /IPv4/i.test(text),
  };
}

function extractPid(href: string | undefined): string | null {
  if (!href) return null;
  const match = decodeHref(href).match(/[?&]pid=(\d+)/i);
  return match?.[1] ?? null;
}

function extractPlanName(text: string): string | null {
  const match = text.match(/VMISS\s*-\s*([A-Z0-9.]+)/i);
  return match?.[1]?.trim() ?? null;
}

function extractLocationHint(text: string): string | null {
  const match = text.match(/ℹ️\s*([^；;\n]+)/) ?? text.match(/ℹ\s*([^；;\n]+)/);
  return match?.[1]?.trim() ?? null;
}

/**
 * Parse the public Telegram channel preview HTML (`https://t.me/s/vmisstz`).
 * Purchase affiliate IDs in the HTML are ignored — callers must rewrite order URLs.
 */
export function parseVmissTgChannelHtml(html: string): VmissTgSignal[] {
  const $ = cheerio.load(html);
  const signals: VmissTgSignal[] = [];

  $('.tgme_widget_message').each((_, element) => {
    const message = $(element);
    const post = message.attr('data-post') ?? '';
    const messageId = Number.parseInt(post.split('/')[1] ?? '', 10);
    if (!Number.isFinite(messageId) || messageId <= 0) return;

    const text = message.find('.tgme_widget_message_text').text().replace(/\u00a0/g, ' ').trim();
    if (!text) return;

    const planName = extractPlanName(text);
    const status = parseStatus(text);
    if (!planName || !status) return;

    let pid: string | null = null;
    message.find('.tgme_widget_message_text a[href]').each((__, anchor) => {
      const found = extractPid($(anchor).attr('href'));
      if (found) pid = found;
    });

    const { priceCents, currency } = parsePriceCents(text);
    const specs = parseSpecs(text);

    signals.push({
      messageId,
      planName,
      pid,
      inStock: status.inStock,
      statusAt: status.statusAt,
      locationHint: extractLocationHint(text),
      priceCents,
      currency,
      ...specs,
    });
  });

  return signals.sort((a, b) => a.messageId - b.messageId);
}
