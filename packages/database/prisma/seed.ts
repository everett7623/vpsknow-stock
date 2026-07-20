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
  ];

  for (const link of affiliateLinks) {
    await prisma.affiliateLink.upsert({
      where: { slug: link.slug },
      update: {},
      create: link,
    });
  }

  console.log('Seeding complete!');
  console.log(`  Providers: 3`);
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
