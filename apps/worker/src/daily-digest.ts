import { prisma } from '@vpsknow/database';
import { ACTIVE_PROVIDER_SLUGS, buildStockGoUrl, currencyPrefix } from '@vpsknow/shared';
import {
  formatDailyStockDigest,
  sendChannelMessage,
  type DigestProductLine,
} from '@vpsknow/telegram';
import type { Logger } from 'pino';

const PUBLIC_CHANNEL_ID = process.env.TELEGRAM_OFFERS_CHANNEL_ID?.trim() || '@vpsknow_offers';
const TELEGRAM_MAX_LENGTH = 3900;

function billingLabel(cycle: string): string {
  switch (cycle) {
    case 'monthly':
      return '月付';
    case 'quarterly':
      return '季付';
    case 'semi-annually':
      return '半年付';
    case 'annually':
      return '年付';
    case 'biennially':
      return '两年付';
    case 'triennially':
      return '三年付';
    default:
      return cycle;
  }
}

function formatRam(ramMb: number | null): string {
  if (!ramMb || ramMb <= 0) return '?';
  return ramMb >= 1024 ? `${Math.round(ramMb / 1024)}GB` : `${ramMb}MB`;
}

function chunkMessages(text: string): string[] {
  if (text.length <= TELEGRAM_MAX_LENGTH) return [text];

  const chunks: string[] = [];
  const parts = text.split('\n\n');
  let current = '';
  for (const part of parts) {
    const next = current ? `${current}\n\n${part}` : part;
    if (next.length > TELEGRAM_MAX_LENGTH && current) {
      chunks.push(current);
      current = part;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export type DailyDigestSummary = {
  products: number;
  providers: number;
  messagesSent: number;
};

/**
 * Push a Chinese daily in-stock digest to the public offers channel.
 */
export async function publishDailyStockDigest(logger: Logger): Promise<DailyDigestSummary> {
  const products = await prisma.product.findMany({
    where: {
      inStock: true,
      availabilitySource: 'live',
      provider: {
        isActive: true,
        slug: { in: [...ACTIVE_PROVIDER_SLUGS] },
      },
    },
    include: {
      provider: { select: { slug: true, name: true } },
    },
    orderBy: [{ providerId: 'asc' }, { priceCents: 'asc' }],
    take: 200,
  });

  if (products.length === 0) {
    logger.info('Daily digest skipped — no in-stock live products');
    return { products: 0, providers: 0, messagesSent: 0 };
  }

  const lines: DigestProductLine[] = products.map((product) => {
    const ram = formatRam(product.ramMb);
    const storage =
      product.storageGb && product.storageGb > 0
        ? `${product.storageGb}GB-${product.storageType || 'SSD'}`
        : '?';
    const bandwidth =
      product.bandwidthLabel?.trim()
      || (product.bandwidthTb && product.bandwidthTb > 0 ? `${product.bandwidthTb}TB` : '?');
    const cpu = product.cpu?.trim() || '?';
    const price = `${billingLabel(product.billingCycle)} ${currencyPrefix(product.currency)}${(product.priceCents / 100).toFixed(2)}`;

    return {
      provider: product.provider.name,
      planName: product.planName,
      location: product.location,
      lineType: product.lineType,
      specs: `${cpu} / ${ram} / ${storage} / ${bandwidth}`,
      price,
      orderUrl: buildStockGoUrl(product.provider.slug, product.productId),
    };
  });

  const message = formatDailyStockDigest(lines);
  const chunks = chunkMessages(message);
  let messagesSent = 0;

  for (const chunk of chunks) {
    const messageId = await sendChannelMessage(PUBLIC_CHANNEL_ID, chunk, {
      disableWebPagePreview: true,
    });
    await prisma.telegramMessage.create({
      data: {
        channelId: PUBLIC_CHANNEL_ID,
        messageId,
        content: chunk,
        status: 'digest',
      },
    });
    messagesSent += 1;
  }

  const providers = new Set(lines.map((line) => line.provider)).size;
  logger.info(
    { products: lines.length, providers, messagesSent },
    'Daily stock digest published',
  );

  return { products: lines.length, providers, messagesSent };
}
