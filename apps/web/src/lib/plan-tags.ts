export type PlanOfferTag = 'special' | 'promo' | 'limited' | null;

const SPECIAL_RE =
  /\b(specials?|特价|特賣|特卖|bargain|discounted?|sale|deal|hot\s*deal|flash\s*sale|budget)\b/i;
const PROMO_RE =
  /\b(promo|promotion|促销|優惠|优惠|coupon|campaign|limited[- ]?time)\b/i;
const LIMITED_RE =
  /\b(limited|限量|限售|sold\s*out\s*soon|qty\s*limited|库存有限|activity|活动)\b/i;

export function detectPlanOfferTag(planName: string, productId = ''): PlanOfferTag {
  const text = `${planName} ${productId}`;
  if (LIMITED_RE.test(text)) return 'limited';
  if (PROMO_RE.test(text)) return 'promo';
  if (SPECIAL_RE.test(text)) return 'special';
  return null;
}

export function offerTagLabel(tag: PlanOfferTag): string | null {
  if (tag === 'special') return 'Special';
  if (tag === 'promo') return 'Promo';
  if (tag === 'limited') return 'Limited';
  return null;
}

const CATEGORY_LABELS: Record<string, string> = {
  vps: 'VPS',
  vds: 'VDS',
  dedicated: 'Dedicated',
  nat_vps: 'NAT VPS',
  storage: 'Storage',
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category.replace(/[-_]/g, ' ').toUpperCase();
}
