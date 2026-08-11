import { prisma } from '@vpsknow/database';
import {
  parseVmissTgChannelHtml,
  VMISS_TG_CHANNEL_URL,
  type VmissTgSignal,
} from '@vpsknow/parsers';
import {
  VMISS_CATALOG,
  type StockResult,
  type VmissCatalogPlan,
} from '@vpsknow/providers';
import {
  RESTOCK_COOLDOWN_MS,
  buildProductAffiliateUrl,
  buildStockGoUrl,
  extractWhmcsPid,
  generateShortLinkSlug,
} from '@vpsknow/shared';
import type { Logger } from 'pino';
import { deliverRestockNotification } from './restock-notifications.js';
import { notifyRestockSubscribers } from './subscriber-notifications.js';

interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
}

const LAST_MESSAGE_KEY = 'vmiss-tg:last-message-id';
const REQUEST_TIMEOUT_MS = 15_000;

export interface VmissTgDiscoverySummary {
  fetched: number;
  newSignals: number;
  restocked: number;
  soldOut: number;
  skipped: number;
  errors: number;
  baseline: boolean;
}

function orderUrlForPid(pid: string): string {
  return `https://app.vmiss.com/cart.php?a=add&pid=${pid}`;
}

function findCatalogPlan(signal: VmissTgSignal): VmissCatalogPlan | undefined {
  const byName = VMISS_CATALOG.find(
    (plan) => plan.planName.toLowerCase() === signal.planName.toLowerCase(),
  );
  if (byName) return byName;
  if (!signal.pid) return undefined;
  return VMISS_CATALOG.find((plan) => plan.pid === signal.pid);
}

function locationFrom(signal: VmissTgSignal, catalog: VmissCatalogPlan | undefined): string {
  if (catalog) return catalog.location;
  const hint = signal.locationHint ?? '';
  if (/香港|Hong Kong/i.test(hint)) return 'Hong Kong';
  if (/东京|Tokyo|TKY/i.test(hint)) return 'Tokyo';
  if (/大阪|Osaka/i.test(hint)) return 'Osaka';
  if (/首尔|Seoul/i.test(hint)) return 'Seoul';
  if (/洛杉|Los Angeles|LA/i.test(hint)) return 'Los Angeles';
  return 'Unknown';
}

export function stockResultFromVmissTgSignal(signal: VmissTgSignal): StockResult | null {
  const catalog = findCatalogPlan(signal);
  // Stable product identity prefers our catalog PID; checkout URL prefers live TG pid.
  const productPid = catalog?.pid ?? signal.pid;
  const orderPid = signal.pid ?? catalog?.pid;
  if (!productPid || !orderPid) return null;

  const cpu = catalog
    ? `${catalog.cpuCores} Core${catalog.cpuCores === 1 ? '' : 's'}`
    : signal.cpu;
  const ramMb = catalog?.ramMb ?? signal.ramMb;
  const storageGb = catalog?.storageGb ?? signal.storageGb;
  const bandwidthTb = catalog?.bandwidthTb ?? signal.bandwidthTb;
  const portMbps = catalog?.portMbps ?? signal.portMbps;
  const price = catalog?.priceCents ?? signal.priceCents ?? 0;
  const currency = catalog?.currency ?? signal.currency ?? 'CAD';

  return {
    provider: 'vmiss',
    productId: `vmiss-${productPid}`,
    planName: catalog?.planName ?? signal.planName,
    location: locationFrom(signal, catalog),
    category: 'vps',
    cpu,
    ramMb,
    storageGb,
    storageType: signal.storageType || 'SSD',
    bandwidthTb,
    ipv4: true,
    ipv6: false,
    price,
    currency,
    billingCycle: catalog?.billingCycle ?? 'monthly',
    inStock: signal.inStock,
    orderUrl: orderUrlForPid(orderPid),
    ...(portMbps > 0 ? { displaySpecs: { port: `${portMbps}Mbps` } } : {}),
    raw: {
      source: 'vmiss-tg',
      messageId: signal.messageId,
      statusAt: signal.statusAt?.toISOString() ?? null,
      tgPid: signal.pid,
    },
  };
}

async function fetchChannelHtml(): Promise<string> {
  const response = await fetch(VMISS_TG_CHANNEL_URL, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'VPSKnow-Stock/1.0',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`VMISS TG channel HTTP ${response.status}`);
  }
  return response.text();
}

