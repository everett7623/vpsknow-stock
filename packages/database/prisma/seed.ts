import { PrismaClient } from '@prisma/client';

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
      // PoorVPS 库存数据有地域限制；配置可达镜像后再启用。
      isActive: false,
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

  // Seed known products — BandwagonHost
  const bwgPlans = [
    { productId: 'bwg-the-plan-dc6', planName: 'THE PLAN', location: 'DC6 CN2 GIA-E', priceCents: 4999, billingCycle: 'annually' },
    { productId: 'bwg-20g-kvm-dc6', planName: '20G KVM - CN2 GIA-E', location: 'DC6 CN2 GIA-E', priceCents: 6599, billingCycle: 'annually' },
    { productId: 'bwg-40g-kvm-dc6', planName: '40G KVM - CN2 GIA-E', location: 'DC6 CN2 GIA-E', priceCents: 9999, billingCycle: 'annually' },
    { productId: 'bwg-hk-pccw', planName: 'HK 85 PCCW', location: 'Hong Kong', priceCents: 8999, billingCycle: 'monthly' },
    { productId: 'bwg-hk-cn2gia', planName: 'HK CN2 GIA', location: 'Hong Kong', priceCents: 8999, billingCycle: 'monthly' },
    { productId: 'bwg-jp-cn2gia', planName: 'Tokyo CN2 GIA', location: 'Tokyo', priceCents: 8999, billingCycle: 'monthly' },
  ];

  for (const plan of bwgPlans) {
    await prisma.product.upsert({
      where: { providerId_productId: { providerId: bandwagonhost.id, productId: plan.productId } },
      update: {},
      create: {
        providerId: bandwagonhost.id,
        productId: plan.productId,
        planName: plan.planName,
        category: 'vps',
        location: plan.location,
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
  const dmitPlans = [
    { productId: 'dmit-pvm-lax-tiny', planName: 'PVM.LAX Tiny', location: 'Los Angeles', priceCents: 699, billingCycle: 'monthly' },
    { productId: 'dmit-pvm-lax-mini', planName: 'PVM.LAX Mini', location: 'Los Angeles', priceCents: 1199, billingCycle: 'monthly' },
    { productId: 'dmit-pvm-hkg-tiny', planName: 'PVM.HKG Tiny', location: 'Hong Kong', priceCents: 1999, billingCycle: 'monthly' },
    { productId: 'dmit-pvm-hkg-mini', planName: 'PVM.HKG Mini', location: 'Hong Kong', priceCents: 3299, billingCycle: 'monthly' },
    { productId: 'dmit-pvm-tyo-tiny', planName: 'PVM.TYO Tiny', location: 'Tokyo', priceCents: 1999, billingCycle: 'monthly' },
    { productId: 'dmit-eyeball-lax-tiny', planName: 'Eyeball.LAX Tiny', location: 'Los Angeles', priceCents: 499, billingCycle: 'monthly' },
  ];

  for (const plan of dmitPlans) {
    await prisma.product.upsert({
      where: { providerId_productId: { providerId: dmit.id, productId: plan.productId } },
      update: {},
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
    { productId: 'buyvm-slice-1024-lv', planName: 'Slice 1024', location: 'Las Vegas', priceCents: 350, billingCycle: 'monthly' },
    { productId: 'buyvm-slice-2048-lv', planName: 'Slice 2048', location: 'Las Vegas', priceCents: 700, billingCycle: 'monthly' },
    { productId: 'buyvm-slice-4096-lv', planName: 'Slice 4096', location: 'Las Vegas', priceCents: 1500, billingCycle: 'monthly' },
    { productId: 'buyvm-slice-1024-ny', planName: 'Slice 1024', location: 'New York', priceCents: 350, billingCycle: 'monthly' },
    { productId: 'buyvm-slice-2048-ny', planName: 'Slice 2048', location: 'New York', priceCents: 700, billingCycle: 'monthly' },
    { productId: 'buyvm-slice-1024-lu', planName: 'Slice 1024', location: 'Luxembourg', priceCents: 350, billingCycle: 'monthly' },
    { productId: 'buyvm-storage-256-lv', planName: 'Storage 256', location: 'Las Vegas', priceCents: 500, billingCycle: 'monthly' },
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
    { providerId: bandwagonhost.id, slug: 'bandwagonhost', targetUrl: 'https://bandwagonhost.com/aff.php?aff=YOUR_ID', shortUrl: 'https://go.uukk.de/bwg' },
    { providerId: dmit.id, slug: 'dmit', targetUrl: 'https://www.dmit.io/aff.php?aff=YOUR_ID', shortUrl: 'https://go.uukk.de/dmit' },
    { providerId: buyvm.id, slug: 'buyvm', targetUrl: 'https://my.frantech.ca/aff.php?aff=YOUR_ID', shortUrl: 'https://go.uukk.de/buyvm' },
    { providerId: spartanhost.id, slug: 'spartanhost', targetUrl: 'https://billing.spartanhost.net', shortUrl: 'https://go.uukk.de/spartanhost' },
    { providerId: vmiss.id, slug: 'vmiss', targetUrl: 'https://app.vmiss.com', shortUrl: 'https://go.uukk.de/vmiss' },
    { providerId: vps.id, slug: 'vps', targetUrl: 'https://vps.hosting', shortUrl: 'https://go.uukk.de/vps' },
    { providerId: saltyfish.id, slug: 'saltyfish', targetUrl: 'https://portal.saltyfish.io', shortUrl: 'https://go.uukk.de/saltyfish' },
    { providerId: greencloudvps.id, slug: 'greencloudvps', targetUrl: 'https://greencloudvps.com', shortUrl: 'https://go.uukk.de/greencloudvps' },
    // Phase 4 A-Tier
    { providerId: racknerd.id, slug: 'racknerd', targetUrl: 'https://my.racknerd.com', shortUrl: 'https://go.uukk.de/racknerd' },
    { providerId: clouvider.id, slug: 'clouvider', targetUrl: 'https://www.clouvider.com', shortUrl: 'https://go.uukk.de/clouvider' },
    { providerId: liteserver.id, slug: 'liteserver', targetUrl: 'https://liteserver.nl', shortUrl: 'https://go.uukk.de/liteserver' },
    { providerId: crunchbits.id, slug: 'crunchbits', targetUrl: 'https://crunchbits.com', shortUrl: 'https://go.uukk.de/crunchbits' },
    { providerId: servarica.id, slug: 'servarica', targetUrl: 'https://servarica.com', shortUrl: 'https://go.uukk.de/servarica' },
    { providerId: evoxt.id, slug: 'evoxt', targetUrl: 'https://evoxt.com', shortUrl: 'https://go.uukk.de/evoxt' },
    { providerId: alwyzon.id, slug: 'alwyzon', targetUrl: 'https://alwyzon.com', shortUrl: 'https://go.uukk.de/alwyzon' },
    { providerId: dedirock.id, slug: 'dedirock', targetUrl: 'https://dedirock.com', shortUrl: 'https://go.uukk.de/dedirock' },
    { providerId: onidel.id, slug: 'onidel', targetUrl: 'https://onidel.com', shortUrl: 'https://go.uukk.de/onidel' },
    { providerId: bagevm.id, slug: 'bagevm', targetUrl: 'https://www.bagevm.com/aff.php?aff=10', shortUrl: 'https://go.uukk.de/bagevm' },
    // Phase 4 B-Tier
    { providerId: tierhive.id, slug: 'tierhive', targetUrl: 'https://tierhive.com', shortUrl: 'https://go.uukk.de/tierhive' },
    { providerId: gullos.id, slug: 'gullos', targetUrl: 'https://gullos.com', shortUrl: 'https://go.uukk.de/gullos' },
    { providerId: webhorizon.id, slug: 'webhorizon', targetUrl: 'https://webhorizon.in', shortUrl: 'https://go.uukk.de/webhorizon' },
    { providerId: vmrack.id, slug: 'vmrack', targetUrl: 'https://www.vmrack.net?ref_code=5YrpHKG16xf', shortUrl: 'https://go.uukk.de/vmrack' },
    { providerId: gomami.id, slug: 'gomami', targetUrl: 'https://gomami.io/aff.php?aff=209', shortUrl: 'https://go.uukk.de/gomami' },
    { providerId: zgocloud.id, slug: 'zgocloud', targetUrl: 'https://clients.zgovps.com/?affid=488', shortUrl: 'https://go.uukk.de/zgovps' },
    { providerId: colocrossing.id, slug: 'colocrossing', targetUrl: 'https://cloud.colocrossing.com/aff.php?aff=467', shortUrl: 'https://go.uukk.de/ccs' },
    { providerId: chicagovps.id, slug: 'chicagovps', targetUrl: 'https://billing.chicagovps.net/aff.php?aff=2611', shortUrl: 'https://go.uukk.de/chicagovps' },
    { providerId: lightlayer.id, slug: 'lightlayer', targetUrl: 'https://account.lightlayer.net/?affid=647', shortUrl: 'https://go.uukk.de/lightlayer' },
    { providerId: speedypage.id, slug: 'speedypage', targetUrl: 'https://my.speedypage.com/aff.php?aff=405', shortUrl: 'https://go.uukk.de/speedy' },
  ];

  for (const link of affiliateLinks) {
    await prisma.affiliateLink.upsert({
      where: { slug: link.slug },
      update: {},
      create: link,
    });
  }

  console.log('Seeding complete!');
  console.log(`  Providers: 28`);
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
