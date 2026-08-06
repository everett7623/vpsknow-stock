import { prisma } from '@vpsknow/database';
import type { Prisma } from '@vpsknow/database';
import type { StockResult } from '@vpsknow/providers';
import {
  RESTOCK_COOLDOWN_MS,
  CONSECUTIVE_CONFIRMS_REQUIRED,
  buildProductAffiliateUrl,
  buildStockGoUrl,
  extractWhmcsPid,
  generateShortLinkSlug,
} from '@vpsknow/shared';
import type { Logger } from 'pino';
import { notifyRestockSubscribers } from './subscriber-notifications.js';
import {
  deliverRestockNotification,
  retryPendingRestockNotification,
} from './restock-notifications.js';

interface ProcessResult {
  checked: number;
  restocked: number;
  soldOut: number;
  errors: number;
}

function vmrackNotificationGroupKey(result: StockResult): string | null {
  const planSeries = result.planName.match(/\b((?:L\d\.)?B?VPS)\.(DC\d+)(?:\.|$)/i);
  if (!planSeries) return null;

  return [
    planSeries[1]!.toLowerCase(),
    planSeries[2]!.toLowerCase(),
    result.location.trim().toLowerCase(),
    result.category,
    result.storageGb,
    result.storageType.trim().toLowerCase(),
    result.bandwidthTb,
    result.ipv4,
    result.ipv6,
    result.currency.toUpperCase(),
    result.billingCycle,
  ].join('|');
}

function restockNotificationProductIds(providerSlug: string, results: StockResult[]): Set<string> {
  const selected = new Set(results.map((result) => result.productId));
  if (providerSlug !== 'vmrack') return selected;

  const lowestPricedByGroup = new Map<string, StockResult>();
  for (const result of results) {
    if (!result.inStock || result.price <= 0) continue;

    const groupKey = vmrackNotificationGroupKey(result);
    if (!groupKey) continue;

    const current = lowestPricedByGroup.get(groupKey);
    if (
      !current ||
      result.price < current.price ||
      (result.price === current.price && result.ramMb < current.ramMb)
    ) {
      lowestPricedByGroup.set(groupKey, result);
    }
  }

  for (const result of results) {
    const groupKey = vmrackNotificationGroupKey(result);
    const selectedResult = groupKey ? lowestPricedByGroup.get(groupKey) : undefined;
    if (selectedResult && selectedResult.productId !== result.productId) {
      selected.delete(result.productId);
    }
  }

  return selected;
}

function toStockEventMetadata(result: StockResult): Prisma.InputJsonObject {
  const displaySpecs = result.displaySpecs
    ? {
        ...(result.displaySpecs.storage ? { storage: result.displaySpecs.storage } : {}),
        ...(result.displaySpecs.bandwidth ? { bandwidth: result.displaySpecs.bandwidth } : {}),
        ...(result.displaySpecs.port ? { port: result.displaySpecs.port } : {}),
        ...(result.displaySpecs.remark ? { remark: result.displaySpecs.remark } : {}),
      }
    : null;

  return {
    result: {
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
      ...(displaySpecs ? { displaySpecs } : {}),
    },
  };
}