async function processSignal(
  signal: VmissTgSignal,
  result: StockResult,
  logger: Logger,
): Promise<'restocked' | 'sold_out' | 'skipped' | 'error'> {
  const provider = await prisma.provider.findUnique({
    where: { slug: 'vmiss' },
    include: { affiliateLinks: true },
  });
  // Provider may be website-inactive (catalog hidden) while TG ingest stays on.
  if (!provider) {
    logger.warn('VMISS provider missing from database — skipping TG signal');
    return 'skipped';
  }

  const productIdentity = {
    providerId_productId: {
      providerId: provider.id,
      productId: result.productId,
    },
  };

  const existing = await prisma.product.findUnique({
    where: productIdentity,
    select: {
      id: true,
      inStock: true,
      availabilitySource: true,
    },
  });

  const whmcsPid = extractWhmcsPid('vmiss', result.orderUrl, result.productId);
  const bandwidthLabel = result.displaySpecs?.bandwidth?.trim() || null;
  const port = result.displaySpecs?.port;

  const product = await prisma.product.upsert({
    where: productIdentity,
    update: {
      planName: result.planName,
      location: result.location,
      category: result.category,
      cpu: result.cpu,
      ramMb: result.ramMb,
      storageGb: result.storageGb,
      storageType: result.storageType,
      bandwidthTb: result.bandwidthTb,
      bandwidthLabel,
      ipv4: result.ipv4,
      availabilitySource: 'live',
      priceCents: result.price,
      currency: result.currency,
      billingCycle: result.billingCycle,
      orderUrl: result.orderUrl,
      ...(whmcsPid ? { whmcsPid } : {}),
      lastCheckedAt: new Date(),
    },
    create: {
      providerId: provider.id,
      productId: result.productId,
      planName: result.planName,
      location: result.location,
      category: result.category,
      cpu: result.cpu,
      ramMb: result.ramMb,
      storageGb: result.storageGb,
      storageType: result.storageType,
      bandwidthTb: result.bandwidthTb,
      bandwidthLabel,
      ipv4: result.ipv4,
      availabilitySource: 'live',
      priceCents: result.price,
      currency: result.currency,
      billingCycle: result.billingCycle,
      orderUrl: result.orderUrl,
      whmcsPid,
      inStock: result.inStock,
      consecutiveConfirm: 0,
      lastCheckedAt: new Date(),
    },
  });

  const linkSlug = generateShortLinkSlug('vmiss', result.productId);
  const shortUrl = buildStockGoUrl('vmiss', result.productId);
  const targetUrl = buildProductAffiliateUrl('vmiss', result.orderUrl, whmcsPid);
  const existingLink = provider.affiliateLinks.find((link) => link.slug === linkSlug);
  if (!existingLink || existingLink.targetUrl !== targetUrl || existingLink.shortUrl !== shortUrl) {
    await prisma.affiliateLink.upsert({
      where: { slug: linkSlug },
      update: { targetUrl, shortUrl },
      create: {
        providerId: provider.id,
        slug: linkSlug,
        targetUrl,
        shortUrl,
      },
    });
  }

  await prisma.stockCheck.create({
    data: {
      productId: product.id,
      inStock: result.inStock,
      priceCents: result.price,
    },
  });

  // First-seen product: baseline only (no notify), same as stock-engine.
  if (!existing) {
    logger.info(
      { product: result.planName, messageId: signal.messageId, inStock: result.inStock },
      'VMISS TG new product baseline recorded without notification',
    );
    return 'skipped';
  }

  const wasCatalogOnly = existing.availabilitySource === 'catalog';
  const previouslyInStock = existing.inStock && !wasCatalogOnly;
  const nowInStock = result.inStock;

  if (!previouslyInStock && nowInStock) {
    const cooldownCutoff = new Date(Date.now() - RESTOCK_COOLDOWN_MS);
    const recentEvent = await prisma.stockEvent.findFirst({
      where: {
        productId: product.id,
        eventType: 'restock',
        detectedAt: { gte: cooldownCutoff },
      },
    });

    await prisma.product.update({
      where: { id: product.id },
      data: {
        inStock: true,
        consecutiveConfirm: 0,
        lastStockChangeAt: new Date(),
        availabilitySource: 'live',
      },
    });

    if (recentEvent) {
      logger.debug(
        { product: result.planName, messageId: signal.messageId },
        'VMISS TG restock within cooldown',
      );
      return 'skipped';
    }

    const event = await prisma.stockEvent.create({
      data: {
        productId: product.id,
        eventType: 'restock',
        metadata: {
          source: 'vmiss-tg',
          messageId: signal.messageId,
          planName: result.planName,
          location: result.location,
          price: result.price,
          currency: result.currency,
          orderUrl: result.orderUrl,
          ...(port ? { port } : {}),
        },
      },
    });

    const delivered = await deliverRestockNotification(event.id, result, shortUrl, logger);
    await notifyRestockSubscribers(result, shortUrl, logger);
    if (!delivered) {
      logger.warn({ product: result.planName }, 'VMISS TG restock channel delivery failed');
      return 'error';
    }

    logger.info(
      { product: result.planName, messageId: signal.messageId, location: result.location },
      'VMISS TG restock notified',
    );
    return 'restocked';
  }

  if (previouslyInStock && !nowInStock) {
    await prisma.product.update({
      where: { id: product.id },
      data: {
        inStock: false,
        consecutiveConfirm: 0,
        lastStockChangeAt: new Date(),
        availabilitySource: 'live',
      },
    });
    await prisma.stockEvent.create({
      data: {
        productId: product.id,
        eventType: 'sold_out',
        metadata: {
          source: 'vmiss-tg',
          messageId: signal.messageId,
          planName: result.planName,
          location: result.location,
        },
      },
    });
    logger.info(
      { product: result.planName, messageId: signal.messageId },
      'VMISS TG sold out recorded',
    );
    return 'sold_out';
  }

  // Catalog rows that were falsely inStock: apply sold-out without prior live stock.
  if (wasCatalogOnly && !nowInStock) {
    await prisma.product.update({
      where: { id: product.id },
      data: {
        inStock: false,
        consecutiveConfirm: 0,
        lastStockChangeAt: new Date(),
        availabilitySource: 'live',
      },
    });
    return 'skipped';
  }

  return 'skipped';
}

