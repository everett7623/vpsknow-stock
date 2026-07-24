import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import pino from 'pino';
import { registry } from '@vpsknow/providers';
import { withJitter } from '@vpsknow/shared';
import { processStockResults } from './stock-engine.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

const QUEUE_NAME = 'stock-check';

const PROVIDER_INTERVALS: Record<string, number> = {
  bandwagonhost: 90_000,
  dmit: 150_000,
  buyvm: 90_000,
};

async function bootstrap(): Promise<void> {
  logger.info('VPSKnow Stock Worker starting...');

  const queue = new Queue(QUEUE_NAME, { connection });

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
        const summary = await processStockResults(provider, results, logger);

        logger.info(
          {
            provider,
            durationMs: duration,
            productsChecked: summary.checked,
            restocked: summary.restocked,
            soldOut: summary.soldOut,
            errors: summary.errors,
          },
          'Stock check complete',
        );
      } catch (err) {
        const duration = Date.now() - startTime;
        logger.error({ provider, durationMs: duration, err }, 'Stock check failed');
        throw err;
      }
    },
    {
      connection,
      concurrency: 3,
      limiter: { max: 1, duration: 5_000 },
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Job failed');
  });

  const shutdown = async (): Promise<void> => {
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

bootstrap().catch((err: unknown) => {
  logger.fatal({ err }, 'Worker failed to start');
  process.exit(1);
});
