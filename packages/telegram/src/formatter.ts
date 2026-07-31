import type { StockResult } from '@vpsknow/providers';

/**
 * 格式化补货通知消息
 * @param result 库存检查结果
 * @param shortUrl 短链接 (https://stock.vpsknow.com/go/xxx)
 * @returns Telegram 消息文本
 */
export function formatRestockMessage(result: StockResult, shortUrl?: string): string {
  const price = `$${(result.price / 100).toFixed(2)}/${result.billingCycle === 'monthly' ? 'mo' : result.billingCycle === 'annually' ? 'yr' : result.billingCycle}`;

  // 优先使用短链接,fallback 到原始链接
  const orderLink = shortUrl || result.orderUrl || '#';

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  return [
    `🟢 RESTOCK — ${result.provider.toUpperCase()}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    `📍 ${result.location}`,
    `💻 ${result.planName}`,
    '',
    `   CPU    ${result.cpu}`,
    `   RAM    ${result.ramMb >= 1024 ? `${(result.ramMb / 1024).toFixed(0)} GB` : `${result.ramMb} MB`}`,
    `   ${result.storageType}    ${result.storageGb} GB`,
    `   BW     ${result.bandwidthTb} TB`,
    `   IPv4   ${result.ipv4 ? 'Yes' : 'No'}`,
    `   Price  ${price}`,
    '',
    `⏱ Detected: ${now} UTC`,
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `🔗 Order: ${orderLink}`,
  ].join('\n');
}

export function formatOfferMessage(opts: {
  provider: string;
  title: string;
  specs: string;
  locations: string;
  price: string;
  category: string;
  billing: string;
  postedAt: string;
  orderUrl: string;
  threadUrl: string;
}): string {
  return [
    `🔥 NEW OFFER — ${opts.provider}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    `📦 ${opts.title}`,
    '',
    `   ${opts.specs}`,
    `📍 ${opts.locations}`,
    `💰 ${opts.price}`,
    '',
    `├── Category: ${opts.category}`,
    `├── Billing: ${opts.billing}`,
    `├── Source: LowEndTalk`,
    `└── Posted: ${opts.postedAt}`,
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `🔗 Order: ${opts.orderUrl}`,
    `🔗 Thread: ${opts.threadUrl}`,
  ].join('\n');
}
