import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import pino from 'pino';
import { registry } from '@vpsknow/providers';
import {
  ADAPTER_DEGRADED_THRESHOLD,
  ADAPTER_PAUSED_THRESHOLD,
  withJitter,
} from '@vpsknow/shared';
import { sendChannelMessage } from '@vpsknow/telegram';
import { prisma } from '@vpsknow/database';
import {
  formatProviderFailureAlert,
  formatProviderRecoveryAlert,
  isProviderPaused,
  recordProviderFailure,
  recordProviderSuccess,
} from './provider-health.js';
import { discoverLetOffers } from './offers-engine.js';
import { processStockResults } from './stock-engine.js';
import { runDataRetention } from './maintenance.js';
import { startHealthServer, type HealthCheckResult } from './health.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

const QUEUE_NAME = 'stock-check';
const OFFER_QUEUE_NAME = 'offer-discovery';
const MAINTENANCE_QUEUE_NAME = 'maintenance';
const HEALTH_PORT = Number.parseInt(process.env.HEALTH_PORT || '3001', 10);

const PROVIDER_INTERVALS: Record<string, number> = {
  // S-Tier
  bandwagonhost: 90_000,
  dmit: 120_000,
  buyvm: 90_000,
  greencloudvps: 180_000,
  spartanhost: 150_000,
  vmiss: 180_000,
  vps: 300_000,
  saltyfish: 300_000,
  // A-Tier
  racknerd: 180_000,
  clouvider: 180_000,
  liteserver: 180_000,
  crunchbits: 180_000,
  servarica: 180_000,
  evoxt: 180_000,
  alwyzon: 180_000,
  dedirock: 180_000,
  onidel: 180_000,
  bagevm: 180_000,
  // B-Tier
  tierhive: 300_000,
  gullos: 300_000,
  webhorizon: 300_000,
  vmrack: 300_000,
  gomami: 300_000,
  zgocloud: 300_000,
  colocrossing: 300_000,
  chicagovps: 300_000,
  lightlayer: 300_000,
  speedypage: 300_000,
};

async function bootstrap(): Promise<void> {
  logger.info('VPSKnow Stock Worker starting...');

  const queue = new Queue(QUEUE_NAME, { connection });
  const offerQueue = new Queue(OFFER_QUEUE_NAME, { connection });
  const maintenanceQueue = new Queue(MAINTENANCE_QUEUE_NAME, { connection });

  await maintenanceQueue.upsertJobScheduler(
    'delete-expired-stock-checks',
    { every: 24 * 60 * 60 * 1_000 },
    {
      name: 'delete-expired-stock-checks',
      data: {},
      opts: { attempts: 3, backoff: { type: 'exponential', delay: 30_000 } },
    },
  );

  await offerQueue.upsertJobScheduler(
    'discover-lowendtalk-offers',
    { every: Math.round(withJitter(150_000)) },
    {
      name: 'discover-lowendtalk-offers',
      data: {},
      opts: { attempts: 3, backoff: { type: 'exponential', delay: 5_000 } },
    },
  );

  for (const [slug] of registry) {
    const interval = PROVIDER_INTERVALS[slug] || 180_000;
    const jittered = Math.round(withJitter(interval));

    await queue.upsertJobScheduler(
      `check-${slug}`,
      { every: jittered },
      {
        name: `check-${slug}`,
        data: { provider: slug },
        opts: { attempts: 3, backoff: { type: 'exponential', delay: 5_000 } },
      },
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

      const providerConfig = await prisma.provider.findUnique({
        where: { slug: provider },
        select: { isActive: true },
      });
      if (!providerConfig?.isActive) {
        logger.info({ provider }, 'Provider monitoring is disabled');
        return;
      }

      if (await isProviderPaused(connection, provider)) {
        logger.warn({ provider }, 'Provider is paused after repeated failures');
        return;
      }

      const startTime = Date.now();
      try {
        const results = await adapter.check();
        const duration = Date.now() - startTime;
        const summary = await processStockResults(provider, results, logger);
        if (adapter.warnings?.length) {
          logger.warn(
            { provider, warnings: adapter.warnings },
            'Provider check completed with partial failures',
          );
        }
        const previousFailures = await recordProviderSuccess(connection, provider);

        if (previousFailures >= ADAPTER_DEGRADED_THRESHOLD && ADMIN_CHAT_ID) {
          try {
            await sendChannelMessage(
              ADMIN_CHAT_ID,
              formatProviderRecoveryAlert(provider, previousFailures),
            );
          } catch (notificationError) {
            logger.error({ provider, err: notificationError }, 'Failed to send provider recovery alert');
          }
        }

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
        const failureState = await recordProviderFailure(connection, provider);

        logger.error(
          { provider, durationMs: duration, failures: failureState.failures, err },
          'Stock check failed',
        );

        if (failureState.degraded && failureState.failures === ADAPTER_DEGRADED_THRESHOLD) {
          logger.warn({ provider }, 'Provider marked degraded after repeated failures');
        }

        if (failureState.paused && failureState.failures === ADAPTER_PAUSED_THRESHOLD) {
          logger.error({ provider }, 'Provider paused for five minutes after repeated failures');

          if (ADMIN_CHAT_ID) {
            try {
              await sendChannelMessage(
                ADMIN_CHAT_ID,
                formatProviderFailureAlert(provider, failureState, duration, err),
              );
            } catch (notificationError) {
              logger.error({ provider, err: notificationError }, 'Failed to send provider pause alert');
            }
          }
        }

        throw err;
      }
    },
    {
      connection,
      concurrency: 3,
      limiter: { max: 1, duration: 5_000 },
    },
  );

  const offerWorker = new Worker(
    OFFER_QUEUE_NAME,
    async () => {
      const summary = await discoverLetOffers(connection);
      logger.info(summary, 'LowEndTalk offer discovery complete');
    },
    { connection, concurrency: 1 },
  );

  const maintenanceWorker = new Worker(
    MAINTENANCE_QUEUE_NAME,
    async () => {
      const summary = await runDataRetention();
      logger.info(summary, 'Data retention complete');
    },
    { connection, concurrency: 1 },
  );

  const healthServer = await startHealthServer({
    port: HEALTH_PORT,
    check: async (): Promise<HealthCheckResult> => {
      const dependencies: HealthCheckResult['dependencies'] = {
        database: 'healthy',
        redis: 'healthy',
      };

      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch {
        dependencies.database = 'unhealthy';
      }

      try {
        await connection.ping();
      } catch {
        dependencies.redis = 'unhealthy';
      }

      return {
        status: Object.values(dependencies).every((status) => status === 'healthy')
          ? 'healthy'
          : 'unhealthy',
        dependencies,
      };
    },
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Job failed');
  });
  offerWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Offer discovery job failed');
  });
  maintenanceWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Maintenance job failed');
  });

  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down worker...');
    await worker.close();
    await offerWorker.close();
    await maintenanceWorker.close();
    await new Promise<void>((resolve, reject) => {
      healthServer.close((error) => (error ? reject(error) : resolve()));
    });
    await queue.close();
    await offerQueue.close();
    await maintenanceQueue.close();
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