export async function processStockResults(
  providerSlug: string,
  results: StockResult[],
  logger: Logger,
): Promise<ProcessResult> {
  const summary: ProcessResult = { checked: 0, restocked: 0, soldOut: 0, errors: 0 };
  const notificationProductIds = restockNotificationProductIds(providerSlug, results);

  // Find provider
  const provider = await prisma.provider.findUnique({
    where: { slug: providerSlug },
    include: { affiliateLinks: true },
  });

  if (!provider) {
    logger.warn({ providerSlug }, 'Provider not found in DB');
    return summary;
  }

  for (const result of results) {
    summary.checked++;

    try {
      const productIdentity = {
        providerId_productId: {
          providerId: provider.id,
          productId: result.productId,
        },
      };
      const existingProduct = await prisma.product.findUnique({
        where: productIdentity,
        select: { id: true },
      });
      const isNewProduct = existingProduct === null;
      const whmcsPid = extractWhmcsPid(providerSlug, result.orderUrl, result.productId);

      // Upsert product
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

      const linkSlug = generateShortLinkSlug(providerSlug, result.productId);
      const shortUrl = buildStockGoUrl(providerSlug, result.productId);
      const targetUrl = buildProductAffiliateUrl(providerSlug, result.orderUrl, whmcsPid);
      const existingProductLink = provider.affiliateLinks.find((link) => link.slug === linkSlug);
      if (
        !existingProductLink ||
        existingProductLink.targetUrl !== targetUrl ||
        existingProductLink.shortUrl !== shortUrl
      ) {
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

      // Record stock check
      await prisma.stockCheck.create({
        data: {
          productId: product.id,
          inStock: result.inStock,
          priceCents: result.price,
        },
      });

      if (isNewProduct) {
        logger.info(
          { provider: providerSlug, product: result.planName, inStock: result.inStock },
          'New product baseline recorded without notification',
        );
        continue;
      }

      // Detect state transition
      const previouslyInStock = product.inStock;
      const nowInStock = result.inStock;

      if (!previouslyInStock && nowInStock) {
        // Potential restock — increment consecutive confirm
        const newConfirm = product.consecutiveConfirm + 1;

        if (newConfirm >= CONSECUTIVE_CONFIRMS_REQUIRED) {
          // Check cooldown: don't re-notify within RESTOCK_COOLDOWN_MS
          const cooldownCutoff = new Date(Date.now() - RESTOCK_COOLDOWN_MS);
          const recentEvent = await prisma.stockEvent.findFirst({
            where: {
              productId: product.id,
              eventType: 'restock',
              detectedAt: { gte: cooldownCutoff },
            },
          });

          if (!recentEvent) {
            // Fire restock event
            const event = await prisma.stockEvent.create({
              data: {
                productId: product.id,
                eventType: 'restock',
                metadata: toStockEventMetadata(result),
              },
            });

            // Update product state
            await prisma.product.update({
              where: { id: product.id },
              data: {
                inStock: true,
                consecutiveConfirm: 0,
                lastStockChangeAt: new Date(),
              },
            });

            if (notificationProductIds.has(result.productId)) {
              const delivered = await deliverRestockNotification(
                event.id,
                result,
                shortUrl,
                logger,
              );
              if (!delivered) summary.errors++;

              await notifyRestockSubscribers(result, shortUrl, logger);
            } else {
              logger.debug(
                { provider: providerSlug, product: result.planName },
                'RESTOCK notification suppressed in favor of lower-priced VMRack configuration',
              );
            }
            summary.restocked++;
          } else {
            logger.debug(
              { provider: providerSlug, product: result.planName },
              'Restock detected but within cooldown window',
            );
            await prisma.product.update({
              where: { id: product.id },
              data: { inStock: true, consecutiveConfirm: 0, lastStockChangeAt: new Date() },
            });

            if (notificationProductIds.has(result.productId)) {
              const retryResult = await retryPendingRestockNotification(
                product.id,
                result,
                shortUrl,
                logger,
              );
              if (retryResult === 'failed') summary.errors++;
            }
          }
        } else {
          // Not enough confirmations yet
          await prisma.product.update({
            where: { id: product.id },
            data: { consecutiveConfirm: newConfirm },
          });
          logger.debug(
            { provider: providerSlug, product: result.planName, confirm: newConfirm },
            'Restock pending confirmation',
          );
        }
      } else if (previouslyInStock && !nowInStock) {
        // Sold out
        await prisma.product.update({
          where: { id: product.id },
          data: {
            inStock: false,
            consecutiveConfirm: 0,
            lastStockChangeAt: new Date(),
          },
        });

        await prisma.stockEvent.create({
          data: {
            productId: product.id,
            eventType: 'sold_out',
            metadata: toStockEventMetadata(result),
          },
        });

        summary.soldOut++;
        logger.info(
          { provider: providerSlug, product: result.planName, location: result.location },
          'Product sold out',
        );
      } else if (!previouslyInStock && !nowInStock) {
        // Still out of stock — reset consecutive confirm
        if (product.consecutiveConfirm > 0) {
          await prisma.product.update({
            where: { id: product.id },
            data: { consecutiveConfirm: 0 },
          });
        }
      } else {
        if (notificationProductIds.has(result.productId)) {
          const retryResult = await retryPendingRestockNotification(
            product.id,
            result,
            shortUrl,
            logger,
          );
          if (retryResult === 'failed') summary.errors++;
        }
      }
    } catch (err) {
      summary.errors++;
      logger.error(
        { provider: providerSlug, productId: result.productId, err },
        'Error processing stock result',
      );
    }
  }

  return summary;
}
