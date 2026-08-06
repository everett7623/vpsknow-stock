import { PrismaClient } from '@prisma/client';
import {
  AFFILIATE_CONFIGS,
  buildProductAffiliateUrl,
  buildStockGoUrl,
  extractWhmcsPid,
  generateAffiliateUrl,
  generateShortLinkSlug,
} from '@vpsknow/shared/affiliate-config';

const prisma = new PrismaClient();

/**
 * 更新所有 affiliate 链接
 *
 * 用途:
 * 1. 首次生成短链接
 * 2. 更新 affiliate ID 后重新生成
 * 3. 添加新 provider 后生成链接
 */
async function updateAffiliateLinks() {
  console.log('🔄 Updating affiliate links...\n');

  const providers = await prisma.provider.findMany({
    where: { isActive: true },
    include: { products: true },
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const provider of providers) {
    const config = AFFILIATE_CONFIGS[provider.slug];

    if (!config) {
      console.log(`⚠️  ${provider.name}: No affiliate config, skipping`);
      skipped++;
      continue;
    }

    if (config.affId === 'YOUR_AFF_ID') {
      console.log(`⚠️  ${provider.name}: Affiliate ID not configured, skipping`);
      skipped++;
      continue;
    }

    // Provider 级别链接 (通用)
    const providerSlug = generateShortLinkSlug(provider.slug);
    const providerTargetUrl = generateAffiliateUrl(provider.slug);

    const providerLink = await prisma.affiliateLink.upsert({
      where: { slug: providerSlug },
      update: { targetUrl: providerTargetUrl },
      create: {
        providerId: provider.id,
        slug: providerSlug,
        targetUrl: providerTargetUrl,
        shortUrl: buildStockGoUrl(provider.slug),
      },
    });

    if (providerLink.targetUrl === providerTargetUrl) {
      console.log(`✅ ${provider.name}: Provider link updated`);
      updated++;
    } else {
      console.log(`✨ ${provider.name}: Provider link created`);
      created++;
    }

    // 产品级别链接 (为所有产品生成短链接)
    // 如果 provider 支持 PID 且产品有 whmcsPid: 生成带 &pid=xxx 的链接
    // 否则: 保留产品的原始订单直连
    if (provider.products.length > 0) {
      let withPid = 0;
      let withoutPid = 0;

      for (const product of provider.products) {
        const productSlug = generateShortLinkSlug(provider.slug, product.productId);

        const extractedPid = product.orderUrl
          ? extractWhmcsPid(provider.slug, product.orderUrl, product.productId)
          : null;
        const whmcsPid = extractedPid ?? product.whmcsPid;
        const productTargetUrl = buildProductAffiliateUrl(
          provider.slug,
          product.orderUrl ?? provider.website,
          whmcsPid,
        );
        if (config.supportsPid && whmcsPid) {
          withPid++;
        } else {
          withoutPid++;
        }

        await prisma.affiliateLink.upsert({
          where: { slug: productSlug },
          update: {
            targetUrl: productTargetUrl,
            shortUrl: buildStockGoUrl(provider.slug, product.productId),
          },
          create: {
            providerId: provider.id,
            slug: productSlug,
            targetUrl: productTargetUrl,
            shortUrl: buildStockGoUrl(provider.slug, product.productId),
          },
        });
      }

      if (withPid > 0) {
        console.log(`   └─ ${withPid} product-specific links (with WHMCS PID)`);
      }
      if (withoutPid > 0) {
        console.log(`   └─ ${withoutPid} direct product links (no verified WHMCS PID)`);
      }
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   ✨ Created: ${created}`);
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`   ⚠️  Skipped: ${skipped}`);
}

async function main() {
  try {
    await updateAffiliateLinks();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
