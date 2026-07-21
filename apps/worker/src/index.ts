import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import pino from 'pino';
import { registry, type StockResult } from '@vpsknow/providers';
import { prisma } from '@vpsknow/database';
import type { Prisma, Product } from '@vpsknow/database';
import { formatRestockMessage, sendChannelMessage } from '@vpsknow/telegram';
import { withJitter, CONSECUTIVE_CONFIRMS_REQUIRED, RESTOCK_COOLDOWN_MS } from '@vpsknow/shared';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const STOCK_CHANNEL_ID = process.env.TELEGRAM_STOCK_CHANNEL_ID;

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

const QUEUE_NAME = 'stock-check';

const PROVIDER_INTERVALS: Record<string, number> = {
  bandwagonhost: 90_000, // 1.5 min
  dmit: 150_000, // 2.5 min
  buyvm: 90_000, // 1.5 min
};

async function bootstrap() {
  logger.info('VPSKnow Stock Worker starting...');

  const queue = new Queue(QUEUE_NAME, { connection });

  // Register repeatable jobs for each provider
  for (const [slug] of registry) {
    const interval = PROVIDER_INTERVALS[slug] || 180_000;
    const jittered = Math.round(withJitter(interval));

    await queue.upsertJobScheduler(
      `check-${slug}`,
      { every: jittered },
      { name: `check-${slug}`, data: { provider: slug } },
    );

    logger.info({ provider: slug, intervalMs: jittered }, 'Registered job scheduler');
  }

  // Process jobs
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { provider } = job.data as { provider: string };
      const adapter = registry.get(provider);
      if (!adapter) {
        logger.warn({ provider }, 'Unknown provider, skipping');
        return;
      }

      const startTime = Date.now();
      try {
        const results = await adapter.check();
        const duration = Date.now() - startTime;

        logger.info(
          {
            provider,
            durationMs: duration,
            productsChecked: results.length,
            inStock: results.filter((r) => r.inStock).length,
          },
          'Stock check complete',
        );

        await processProviderResults(provider, results, duration);
      } catch (err) {
        const duration = Date.now() - startTime;
        logger.error(
          { provider, durationMs: duration, err },
          'Stock check failed',
        );
        throw err; // Let BullMQ handle retry
      }
    },
    {
      connection,
      concurrency: 3,
      limiter: { max: 1, duration: 5_000 }, // max 1 job per 5s globally
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Job failed');
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down worker...');
    await worker.close();
    await queue.close();
    await connection.quit();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  logger.info('Worker is running. Waiting for jobs...');
}

async function processProviderResults(providerSlug: string, results: StockResult[], responseMs?: number) {
  const now = new Date();

  const provider = await prisma.provider.upsert({
    where: { slug: providerSlug },
    create: { slug: providerSlug, name: providerSlug, website: '' },
    update: {},
  });

  for (const result of results) {
    const product = await prisma.product.upsert({
      where: { providerId_productId: { providerId: provider.id, productId: result.productId } },
      create: {
        providerId: provider.id,
        productId: result.productId,
        planName: result.planName,
        category: result.category,
        location: result.location,
        cpu: result.cpu,
        ramMb: result.ramMb,
        storageGb: result.storageGb,
        storageType: result.storageType,
        bandwidthTb: result.bandwidthTb,
        priceCents: result.price,
        currency: result.currency,
        billingCycle: result.billingCycle,
        orderUrl: result.orderUrl,
        inStock: false,
        consecutiveConfirm: 0,
      },
      update: {
        planName: result.planName,
        category: result.category,
        location: result.location,
        cpu: result.cpu,
        ramMb: result.ramMb,
        storageGb: result.storageGb,
        storageType: result.storageType,
        bandwidthTb: result.bandwidthTb,
        priceCents: result.price,
        currency: result.currency,
        billingCycle: result.billingCycle,
        orderUrl: result.orderUrl,
      },
    });

    const raw: Prisma.InputJsonValue = {
      provider: result.provider,
      productId: result.productId,
      planName: result.planName,
      location: result.location,
      category: result.category,
      cpu: result.cpu,
      ramMb: result.ramMb,
      storageGb: result.storageGb,
      storageType: result.storageType,
      bandwidthTb: result.bandwidthTb,
      ipv4: result.ipv4,
      ipv6: result.ipv6,
      price: result.price,
      currency: result.currency,
      billingCycle: result.billingCycle,
      inStock: result.inStock,
      orderUrl: result.orderUrl,
    };

    await prisma.stockCheck.create({
      data: {
        productId: product.id,
        inStock: result.inStock,
        responseMs,
        raw,
      },
    });

    const wasInStock = product.inStock;
    let consecutiveConfirm = product.consecutiveConfirm;
    if (result.inStock) {
      consecutiveConfirm += 1;
    } else {
      consecutiveConfirm = 0;
    }

    const confirmedInStock = result.inStock && consecutiveConfirm >= CONSECUTIVE_CONFIRMS_REQUIRED;

    if (!wasInStock && confirmedInStock) {
      const recentRestock = await prisma.stockEvent.findFirst({
        where: {
          productId: product.id,
          eventType: 'restock',
          detectedAt: { gte: new Date(now.getTime() - RESTOCK_COOLDOWN_MS) },
        },
        orderBy: { detectedAt: 'desc' },
      });

      if (!recentRestock) {
        const metadata: Prisma.InputJsonValue = {
          provider: providerSlug,
          productId: result.productId,
          price: result.price,
        };

        const event = await prisma.stockEvent.create({
          data: {
            productId: product.id,
            eventType: 'restock',
            metadata,
          },
        });

        await prisma.product.update({
          where: { id: product.id },
          data: {
            inStock: true,
            lastStockChangeAt: now,
            lastCheckedAt: now,
            consecutiveConfirm,
          },
        });

        await notifyRestock(product, result, providerSlug, event.id);
        continue;
      }
    }

    if (wasInStock && !result.inStock) {
      const metadata: Prisma.InputJsonValue = {
        provider: providerSlug,
        productId: result.productId,
      };

      await prisma.stockEvent.create({
        data: {
          productId: product.id,
          eventType: 'sold_out',
          metadata,
        },
      });

      await prisma.product.update({
        where: { id: product.id },
        data: {
          inStock: false,
          lastStockChangeAt: now,
          lastCheckedAt: now,
          consecutiveConfirm,
        },
      });

      continue;
    }

    await prisma.product.update({
      where: { id: product.id },
      data: {
        lastCheckedAt: now,
        consecutiveConfirm,
      },
    });
  }
}

async function notifyRestock(product: Product, result: StockResult, providerSlug: string, eventId: string) {
  if (!STOCK_CHANNEL_ID) {
    logger.warn({ provider: providerSlug, productId: product.productId }, 'TELEGRAM_STOCK_CHANNEL_ID not set, skipping notification');
    return;
  }

  const affiliate = await prisma.affiliateLink.findFirst({
    where: { providerId: product.providerId },
  });

  const affiliateUrl = affiliate?.shortUrl ?? result.orderUrl;
  const text = formatRestockMessage(result, affiliateUrl);

  try {
    const messageId = await sendChannelMessage(STOCK_CHANNEL_ID, text);
    await prisma.telegramMessage.create({
      data: {
        channelId: STOCK_CHANNEL_ID,
        messageId,
        stockEventId: eventId,
        content: text,
        status: 'sent',
      },
    });
  } catch (err) {
    logger.error({ err, provider: providerSlug, productId: product.productId }, 'Failed to send Telegram restock notification');
  }
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Worker failed to start');
  process.exit(1);
});
