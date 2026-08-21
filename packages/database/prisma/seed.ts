import { PrismaClient } from '@prisma/client';
import { ACTIVE_PROVIDER_SLUGS } from '@vpsknow/shared';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create providers
  const bandwagonhost = await prisma.provider.upsert({
    where: { slug: 'bandwagonhost' },
    update: {},
    create: {
      slug: 'bandwagonhost',
      name: 'BandwagonHost',
      website: 'https://bandwagonhost.com',
      tier: 'S',
    },
  });

  const dmit = await prisma.provider.upsert({
    where: { slug: 'dmit' },
    update: {},
    create: {
      slug: 'dmit',
      name: 'DMIT',
      website: 'https://www.dmit.io',
      tier: 'S',
    },
  });

  const buyvm = await prisma.provider.upsert({
    where: { slug: 'buyvm' },
    update: {},
    create: {
      slug: 'buyvm',
      name: 'BuyVM',
      website: 'https://buyvm.net',
      tier: 'S',
    },
  });

  const spartanhost = await prisma.provider.upsert({
    where: { slug: 'spartanhost' },
    update: {},
    create: {
      slug: 'spartanhost',
      name: 'SpartanHost',
      website: 'https://spartanhost.org',
      tier: 'S',
    },
  });

  const vmiss = await prisma.provider.upsert({
    where: { slug: 'vmiss' },
    update: {},
    create: {
      slug: 'vmiss',
      name: 'VMISS',
      website: 'https://www.vmiss.com',
      tier: 'S',
    },
  });

  const vps = await prisma.provider.upsert({
    where: { slug: 'vps' },
    update: {},
    create: {
      slug: 'vps',
      name: 'V.PS',
      website: 'https://v.ps',
      tier: 'S',
    },
  });

  const saltyfish = await prisma.provider.upsert({
    where: { slug: 'saltyfish' },
    update: {},
    create: {
      slug: 'saltyfish',
      name: 'SaltyFish',
      website: 'https://portal.saltyfish.io',
      tier: 'S',
    },
  });

  const greencloudvps = await prisma.provider.upsert({
    where: { slug: 'greencloudvps' },
    update: {},
    create: {
      slug: 'greencloudvps',
      name: 'GreenCloudVPS',
      website: 'https://greencloudvps.com',
      tier: 'S',
    },
  });

  // Phase 4 — A-Tier providers
  const racknerd = await prisma.provider.upsert({
    where: { slug: 'racknerd' },
    update: {},
    create: {
      slug: 'racknerd',
      name: 'RackNerd',
      website: 'https://racknerd.com',
      tier: 'A',
    },
  });

  const clouvider = await prisma.provider.upsert({
    where: { slug: 'clouvider' },
    update: {},
    create: {
      slug: 'clouvider',
      name: 'Clouvider',
      website: 'https://www.clouvider.com',
      tier: 'A',
    },
  });

  const liteserver = await prisma.provider.upsert({
    where: { slug: 'liteserver' },
    update: {},
    create: {
      slug: 'liteserver',
      name: 'LiteServer',
      website: 'https://liteserver.nl',
      tier: 'A',
    },
  });

  const crunchbits = await prisma.provider.upsert({
    where: { slug: 'crunchbits' },
    update: {},
    create: {
      slug: 'crunchbits',
      name: 'Crunchbits',
      website: 'https://crunchbits.com',
      tier: 'A',
    },
  });

  const servarica = await prisma.provider.upsert({
    where: { slug: 'servarica' },
    update: {},
    create: {
      slug: 'servarica',
      name: 'ServaRICA',
      website: 'https://servarica.com',
      tier: 'A',
    },
  });

  const evoxt = await prisma.provider.upsert({
    where: { slug: 'evoxt' },
    update: {},
    create: {
      slug: 'evoxt',
      name: 'Evoxt',
      website: 'https://evoxt.com',
      tier: 'A',
    },
  });

  const alwyzon = await prisma.provider.upsert({
    where: { slug: 'alwyzon' },
    update: {},
    create: {
      slug: 'alwyzon',
      name: 'Alwyzon',
      website: 'https://alwyzon.com',
      tier: 'A',
    },
  });

  const dedirock = await prisma.provider.upsert({
    where: { slug: 'dedirock' },
    update: {},
    create: {
      slug: 'dedirock',
      name: 'DediRock',
      website: 'https://dedirock.com',
      tier: 'A',
    },
  });

  const onidel = await prisma.provider.upsert({
    where: { slug: 'onidel' },
    update: {},
    create: {
      slug: 'onidel',
      name: 'Onidel',
      website: 'https://onidel.com',
      tier: 'A',
    },
  });

  const bagevm = await prisma.provider.upsert({
    where: { slug: 'bagevm' },
    update: {},
    create: {
      slug: 'bagevm',
      name: 'BageVM',
      website: 'https://www.bagevm.com',
      tier: 'A',
    },
  });

  // Phase 4 — B-Tier providers
  const tierhive = await prisma.provider.upsert({
    where: { slug: 'tierhive' },
    update: {},
    create: {
      slug: 'tierhive',
      name: 'TierHive',
      website: 'https://tierhive.com',
      tier: 'B',
    },
  });

  const gullos = await prisma.provider.upsert({
    where: { slug: 'gullos' },
    update: {},
    create: {
      slug: 'gullos',
      name: 'Gullos',
      website: 'https://gullos.com',
      tier: 'B',
    },
  });

  const webhorizon = await prisma.provider.upsert({
    where: { slug: 'webhorizon' },
    update: {},
    create: {
      slug: 'webhorizon',
      name: 'WebHorizon',
      website: 'https://webhorizon.in',
      tier: 'B',
    },
  });

  const vmrack = await prisma.provider.upsert({
    where: { slug: 'vmrack' },
    update: {},
    create: {
      slug: 'vmrack',
      name: 'VMRack',
      website: 'https://www.vmrack.net',
      tier: 'B',
    },
  });

  const gomami = await prisma.provider.upsert({
    where: { slug: 'gomami' },
    update: {},
    create: {
      slug: 'gomami',
      name: 'GoMami',
      website: 'https://gomami.io',
      tier: 'B',
    },
  });

  const zgocloud = await prisma.provider.upsert({
    where: { slug: 'zgocloud' },
    update: {},
    create: {
      slug: 'zgocloud',
      name: 'ZgoCloud',
      website: 'https://zgovps.com',
      tier: 'B',
    },
  });

  const colocrossing = await prisma.provider.upsert({
    where: { slug: 'colocrossing' },
    update: {},
    create: {
      slug: 'colocrossing',
      name: 'ColoCrossing',
      website: 'https://www.colocrossing.com',
      tier: 'B',
    },
  });

  const chicagovps = await prisma.provider.upsert({
    where: { slug: 'chicagovps' },
    update: {},
    create: {
      slug: 'chicagovps',
      name: 'ChicagoVPS',
      website: 'https://www.chicagovps.net',
      tier: 'B',
    },
  });

  const lightlayer = await prisma.provider.upsert({
    where: { slug: 'lightlayer' },
    update: {},
    create: {
      slug: 'lightlayer',
      name: 'LightLayer',
      website: 'https://lightlayer.net',
      tier: 'B',
    },
  });

  const speedypage = await prisma.provider.upsert({
    where: { slug: 'speedypage' },
    update: {},
    create: {
      slug: 'speedypage',
      name: 'SpeedyPage',
      website: 'https://speedypage.com',
      tier: 'B',
    },
  });

  const bestvm = await prisma.provider.upsert({
    where: { slug: 'bestvm' },
    update: {
      name: 'BestVM',
      website: 'https://bestvm.cloud',
      tier: 'B',
    },
    create: {
      slug: 'bestvm',
      name: 'BestVM',
      website: 'https://bestvm.cloud',
      tier: 'B',
    },
  });

  const neburst = await prisma.provider.upsert({
    where: { slug: 'neburst' },
    update: {
      name: 'Neburst',
      website: 'https://neburst.com',
      tier: 'B',
    },
    create: {
      slug: 'neburst',
      name: 'Neburst',
      website: 'https://neburst.com',
      tier: 'B',
    },
  });

  const hncloud = await prisma.provider.upsert({
    where: { slug: 'hncloud' },
    update: {
      name: 'HNCloud',
      website: 'https://www.hncloud.com',
      tier: 'B',
    },
    create: {
      slug: 'hncloud',
      name: 'HNCloud',
      website: 'https://www.hncloud.com',
      tier: 'B',
    },
  });

  const highendnetwork = await prisma.provider.upsert({
    where: { slug: 'highendnetwork' },
    update: {
      name: 'HighEndNetwork',
      website: 'https://billing.highendnetwork.com',
      tier: 'B',
      isActive: false,
    },
    create: {
      slug: 'highendnetwork',
      name: 'HighEndNetwork',
      website: 'https://billing.highendnetwork.com',
      tier: 'B',
      isActive: false,
    },
  });

  const sixsixclouds = await prisma.provider.upsert({
    where: { slug: '666clouds' },
    update: {
      name: '666Clouds',
      website: 'https://www.666clouds.com',
      tier: 'B',
    },
    create: {
      slug: '666clouds',
      name: '666Clouds',
      website: 'https://www.666clouds.com',
      tier: 'B',
    },
  });

  const yunyoo = await prisma.provider.upsert({
    where: { slug: 'yunyoo' },
    update: {
      name: 'YUNYOO',
      website: 'https://yunyoo.cc',
      tier: 'B',
    },
    create: {
      slug: 'yunyoo',
      name: 'YUNYOO',
      website: 'https://yunyoo.cc',
      tier: 'B',
    },
  });

  // Keep directory records and adapters, but only monitor the approved provider set.
  await prisma.provider.updateMany({ data: { isActive: false } });
  await prisma.provider.updateMany({
    where: { slug: { in: ACTIVE_PROVIDER_SLUGS } },
    data: { isActive: true },
  });

  // Seed the current special/promo VPS cards from the official cart snapshot (2026-08-07).
  const bwgPlans = [
    {
      productId: 'bwg-the-plan-dc6',
      planName: 'THE PLAN',
      location: 'DC6 CN2 GIA-E',
      lineType: 'CN2 GIA-E',
      priceCents: 4999,
      billingCycle: 'annually',
    },
    {
      productId: 'bwg-20g-kvm-dc6',
      planName: '20G KVM - CN2 GIA-E',
      location: 'DC6 CN2 GIA-E',
      lineType: 'CN2 GIA-E',
      priceCents: 6599,
      billingCycle: 'annually',
    },
    {
      productId: 'bwg-40g-kvm-dc6',
      planName: '40G KVM - CN2 GIA-E',
      location: 'DC6 CN2 GIA-E',
      lineType: 'CN2 GIA-E',
      priceCents: 9999,
      billingCycle: 'annually',
    },
    {
      productId: 'bwg-hk-pccw',
      planName: 'HK 85 PCCW',
      location: 'Hong Kong',
      lineType: 'CU Premium',
      priceCents: 8999,
      billingCycle: 'monthly',
    },
    {
      productId: 'bwg-hk-cn2gia',
      planName: 'SPECIAL 40G KVM PROMO V5 - HONG KONG CN2 GIA VPS',
      location: 'Hong Kong',
      lineType: 'CN2 GIA',
      priceCents: 8999,
      billingCycle: 'monthly',
    },
    {
      productId: 'bwg-jp-cn2gia',
      planName: 'SPECIAL 40G KVM PROMO V5 - TOKYO CN2 GIA VPS',
      location: 'Tokyo',
      lineType: 'CN2 GIA',
      priceCents: 8999,
      billingCycle: 'monthly',
    },
    {
      productId: 'bwg-44',
      planName: '20G KVM - PROMO VPS',
      location: 'Multi-DC',
      lineType: null,
      priceCents: 4999,
      billingCycle: 'annually',
    },
    {
      productId: 'bwg-45',
      planName: '40G KVM - PROMO VPS',
      location: 'Multi-DC',
      lineType: null,
      priceCents: 5299,
      billingCycle: 'semi-annually',
    },
    {
      productId: 'bwg-46',
      planName: '80G KVM - PROMO VPS',
      location: 'Multi-DC',
      lineType: null,
      priceCents: 1999,
      billingCycle: 'monthly',
    },
    {
      productId: 'bwg-47',
      planName: '160G KVM - PROMO VPS',
      location: 'Multi-DC',
      lineType: null,
      priceCents: 3999,
      billingCycle: 'monthly',
    },
    {
      productId: 'bwg-48',
      planName: '320G KVM - PROMO VPS',
      location: 'Multi-DC',
      lineType: null,
      priceCents: 7999,
      billingCycle: 'monthly',
    },
    {
      productId: 'bwg-49',
      planName: '480G KVM - PROMO VPS',
      location: 'Multi-DC',
      lineType: null,
      priceCents: 11999,
      billingCycle: 'monthly',
    },
    ...[
      ['bwg-173', 'SPECIAL 40G KVM PROMO V5 - SINGAPORE CN2 GIA VPS', 4999],
      ['bwg-174', 'SPECIAL 80G KVM PROMO V5 - SINGAPORE CN2 GIA VPS', 8699],
      ['bwg-175', 'SPECIAL 160G KVM PROMO V5 - SINGAPORE CN2 GIA VPS', 16599],
      ['bwg-176', 'SPECIAL 320G KVM PROMO V5 - SINGAPORE CN2 GIA VPS', 32999],
      ['bwg-177', 'SPECIAL 640G KVM PROMO V5 - SINGAPORE CN2 GIA VPS', 54999],
      ['bwg-178', 'SPECIAL 1280G KVM PROMO V5 - SINGAPORE CN2 GIA VPS', 105999],
      ['bwg-134', 'SPECIAL 40G KVM PROMO V5 - OSAKA CN2 GIA VPS', 4999],
      ['bwg-135', 'SPECIAL 80G KVM PROMO V5 - OSAKA CN2 GIA VPS', 8699],
      ['bwg-136', 'SPECIAL 160G KVM PROMO V5 - OSAKA CN2 GIA VPS', 16599],
      ['bwg-137', 'SPECIAL 320G KVM PROMO V5 - OSAKA CN2 GIA VPS', 32999],
      ['bwg-138', 'SPECIAL 640G KVM PROMO V5 - OSAKA CN2 GIA VPS', 54999],
      ['bwg-139', 'SPECIAL 1280G KVM PROMO V5 - OSAKA CN2 GIA VPS', 105999],
      ['bwg-96', 'SPECIAL 80G KVM PROMO V5 - HONG KONG CN2 GIA VPS', 15599],
      ['bwg-97', 'SPECIAL 160G KVM PROMO V5 - HONG KONG CN2 GIA VPS', 29999],
      ['bwg-98', 'SPECIAL 320G KVM PROMO V5 - HONG KONG CN2 GIA VPS', 58999],
      ['bwg-122', 'SPECIAL 640G KVM PROMO V5 - HONG KONG CN2 GIA VPS', 98999],
      ['bwg-124', 'SPECIAL 1280G KVM PROMO V5 - HONG KONG CN2 GIA VPS', 188999],
      ['bwg-109', 'SPECIAL 80G KVM PROMO V5 - TOKYO CN2 GIA VPS', 15599],
      ['bwg-110', 'SPECIAL 160G KVM PROMO V5 - TOKYO CN2 GIA VPS', 29999],
      ['bwg-111', 'SPECIAL 320G KVM PROMO V5 - TOKYO CN2 GIA VPS', 58999],
      ['bwg-123', 'SPECIAL 640G KVM PROMO V5 - TOKYO CN2 GIA VPS', 98999],
      ['bwg-125', 'SPECIAL 1280G KVM PROMO V5 - TOKYO CN2 GIA VPS', 188999],
    ].map(([productId, planName, priceCents]) => ({
      productId: productId as string,
      planName: planName as string,
      location: (planName as string).match(/SINGAPORE/i)
        ? 'Singapore'
        : (planName as string).match(/OSAKA/i)
          ? 'Osaka'
          : (planName as string).match(/HONG KONG/i)
            ? 'Hong Kong'
            : 'Tokyo',
      lineType: 'CN2 GIA',
      priceCents: priceCents as number,
      billingCycle: 'monthly',
    })),
    ...[
      ['bwg-87', 'SPECIAL 20G KVM PROMO V5 - CN2 GIA ECOMMERCE VPS', 4999, 'quarterly'],
      ['bwg-88', 'SPECIAL 40G KVM PROMO V5 - CN2 GIA ECOMMERCE VPS', 8999, 'quarterly'],
      ['bwg-89', 'SPECIAL 80G KVM PROMO V5 - CN2 GIA ECOMMERCE VPS', 5699, 'monthly'],
      ['bwg-90', 'SPECIAL 160G KVM PROMO V5 - CN2 GIA ECOMMERCE VPS', 8699, 'monthly'],
      ['bwg-91', 'SPECIAL 320G KVM PROMO V5 - CN2 GIA ECOMMERCE VPS', 15999, 'monthly'],
      ['bwg-92', 'SPECIAL 640G KVM PROMO V5 - CN2 GIA ECOMMERCE VPS', 28999, 'monthly'],
      ['bwg-93', 'SPECIAL 1280G KVM PROMO V5 - CN2 GIA ECOMMERCE VPS', 54999, 'monthly'],
      ['bwg-160', 'SPECIAL 1280G KVM PROMO V5 - CN2 GIA ECOMMERCE HIBW 15T VPS', 67900, 'monthly'],
      ['bwg-161', 'SPECIAL 1280G KVM PROMO V5 - CN2 GIA ECOMMERCE HIBW 20T VPS', 89900, 'monthly'],
    ].map(([productId, planName, priceCents, billingCycle]) => ({
      productId: productId as string,
      planName: planName as string,
      location: 'Multi-DC',
      lineType: 'CN2 GIA',
      priceCents: priceCents as number,
      billingCycle: billingCycle as string,
    })),
    ...[
      ['bwg-114', 'SPECIAL 20G KVM PROMO V5 - DUBAI - ECOMMERCE VPS', 1999],
      ['bwg-115', 'SPECIAL 40G KVM PROMO V5 - DUBAI - ECOMMERCE VPS', 3299],
      ['bwg-116', 'SPECIAL 80G KVM PROMO V5 - DUBAI - ECOMMERCE VPS', 5699],
      ['bwg-117', 'SPECIAL 160G KVM PROMO V5 - DUBAI - ECOMMERCE VPS', 8699],
      ['bwg-118', 'SPECIAL 320G KVM PROMO V5 - DUBAI - ECOMMERCE VPS', 15999],
      ['bwg-119', 'SPECIAL 640G KVM PROMO V5 - DUBAI - ECOMMERCE VPS', 28999],
      ['bwg-120', 'SPECIAL 1280G KVM PROMO V5 - DUBAI - ECOMMERCE VPS', 54999],
    ].map(([productId, planName, priceCents]) => ({
      productId: productId as string,
      planName: planName as string,
      location: 'Dubai',
      lineType: 'E-commerce',
      priceCents: priceCents as number,
      billingCycle: 'monthly',
    })),
  ];

  for (const plan of bwgPlans) {
    await prisma.product.upsert({
      where: { providerId_productId: { providerId: bandwagonhost.id, productId: plan.productId } },
      update: {
        planName: plan.planName,
        location: plan.location,
        lineType: plan.lineType,
        priceCents: plan.priceCents,
        billingCycle: plan.billingCycle,
      },
      create: {
        providerId: bandwagonhost.id,
        productId: plan.productId,
        planName: plan.planName,
        category: 'vps',
        location: plan.location,
        lineType: plan.lineType,
        priceCents: plan.priceCents,
        billingCycle: plan.billingCycle,
      },
    });
  }

  // Remove the invalid row produced by the retired marketing-page parser.
  await prisma.product.deleteMany({
    where: {
      providerId: bandwagonhost.id,
      productId: 'bwg-almalinux-rockylinux-centos-debian-multi-dc',
      stockChecks: { none: {} },
      stockEvents: { none: {} },
    },
  });

  // Seed known products — DMIT
  // Snapshot of the 88 public cards on the DMIT pricing page (2026-08-07).
  // The worker remains authoritative for live price and stock updates.
  const dmitGroups = [
    {
      locationCode: 'lax',
      hardware: 'as3',
      network: 'premium',
      location: 'Los Angeles',
      plans: [
        ['TINY', 1090, 'monthly'],
        ['Pocket', 1690, 'monthly'],
        ['STARTER', 3490, 'monthly'],
        ['MINI', 6290, 'monthly'],
        ['MICRO', 8790, 'monthly'],
        ['MEDIUM', 19990, 'monthly'],
      ],
    },
    {
      locationCode: 'lax',
      hardware: 'an4',
      network: 'premium',
      location: 'Los Angeles',
      plans: [
        ['MINI', 7290, 'monthly'],
        ['MICRO', 10290, 'monthly'],
        ['MEDIUM', 23990, 'monthly'],
        ['LARGE', 45990, 'monthly'],
        ['GIANT', 92990, 'monthly'],
      ],
    },
    {
      locationCode: 'lax',
      hardware: 'an5',
      network: 'premium',
      location: 'Los Angeles',
      plans: [
        ['MINI', 7990, 'monthly'],
        ['MICRO', 11090, 'monthly'],
        ['MEDIUM', 28990, 'monthly'],
        ['LARGE', 49990, 'monthly'],
        ['GIANT', 100990, 'monthly'],
      ],
    },
    {
      locationCode: 'lax',
      hardware: 'as3',
      network: 'eyeball',
      location: 'Los Angeles',
      plans: [
        ['TINY', 1090, 'monthly'],
        ['Pocket', 1690, 'monthly'],
        ['STARTER', 3490, 'monthly'],
        ['MINI', 6290, 'monthly'],
        ['MICRO', 8790, 'monthly'],
        ['MEDIUM', 19990, 'monthly'],
      ],
    },
    {
      locationCode: 'lax',
      hardware: 'an4',
      network: 'eyeball',
      location: 'Los Angeles',
      plans: [
        ['MINI', 7290, 'monthly'],
        ['MICRO', 10290, 'monthly'],
        ['MEDIUM', 23990, 'monthly'],
        ['LARGE', 45990, 'monthly'],
        ['GIANT', 92990, 'monthly'],
      ],
    },
    {
      locationCode: 'lax',
      hardware: 'an5',
      network: 'eyeball',
      location: 'Los Angeles',
      plans: [
        ['MINI', 7990, 'monthly'],
        ['MICRO', 11090, 'monthly'],
        ['MEDIUM', 28990, 'monthly'],
        ['LARGE', 49990, 'monthly'],
        ['GIANT', 100990, 'monthly'],
      ],
    },
    {
      locationCode: 'lax',
      hardware: 'an5',
      network: 'tier1',
      location: 'Los Angeles',
      plans: [
        ['V2C2G', 1490, 'monthly'],
        ['V2C4G', 2390, 'monthly'],
        ['V4C4G', 3690, 'monthly'],
        ['V4C8G', 5290, 'monthly'],
        ['V8C16G', 11990, 'monthly'],
        ['V12C24G', 19990, 'monthly'],
        ['G2C4G', 1690, 'monthly'],
        ['G4C8G', 3690, 'monthly'],
        ['G8C16G', 7990, 'monthly'],
        ['G12C24G', 11990, 'monthly'],
        ['G16C32G', 19990, 'monthly'],
      ],
    },
    {
      locationCode: 'lax',
      hardware: 'as3',
      network: 'tier1',
      location: 'Los Angeles',
      plans: [
        ['WEE', 3690, 'annually'],
        ['TINY', 690, 'monthly'],
        ['STARTER', 1290, 'monthly'],
        ['MINI', 2190, 'monthly'],
        ['MICRO', 3290, 'monthly'],
      ],
    },
    {
      locationCode: 'hkg',
      hardware: 'an5',
      network: 'premium',
      location: 'Hong Kong',
      plans: [
        ['MINI', 14990, 'monthly'],
        ['MICRO', 19990, 'monthly'],
        ['MEDIUM', 27990, 'monthly'],
        ['LARGE', 35990, 'monthly'],
        ['GIANT', 75990, 'monthly'],
      ],
    },
    {
      locationCode: 'hkg',
      hardware: 'as3',
      network: 'premium',
      location: 'Hong Kong',
      plans: [
        ['TINY', 3990, 'monthly'],
        ['STARTER', 7990, 'monthly'],
        ['MINI', 12690, 'monthly'],
        ['MICRO', 17990, 'monthly'],
        ['MEDIUM', 23990, 'monthly'],
      ],
    },
    {
      locationCode: 'hkg',
      hardware: 'as3',
      network: 'eyeball',
      location: 'Hong Kong',
      plans: [
        ['TINYv2', 2990, 'monthly'],
        ['STARTERv2', 5990, 'monthly'],
        ['MINIv2', 8990, 'monthly'],
        ['MICROv2', 12990, 'monthly'],
        ['MEDIUMv2', 19990, 'monthly'],
        ['LARGEv2', 38990, 'monthly'],
        ['GIANTv2', 78990, 'monthly'],
      ],
    },
    {
      locationCode: 'hkg',
      hardware: 'as3',
      network: 'tier1',
      location: 'Hong Kong',
      plans: [
        ['WEE', 3690, 'annually'],
        ['TINY', 690, 'monthly'],
        ['STARTER', 1290, 'monthly'],
        ['MINI', 2190, 'monthly'],
        ['MICRO', 3290, 'monthly'],
        ['MEDIUM', 4990, 'monthly'],
        ['LARGE', 9990, 'monthly'],
        ['GIANT', 19990, 'monthly'],
      ],
    },
    {
      locationCode: 'tyo',
      hardware: 'as3',
      network: 'premium',
      location: 'Tokyo',
      plans: [
        ['TINY', 2190, 'monthly'],
        ['STARTER', 4590, 'monthly'],
        ['MINI', 8990, 'monthly'],
        ['MICRO', 18990, 'monthly'],
        ['MEDIUM', 32090, 'monthly'],
        ['LARGE', 42990, 'monthly'],
        ['GIANT', 82990, 'monthly'],
      ],
    },
    {
      locationCode: 'tyo',
      hardware: 'as3',
      network: 'tier1',
      location: 'Tokyo',
      plans: [
        ['WEE', 3690, 'annually'],
        ['TINY', 690, 'monthly'],
        ['STARTER', 1290, 'monthly'],
        ['MINI', 2190, 'monthly'],
        ['MICRO', 3290, 'monthly'],
        ['MEDIUM', 4990, 'monthly'],
        ['LARGE', 9990, 'monthly'],
        ['GIANT', 19990, 'monthly'],
      ],
    },
  ] as const;
  const dmitNetworkLabels: Record<string, string> = { eyeball: 'EB', premium: 'Pro', tier1: 'T1' };
  const dmitLineLabels: Record<string, string> = { eyeball: 'Eyeball', premium: 'Premium', tier1: 'Tier 1' };
  const dmitLegacyIds: Record<string, string> = {
    'hkg:as3:premium:mini': 'dmit-pvm-hkg-mini',
    'hkg:as3:premium:tiny': 'dmit-pvm-hkg-tiny',
    'lax:as3:eyeball:tiny': 'dmit-eyeball-lax-tiny',
    'lax:as3:premium:mini': 'dmit-pvm-lax-mini',
    'lax:as3:premium:tiny': 'dmit-pvm-lax-tiny',
    'tyo:as3:premium:tiny': 'dmit-pvm-tyo-tiny',
  };
  const dmitSlugPart = (value: string): string =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  const dmitPlans = dmitGroups.flatMap((group) =>
    group.plans.map(([plan, priceCents, billingCycle]) => {
      const key = `${group.locationCode}:${group.hardware}:${group.network}:${plan.toLowerCase()}`;
      return {
        productId:
          dmitLegacyIds[key] ??
          `dmit-${dmitSlugPart(group.locationCode)}-${dmitSlugPart(group.hardware)}-${dmitSlugPart(group.network)}-${dmitSlugPart(plan)}`,
        planName: `${group.locationCode.toUpperCase()}.${group.hardware.toUpperCase()}.${dmitNetworkLabels[group.network]}.${plan}`,
        location: group.location,
        lineType: dmitLineLabels[group.network],
        priceCents,
        billingCycle,
      };
    }),
  );

  for (const plan of dmitPlans) {
    await prisma.product.upsert({
      where: { providerId_productId: { providerId: dmit.id, productId: plan.productId } },
      update: {
        planName: plan.planName,
        location: plan.location,
        lineType: plan.lineType,
        priceCents: plan.priceCents,
        billingCycle: plan.billingCycle,
      },
      create: {
        providerId: dmit.id,
        productId: plan.productId,
        planName: plan.planName,
        category: 'vps',
        location: plan.location,
        priceCents: plan.priceCents,
        billingCycle: plan.billingCycle,
      },
    });
  }

  // Seed known products — BuyVM
  const buyvmPlans = [
    {
      productId: 'buyvm-slice-1024-lv',
      planName: 'Slice 1024',
      location: 'Las Vegas',
      priceCents: 350,
      billingCycle: 'monthly',
    },
    {
      productId: 'buyvm-slice-2048-lv',
      planName: 'Slice 2048',
      location: 'Las Vegas',
      priceCents: 700,
      billingCycle: 'monthly',
    },
    {
      productId: 'buyvm-slice-4096-lv',
      planName: 'Slice 4096',
      location: 'Las Vegas',
      priceCents: 1500,
      billingCycle: 'monthly',
    },
    {
      productId: 'buyvm-slice-1024-ny',
      planName: 'Slice 1024',
      location: 'New York',
      priceCents: 350,
      billingCycle: 'monthly',
    },
    {
      productId: 'buyvm-slice-2048-ny',
      planName: 'Slice 2048',
      location: 'New York',
      priceCents: 700,
      billingCycle: 'monthly',
    },
    {
      productId: 'buyvm-slice-1024-lu',
      planName: 'Slice 1024',
      location: 'Luxembourg',
      priceCents: 350,
      billingCycle: 'monthly',
    },
    {
      productId: 'buyvm-storage-256-lv',
      planName: 'Storage 256',
      location: 'Las Vegas',
      priceCents: 500,
      billingCycle: 'monthly',
    },
  ];

  for (const plan of buyvmPlans) {
    await prisma.product.upsert({
      where: { providerId_productId: { providerId: buyvm.id, productId: plan.productId } },
      update: {},
      create: {
        providerId: buyvm.id,
        productId: plan.productId,
        planName: plan.planName,
        category: plan.productId.includes('storage') ? 'storage' : 'vps',
        location: plan.location,
        priceCents: plan.priceCents,
        billingCycle: plan.billingCycle,
      },
    });
  }

  // Seed affiliate links
  const affiliateLinks = [
    {
      providerId: bandwagonhost.id,
      slug: 'bandwagonhost',
      targetUrl: 'https://bandwagonhost.com/aff.php?aff=68376',
      shortUrl: 'https://go.uukk.de/bwg',
    },
    {
      providerId: dmit.id,
      slug: 'dmit',
      targetUrl: 'https://www.dmit.io/aff.php?aff=6077',
      shortUrl: 'https://go.uukk.de/dmit',
    },
    {
      providerId: buyvm.id,
      slug: 'buyvm',
      targetUrl: 'https://my.frantech.ca/aff.php?aff=6836',
      shortUrl: 'https://go.uukk.de/buyvm',
    },
    {
      providerId: spartanhost.id,
      slug: 'spartanhost',
      targetUrl: 'https://billing.spartanhost.net/aff.php?aff=2459',
      shortUrl: 'https://go.uukk.de/spartanhost',
    },
    {
      providerId: vmiss.id,
      slug: 'vmiss',
      targetUrl: 'https://app.vmiss.com/aff.php?aff=1922',
      shortUrl: 'https://go.uukk.de/vmiss',
    },
    {
      providerId: vps.id,
      slug: 'vps',
      targetUrl: 'https://vps.hosting/?affid=723',
      shortUrl: 'https://go.uukk.de/vps',
    },
    {
      providerId: saltyfish.id,
      slug: 'saltyfish',
      targetUrl: 'https://portal.saltyfish.io/aff.php?aff=575',
      shortUrl: 'https://go.uukk.de/saltyfish',
    },
    {
      providerId: greencloudvps.id,
      slug: 'greencloudvps',
      targetUrl: 'https://greencloudvps.com/billing/aff.php?aff=6807',
      shortUrl: 'https://go.uukk.de/greencloudvps',
    },
    // Phase 4 A-Tier
    {
      providerId: racknerd.id,
      slug: 'racknerd',
      targetUrl: 'https://my.racknerd.com/aff.php?aff=5550',
      shortUrl: 'https://go.uukk.de/racknerd',
    },
    {
      providerId: clouvider.id,
      slug: 'clouvider',
      targetUrl: 'https://console.clouvider.co.uk/?affid=543',
      shortUrl: 'https://go.uukk.de/clouvider',
    },
    {
      providerId: liteserver.id,
      slug: 'liteserver',
      targetUrl: 'https://clients.liteserver.nl/aff.php?aff=771',
      shortUrl: 'https://go.uukk.de/liteserver',
    },
    {
      providerId: crunchbits.id,
      slug: 'crunchbits',
      targetUrl: 'https://crunchbits.com/',
      shortUrl: 'https://go.uukk.de/crunchbits',
    },
    {
      providerId: servarica.id,
      slug: 'servarica',
      targetUrl: 'https://clients.servarica.com/',
      shortUrl: 'https://go.uukk.de/servarica',
    },
    {
      providerId: evoxt.id,
      slug: 'evoxt',
      targetUrl: 'https://console.evoxt.com/aff.php?aff=994',
      shortUrl: 'https://go.uukk.de/evoxt',
    },
    {
      providerId: alwyzon.id,
      slug: 'alwyzon',
      targetUrl: 'https://www.alwyzon.com/',
      shortUrl: 'https://go.uukk.de/alwyzon',
    },
    {
      providerId: dedirock.id,
      slug: 'dedirock',
      targetUrl: 'https://billing.dedirock.com/aff.php?aff=77',
      shortUrl: 'https://go.uukk.de/dedirock',
    },
    {
      providerId: onidel.id,
      slug: 'onidel',
      targetUrl: 'https://onidel.com/?referral=1572199',
      shortUrl: 'https://go.uukk.de/onidel',
    },
    {
      providerId: bagevm.id,
      slug: 'bagevm',
      targetUrl: 'https://www.bagevm.com/aff.php?aff=10',
      shortUrl: 'https://go.uukk.de/bagevm',
    },
    // Phase 4 B-Tier
    {
      providerId: tierhive.id,
      slug: 'tierhive',
      targetUrl: 'https://tierhive.com/r/4FB89FE7369E',
      shortUrl: 'https://go.uukk.de/tierhive',
    },
    {
      providerId: gullos.id,
      slug: 'gullos',
      targetUrl: 'https://hosting.gullo.me/',
      shortUrl: 'https://go.uukk.de/gullos',
    },
    {
      providerId: webhorizon.id,
      slug: 'webhorizon',
      targetUrl: 'https://my.webhorizon.net/',
      shortUrl: 'https://go.uukk.de/webhorizon',
    },
    {
      providerId: vmrack.id,
      slug: 'vmrack',
      targetUrl: 'https://www.vmrack.net/vps?ref_code=5YrpHKG16xf',
      shortUrl: 'https://go.uukk.de/vmrack',
    },
    {
      providerId: gomami.id,
      slug: 'gomami',
      targetUrl: 'https://gomami.io/aff.php?aff=209',
      shortUrl: 'https://go.uukk.de/gomami',
    },
    {
      providerId: zgocloud.id,
      slug: 'zgocloud',
      targetUrl: 'https://clients.zgovps.com/?affid=488',
      shortUrl: 'https://go.uukk.de/zgovps',
    },
    {
      providerId: colocrossing.id,
      slug: 'colocrossing',
      targetUrl: 'https://cloud.colocrossing.com/aff.php?aff=467',
      shortUrl: 'https://go.uukk.de/ccs',
    },
    {
      providerId: chicagovps.id,
      slug: 'chicagovps',
      targetUrl: 'https://billing.chicagovps.net/aff.php?aff=2611',
      shortUrl: 'https://go.uukk.de/chicagovps',
    },
    {
      providerId: lightlayer.id,
      slug: 'lightlayer',
      targetUrl: 'https://account.lightlayer.net/?affid=647',
      shortUrl: 'https://go.uukk.de/lightlayer',
    },
    {
      providerId: speedypage.id,
      slug: 'speedypage',
      targetUrl: 'https://my.speedypage.com/aff.php?aff=405',
      shortUrl: 'https://go.uukk.de/speedy',
    },
    {
      providerId: bestvm.id,
      slug: 'bestvm',
      targetUrl: 'https://bestvm.cloud/aff.php?aff=225',
      shortUrl: 'https://go.uukk.de/bestvm',
    },
    {
      providerId: neburst.id,
      slug: 'neburst',
      targetUrl: 'https://neburst.com/auth/sign-up/?aff=3cvoo',
      shortUrl: 'https://go.uukk.de/neburst',
    },
    {
      providerId: hncloud.id,
      slug: 'hncloud',
      targetUrl: 'https://www.hncloud.com?k=7940T0',
      shortUrl: 'https://go.uukk.de/hncloud',
    },
    {
      providerId: highendnetwork.id,
      slug: 'highendnetwork',
      targetUrl: 'https://billing.highendnetwork.com/aff.php?aff=68',
      shortUrl: 'https://go.uukk.de/highendnetwork',
    },
    {
      providerId: sixsixclouds.id,
      slug: '666clouds',
      targetUrl: 'https://www.666clouds.com/aff.php?aff=2071',
      shortUrl: 'https://go.uukk.de/666clouds',
    },
    {
      providerId: yunyoo.id,
      slug: 'yunyoo',
      targetUrl: 'https://yunyoo.cc/cart?aff=HYWEANDG',
      shortUrl: 'https://go.uukk.de/yunyoo',
    },
  ];

  for (const link of affiliateLinks) {
    await prisma.affiliateLink.upsert({
      where: { slug: link.slug },
      update: {
        providerId: link.providerId,
        targetUrl: link.targetUrl,
        shortUrl: link.shortUrl,
      },
      create: link,
    });
  }

  console.log('Seeding complete!');
  console.log(`  Providers: 34`);
  console.log(`  Active allowlist: ${ACTIVE_PROVIDER_SLUGS.length}`);
  console.log(`  Products: ${bwgPlans.length + dmitPlans.length + buyvmPlans.length}`);
  console.log(`  Affiliate Links: ${affiliateLinks.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
