import type { StockResult } from '@vpsknow/providers';

const MESSAGE_FOOTER = ['🌐 vpsknow.com', '💬@vpsknow | 📢@vpsknow_channel | 🤖@vpsknow_bot'];

function hashtag(value: string): string | null {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  if (!normalized) return null;
  return `#${/^\d/.test(normalized) ? `_${normalized}` : normalized}`;
}

function messageTags(values: readonly string[]): string {
  const tags = values
    .map(hashtag)
    .filter((tag): tag is string => tag !== null)
    .filter((tag, index, all) => all.findIndex((item) => item.toLowerCase() === tag.toLowerCase()) === index);
  return tags.join(' ');
}

function singleLocationTag(locations: string): string | null {
  const value = locations.trim();
  if (!value || /^not specified$/i.test(value) || value.length > 32 || /[,;/|]/.test(value)) {
    return null;
  }
  return value;
}

/**
 * 格式化补货通知消息
 * @param result 库存检查结果
 * @param shortUrl 短链接 (https://stock.vpsknow.com/go/xxx)
 * @returns Telegram 消息文本
 */
export function formatRestockMessage(
  result: StockResult,
  shortUrl?: string,
  detectedAt: Date = new Date(),
): string {
  const price = `$${(result.price / 100).toFixed(2)}/${result.billingCycle === 'monthly' ? 'mo' : result.billingCycle === 'annually' ? 'yr' : result.billingCycle}`;

  // 优先使用短链接,fallback 到原始链接
  const orderLink = shortUrl || result.orderUrl || '#';

  if (Number.isNaN(detectedAt.getTime())) {
    throw new Error('detectedAt must be a valid date');
  }
  const detectedAtText = detectedAt.toISOString().replace('T', ' ').slice(0, 19);
  const tags = messageTags(['Restock', result.provider, result.location, result.category]);

  return [
    `🟢 RESTOCK · ${result.provider.toUpperCase()}`,
    '',
    `📍 Location: ${result.location}`,
    `💻 Plan: ${result.planName}`,
    '',
    '⚙️ Specifications',
    `├ CPU: ${result.cpu}`,
    `├ RAM: ${result.ramMb >= 1024 ? `${(result.ramMb / 1024).toFixed(0)} GB` : `${result.ramMb} MB`}`,
    `├ Storage: ${result.storageGb} GB ${result.storageType}`,
    `├ Bandwidth: ${result.bandwidthTb} TB`,
    `├ IPv4: ${result.ipv4 ? 'Yes' : 'No'}`,
    `├ IPv6: ${result.ipv6 ? 'Yes' : 'No'}`,
    `└ Price: ${price}`,
    '',
    `⏱ Detected: ${detectedAtText} UTC`,
    `🔗 Order: ${orderLink}`,
    '',
    tags,
    '',
    ...MESSAGE_FOOTER,
  ].join('\n');
}

export function formatOfferMessage(opts: {
  provider: string;
  title: string;
  locations: string;
  price: string;
  category: string;
  billing: string;
  postedAt: string;
  couponCode: string | null;
  originalUrl: string;
}): string {
  const locationTag = singleLocationTag(opts.locations);
  const tags = messageTags([
    'Offer',
    opts.provider,
    opts.category,
    ...(locationTag ? [locationTag] : []),
  ]);

  return [
    `🔥 NEW OFFER · ${opts.provider}`,
    '',
    `📦 ${opts.title}`,
    '',
    `📍 Locations: ${opts.locations}`,
    `💰 Price: From ${opts.price}/${opts.billing}`,
    `🖥 Type: ${opts.category}`,
    ...(opts.couponCode ? [`🎟 Coupon: ${opts.couponCode}`] : []),
    `🕒 Posted: ${opts.postedAt}`,
    '',
    `🔗 View offer: ${opts.originalUrl}`,
    '',
    tags,
    '',
    ...MESSAGE_FOOTER,
  ].join('\n');
}