export async function discoverVmissTgSignals(
  redis: RedisLike,
  logger: Logger,
  fetchHtml: () => Promise<string> = fetchChannelHtml,
): Promise<VmissTgDiscoverySummary> {
  const summary: VmissTgDiscoverySummary = {
    fetched: 0,
    newSignals: 0,
    restocked: 0,
    soldOut: 0,
    skipped: 0,
    errors: 0,
    baseline: false,
  };

  const html = await fetchHtml();
  const signals = parseVmissTgChannelHtml(html);
  summary.fetched = signals.length;
  if (signals.length === 0) {
    logger.warn('VMISS TG channel returned no parseable signals');
    return summary;
  }

  const maxId = signals[signals.length - 1]!.messageId;
  const lastRaw = await redis.get(LAST_MESSAGE_KEY);
  if (!lastRaw) {
    await redis.set(LAST_MESSAGE_KEY, String(maxId));
    summary.baseline = true;
    summary.skipped = signals.length;
    logger.info({ lastMessageId: maxId, fetched: signals.length }, 'VMISS TG baseline established');
    return summary;
  }

  const lastId = Number.parseInt(lastRaw, 10);
  const fresh = signals.filter((signal) => signal.messageId > lastId);
  summary.newSignals = fresh.length;

  for (const signal of fresh) {
    try {
      const result = stockResultFromVmissTgSignal(signal);
      if (!result) {
        summary.skipped++;
        logger.warn({ messageId: signal.messageId, planName: signal.planName }, 'VMISS TG signal missing PID');
        continue;
      }
      const outcome = await processSignal(signal, result, logger);
      if (outcome === 'restocked') summary.restocked++;
      else if (outcome === 'sold_out') summary.soldOut++;
      else if (outcome === 'error') summary.errors++;
      else summary.skipped++;
    } catch (error) {
      summary.errors++;
      logger.error({ err: error, messageId: signal.messageId }, 'VMISS TG signal processing failed');
    }
  }

  if (maxId > lastId) {
    await redis.set(LAST_MESSAGE_KEY, String(maxId));
  }

  return summary;
}

