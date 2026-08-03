import { prisma } from '@vpsknow/database';
import type { Prisma } from '@vpsknow/database';
import type { StockResult } from '@vpsknow/providers';
import { sendChannelMessage } from '@vpsknow/telegram';
import { formatRestockMessage } from '@vpsknow/telegram';
import {
  RESTOCK_COOLDOWN_MS,
  CONSECUTIVE_CONFIRMS_REQUIRED,
  buildProductAffiliateUrl,
  extractWhmcsPid,
} from '@vpsknow/shared';
import type { Logger } from 'pino';
import { notifyRestockSubscribers } from './subscriber-notifications.js';

const STOCK_CHANNEL_ID = process.env.TELEGRAM_STOCK_CHANNEL_ID || '@vpsknow_stock';

interface ProcessResult {
  checked: number;
  restocked: number;
  soldOut: number;
  errors: number;
}

function productLinkSlug(providerSlug: string, productId: string): string {
  const normalizedProductId = productId.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  return `${providerSlug}-${normalizedProductId}`;
}

function toStockEventMetadata(result: StockResult): Prisma.InputJsonObject {
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
    },
  };
}

export async function processStockResults(
  providerSlug: string,
  results: StockResult[],
  logger: Logger,
): Promise<ProcessResult> {
  const summary: ProcessResult = { checked: 0, restocked: 0, soldOut: 0, errors: 0 };

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

      const linkSlug = productLinkSlug(providerSlug, result.productId);
      const shortUrl = `https://stock.vpsknow.com/go/${linkSlug}`;
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

            // Send Telegram notification
            try {
              const message = formatRestockMessage(result, shortUrl);
              const msgId = await sendChannelMessage(STOCK_CHANNEL_ID, message);

              await prisma.telegramMessage.create({
                data: {
                  channelId: STOCK_CHANNEL_ID,
                  messageId: msgId,
                  stockEventId: event.id,
                  content: message,
                },
              });

              logger.info(
                { provider: providerSlug, product: result.planName, location: result.location },
                'RESTOCK notification sent',
              );
            } catch (tgErr) {
              logger.error(
                { provider: providerSlug, product: result.planName, err: tgErr },
                'Failed to send Telegram notification',
              );
            }

            await notifyRestockSubscribers(result, shortUrl, logger);
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
      }
      // previouslyInStock && nowInStock — still in stock, no action needed
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
