interface SubscriptionStatus {
  providers: string[];
  regions: string[];
  categories: string[];
  maxPriceCents: number | null;
  eventTypes: string[];
  isActive: boolean;
  mutedUntil: Date | null;
}

export function parseMuteHours(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return 8;
  if (!/^\d+$/.test(normalized)) return null;
  const hours = Number.parseInt(normalized, 10);
  return hours >= 1 && hours <= 168 ? hours : null;
}

function list(values: string[]): string {
  return values.length > 0 ? values.join(', ') : 'All';
}

export function formatSubscriptionStatus(subscription: SubscriptionStatus | null): string {
  if (!subscription) return 'No subscription found. Use /subscribe to get started.';

  const muted = subscription.mutedUntil && subscription.mutedUntil > new Date()
    ? `Muted until ${subscription.mutedUntil.toISOString()}`
    : subscription.isActive ? 'Active' : 'Disabled';
  const price = subscription.maxPriceCents === null
    ? 'Any'
    : `USD ${(subscription.maxPriceCents / 100).toFixed(2)}`;

  return [
    '📌 Subscription status',
    '',
    `Status: ${muted}`,
    `Events: ${list(subscription.eventTypes)}`,
    `Providers: ${list(subscription.providers)}`,
    `Regions: ${list(subscription.regions)}`,
    `Categories: ${list(subscription.categories)}`,
    `Max price: ${price}`,
  ].join('\n');
}
