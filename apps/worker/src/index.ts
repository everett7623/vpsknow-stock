import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import pino from 'pino';
import { registry } from '@vpsknow/providers';
import { withJitter } from '@vpsknow/shared';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

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

        // TODO (Task 1.4): Compare with DB state, detect transitions, fire events
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

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Worker failed to start');
  process.exit(1);
});
