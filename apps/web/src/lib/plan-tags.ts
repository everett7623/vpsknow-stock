export type PlanOfferTag = 'special' | 'promo' | 'limited' | null;

const SPECIAL_RE =
  /\b(specials?|特价|特賣|特卖|bargain|discounted?|sale|deal|hot\s*deal|flash\s*sale|budget)\b/i;
const PROMO_RE = /\b(promo|promotion|促销|優惠|优惠|coupon|campaign|limited[- ]?time)\b/i;
const LIMITED_RE =
  /\b(limited|限量|限售|sold\s*out\s*soon|qty\s*limited|库存有限|activity|活动)\b/i;

// DMIT's current low-price cards do not contain promo words in their names.
const DMIT_LOW_PRICE_RE =
  /\bdmit-(?:(?:lax|hkg|tyo)-as3-tier1-(?:wee|tiny)|lax-an5-tier1-v2c2g)\b/i;

export function detectPlanOfferTag(planName: string, productId = ''): PlanOfferTag {
  const text = `${planName} ${productId}`;
  if (LIMITED_RE.test(text)) return 'limited';
  if (PROMO_RE.test(text)) return 'promo';
  if (DMIT_LOW_PRICE_RE.test(text)) return 'special';
  if (SPECIAL_RE.test(text)) return 'special';
  return null;
}

import type { Dictionary } from '@/lib/i18n/dictionaries';

export function offerTagLabel(
  tag: PlanOfferTag,
  dictionary?: Dictionary['offerTag'],
): string | null {
  if (!tag) return null;
  if (dictionary) {
    if (tag === 'special') return dictionary.special;
    if (tag === 'promo') return dictionary.promo;
    if (tag === 'limited') return dictionary.limited;
  }
  if (tag === 'special') return 'Special';
  if (tag === 'promo') return 'Promo';
  if (tag === 'limited') return 'Limited';
  return null;
}

export function categoryLabel(category: string, dictionary?: Dictionary['category']): string {
  if (dictionary && category in dictionary) {
    return dictionary[category as keyof Dictionary['category']];
  }
  const fallback: Record<string, string> = {
    vps: 'VPS',
    vds: 'VDS',
    dedicated: 'Dedicated',
    nat_vps: 'NAT VPS',
    storage: 'Storage',
  };
  return fallback[category] ?? category.replace(/[-_]/g, ' ').toUpperCase();
}

export function lineTypeLabel(
  lineType: string | null | undefined,
  standardFallback = 'Standard / unclassified',
): string {
  return lineType?.trim() || standardFallback;
}
