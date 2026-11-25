import type { StockResult } from '@vpsknow/providers';
import { allowedOfferSourceUrl, currencyPrefix } from '@vpsknow/shared';

const MESSAGE_FOOTER = [
  '🌐 stock.vpsknow.com',
  '📢 @vpsknow_offers',
  '🤖 @vpsknow_stock_bot',
];

function hashtag(value: string): string | null {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9\u4e00-\u9fff]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  if (!normalized) return null;
  return `#${/^\d/.test(normalized) ? `_${normalized}` : normalized}`;
}

function messageTags(values: readonly string[]): string {
  const tags = values
    .map(hashtag)
    .filter((tag): tag is string => tag !== null)
    .filter(
      (tag, index, all) =>
        all.findIndex((item) => item.toLowerCase() === tag.toLowerCase()) === index,
    );
  return tags.join(' ');
}

function singleLocationTag(locations: string): string | null {
  const value = locations.trim();
  if (!value || /^not specified$/i.test(value) || value.length > 32 || /[,;/|]/.test(value)) {
    return null;
  }
  return value;
}

function formatRam(ramMb: number): string {
  return ramMb >= 1024 ? `${(ramMb / 1024).toFixed(0)}GB` : `${ramMb}MB`;
}

function billingCycleLabel(cycle: StockResult['billingCycle']): string {
  switch (cycle) {
    case 'monthly':
      return '月付';
    case 'quarterly':
      return '季付';
    case 'semi-annually':
      return '半年付';
    case 'annually':
      return '年付';
    case 'biennially':
      return '两年付';
    case 'triennially':
      return '三年付';
    default:
      return cycle;
  }
}

function formatPrice(result: StockResult): string {
  const amount = `${currencyPrefix(result.currency)}${(result.price / 100).toFixed(2)}`;
  return `${billingCycleLabel(result.billingCycle)} ${amount}`;
}

function formatCompactSpecs(result: StockResult): string {
  const display = result.displaySpecs;
  const storage = display?.storage ?? `${result.storageGb}GB-${result.storageType || 'SSD'}`;
  const bandwidth = display?.bandwidth ?? `${result.bandwidthTb}TB`;
  const port = display?.port;
  const parts = [result.cpu.replace(/\s+/g, ''), formatRam(result.ramMb), storage];
  if (port) parts.push(port);
  parts.push(bandwidth);
  return parts.join(' / ');
}

/** Format a Date as Beijing wall-clock time for Telegram copy. */
export function formatBeijingTime(detectedAt: Date): string {
  if (Number.isNaN(detectedAt.getTime())) {
    throw new Error('detectedAt must be a valid date');
  }

  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(detectedAt);

  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${get('year')}/${get('month')}/${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/**
 * 格式化补货通知消息（纯中文）
 */
export function formatRestockMessage(
  result: StockResult,
  shortUrl?: string,
  detectedAt: Date = new Date(),
): string {
  const orderLink = shortUrl || result.orderUrl || '#';
  const detectedAtText = formatBeijingTime(detectedAt);
  const tags = messageTags(['补货', result.provider, result.location, result.category]);
  const line = result.lineType?.trim();

  return [
    `🟢 补货 · ${result.provider}`,
    '',
    `📦 ${result.planName}`,
    ...(line ? [`• 线路：${line}`] : []),
    `• 机房：${result.location}`,
    `• 配置：${formatCompactSpecs(result)}`,
    `• 价格：${formatPrice(result)}`,
    '• 状态：有货',
    ...(result.ipv4 === false ? ['• IPv4：无'] : []),
    `🔗 购买：${orderLink}`,
    '',
    `⏱ 北京时间 ${detectedAtText}`,
    tags,
    '',
    ...MESSAGE_FOOTER,
  ].join('\n');
}

/**
 * Build an HTML sold-out edit payload that strikes through the original restock text.
 */
export function formatSoldOutEditMessage(originalContent: string): string {
  const stripped = originalContent
    .replace(/^🟢 补货/, '🔴 已售罄')
    .replace('• 状态：有货', '• 状态：已售罄');

  return [
    '🔴 <b>已售罄</b> · 原补货通知已划掉',
    '',
    `<s>${escapeHtml(stripped)}</s>`,
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
  /** Forum Source URL — only LowEndTalk / LowEndBox / LowEndSpirit are shown */
  originalUrl: string;
  /** Merchant order URL when the post includes one */
  orderUrl?: string | null;
}): string {
  const locationTag = singleLocationTag(opts.locations);
  const tags = messageTags([
    '优惠',
    opts.provider,
    opts.category,
    ...(locationTag ? [locationTag] : []),
  ]);
  const orderUrl = opts.orderUrl?.trim() || null;
  const sourceUrl = allowedOfferSourceUrl(opts.originalUrl);
  const billing =
    /^(mo|month|monthly)$/i.test(opts.billing)
      ? '月'
      : /^(yr|year|annually|annual)$/i.test(opts.billing)
        ? '年'
        : opts.billing;

  return [
    `🔥 新优惠 · ${opts.provider}`,
    '',
    `📦 ${opts.title}`,
    '',
    `📍 机房：${opts.locations}`,
    `💰 价格：起 ${opts.price}/${billing}`,
    `🖥 类型：${opts.category}`,
    ...(opts.couponCode ? [`🎟 优惠码：${opts.couponCode}`] : []),
    `🕒 发布：${opts.postedAt}`,
    '',
    ...(orderUrl ? [`🔗 购买：${orderUrl}`] : []),
    ...(sourceUrl ? [`🔗 来源：${sourceUrl}`] : []),
    '',
    tags,
    '',
    ...MESSAGE_FOOTER,
  ].join('\n');
}

export type DigestProductLine = {
  provider: string;
  planName: string;
  location: string;
  lineType?: string | null;
  specs: string;
  price: string;
  orderUrl: string;
};

/**
 * Provider-grouped daily in-stock digest (Chinese).
 */
export function formatDailyStockDigest(
  products: readonly DigestProductLine[],
  generatedAt: Date = new Date(),
): string {
  const time = formatBeijingTime(generatedAt);
  const byProvider = new Map<string, DigestProductLine[]>();
  for (const product of products) {
    const list = byProvider.get(product.provider) ?? [];
    list.push(product);
    byProvider.set(product.provider, list);
  }

  const sections: string[] = [
    `💻 每日有货汇总`,
    `北京时间 ${time}`,
    `有货：${products.length}`,
  ];

  for (const [provider, items] of [...byProvider.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    sections.push('');
    sections.push(`—— ${provider}（${items.length}）——`);
    for (const item of items.slice(0, 12)) {
      sections.push(`📦 ${item.planName}`);
      if (item.lineType) sections.push(`• 线路：${item.lineType}`);
      sections.push(`• 机房：${item.location}`);
      sections.push(`• 配置：${item.specs}`);
      sections.push(`• 价格：${item.price}`);
      sections.push(`• 状态：有货`);
      sections.push(`🔗 购买：${item.orderUrl}`);
      sections.push('');
    }
    if (items.length > 12) {
      sections.push(`…另有 ${items.length - 12} 个套餐，详见网站`);
      sections.push('');
    }
  }

  sections.push(...MESSAGE_FOOTER);
  return sections.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}
