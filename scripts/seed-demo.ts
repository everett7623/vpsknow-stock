#!/usr/bin/env tsx
/**
 * 演示数据种子脚本
 * 注入模拟的库存事件和优惠数据，用于展示网站功能
 *
 * 用法：npx tsx scripts/seed-demo.ts
 */

import { PrismaClient } from '@vpsknow/database';

const prisma = new PrismaClient();

const DEMO_RESTOCK_EVENTS = [
  { providerSlug: 'buyvm', productId: 'buyvm-slice-1024-lv', planName: 'KVM Slice 1024', location: 'Las Vegas', priceCents: 350, currency: 'USD', billingCycle: 'monthly' },
  { providerSlug: 'dmit', productId: 'dmit-pvm-lax-lite-v2', planName: 'PVM.LAX.Pro.STARTER', location: 'Los Angeles', priceCents: 1488, currency: 'USD', billingCycle: 'annually' },
  { providerSlug: 'bandwagonhost', productId: 'bwg-the-plan-dc6', planName: 'THE PLAN', location: 'DC6 CN2 GIA-E', priceCents: 4999, currency: 'USD', billingCycle: 'annually' },
  { providerSlug: 'hosthatch', productId: 'hosthatch-nvme-1gb-ams', planName: 'NVMe 1GB', location: 'Amsterdam', priceCents: 3500, currency: 'USD', billingCycle: 'annually' },
  { providerSlug: 'greencloudvps', productId: 'greencloud-budget-kvm-1gb-tok', planName: 'Budget KVM 1GB', location: 'Tokyo', priceCents: 1800, currency: 'USD', billingCycle: 'annually' },
  { providerSlug: 'spartanhost', productId: 'spartanhost-ryzen-1gb-sea', planName: 'Ryzen KVM 1GB', location: 'Seattle', priceCents: 500, currency: 'USD', billingCycle: 'monthly' },
  { providerSlug: 'racknerd', productId: 'racknerd-1gb-lax', planName: '1GB KVM VPS', location: 'Los Angeles', priceCents: 1099, currency: 'USD', billingCycle: 'annually' },
  { providerSlug: 'liteserver', productId: 'liteserver-vps-1gb-nl', planName: 'VPS 1GB', location: 'Netherlands', priceCents: 800, currency: 'USD', billingCycle: 'monthly' },
];

const DEMO_OFFERS = [
  {
    source: 'lowendtalk',
    sourceId: 'demo-let-001',
    provider: 'hosthatch',
    title: 'HostHatch - Annual NVMe VPS Sale',
    body: 'Annual deal on NVMe VPS servers across multiple locations',
    category: 'vps',
    locations: ['Amsterdam', 'Los Angeles', 'Singapore', 'Tokyo'],
    priceCents: 3500,
    currency: 'USD',
    billingCycle: 'annually',
    couponCode: null,
    orderUrl: 'https://hosthatch.com/vps',
    threadUrl: 'https://lowendtalk.com/discussion/demo-001',
    isLimitedStock: true,
    isRecurring: true,
    confidence: 0.92,
    postedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    source: 'lowendtalk',
    sourceId: 'demo-let-002',
    provider: 'racknerd',
    title: 'RackNerd Flash Sale - Multiple Locations',
    body: 'Flash sale on KVM VPS from $1.09/month',
    category: 'vps',
    locations: ['Los Angeles', 'New York', 'Chicago', 'Dallas'],
    priceCents: 1099,
    currency: 'USD',
    billingCycle: 'annually',
    couponCode: 'FLASH2026',
    orderUrl: 'https://racknerd.com',
    threadUrl: 'https://lowendtalk.com/discussion/demo-002',
    isLimitedStock: true,
    isRecurring: false,
    confidence: 0.88,
    postedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
  },
  {
    source: 'lowendtalk',
    sourceId: 'demo-let-003',
    provider: 'greencloudvps',
    title: 'GreenCloudVPS - Japan & Singapore Budget KVM',
    body: 'Budget KVM plans with optimized routing to Asia',
    category: 'vps',
    locations: ['Tokyo', 'Singapore', 'Hong Kong'],
    priceCents: 1800,
    currency: 'USD',
    billingCycle: 'annually',
    couponCode: null,
    orderUrl: 'https://greencloudvps.com',
    threadUrl: 'https://lowendtalk.com/discussion/demo-003',
    isLimitedStock: false,
    isRecurring: true,
    confidence: 0.85,
    postedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
  },
  {
    source: 'lowendtalk',
    sourceId: 'demo-let-004',
    provider: 'liteserver',
    title: 'LiteServer - Netherlands Storage VPS',
    body: 'High storage VPS in the Netherlands',
    category: 'storage',
    locations: ['Netherlands'],
    priceCents: 600,
    currency: 'USD',
    billingCycle: 'monthly',
    couponCode: null,
    orderUrl: 'https://liteserver.nl',
    threadUrl: 'https://lowendtalk.com/discussion/demo-004',
    isLimitedStock: false,
    isRecurring: true,
    confidence: 0.80,
    postedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
  },
];

async function seedDemoData() {
  console.log('🌱 开始注入演示数据...\n');

  // 注入演示补货事件
  console.log('📦 注入库存事件...');
  let restockCount = 0;

  for (const demo of DEMO_RESTOCK_EVENTS) {
    const provider = await prisma.provider.findUnique({
      where: { slug: demo.providerSlug },
    });
    if (!provider) {
      console.log(`  ⚠️  Provider 未找到: ${demo.providerSlug}`);
      continue;
    }

    // Upsert 产品
    const product = await prisma.product.upsert({
      where: {
        providerId_productId: {
          providerId: provider.id,
          productId: demo.productId,
        },
      },
      update: {
        inStock: true,
        lastCheckedAt: new Date(),
        lastStockChangeAt: new Date(Date.now() - Math.random() * 2 * 60 * 60 * 1000),
      },
      create: {
        providerId: provider.id,
        productId: demo.productId,
        planName: demo.planName,
        category: 'vps',
        location: demo.location,
        priceCents: demo.priceCents,
        currency: demo.currency,
        billingCycle: demo.billingCycle,
        inStock: true,
        lastCheckedAt: new Date(),
        lastStockChangeAt: new Date(Date.now() - Math.random() * 2 * 60 * 60 * 1000),
      },
    });

    // 创建补货事件
    await prisma.stockEvent.create({
      data: {
        productId: product.id,
        eventType: 'restock',
        detectedAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
        metadata: {
          result: {
            provider: demo.providerSlug,
            planName: demo.planName,
            location: demo.location,
            priceCents: demo.priceCents,
            currency: demo.currency,
            billingCycle: demo.billingCycle,
          },
        },
      },
    });

    restockCount++;
    console.log(`  ✅ ${provider.name} - ${demo.planName} (${demo.location})`);
  }

  // 注入演示优惠
  console.log(`\n🔥 注入 LET 优惠...`);
  let offerCount = 0;

  for (const offer of DEMO_OFFERS) {
    await prisma.offer.upsert({
      where: { sourceId: offer.sourceId },
      update: { pushed: true },
      create: {
        ...offer,
        pushed: true,
        discoveredAt: offer.postedAt ?? new Date(),
      },
    });
    offerCount++;
    console.log(`  ✅ ${offer.provider} - ${offer.title}`);
  }

  console.log(`
✅ 演示数据注入完成！
   📦 补货事件: ${restockCount} 条
   🔥 LET 优惠: ${offerCount} 条

🌐 访问 http://localhost:3000 查看效果
  `);
}

seedDemoData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
