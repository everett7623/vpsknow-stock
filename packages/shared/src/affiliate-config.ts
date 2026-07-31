/**
 * Affiliate 配置文件 - 从 Excel 导入的真实数据
 *
 * 数据来源: 主机与域名服务商短链接汇总-20260731.xlsx
 * 更新时间: 2026-07-31
 */

export interface AffiliateConfig {
  /** Provider slug */
  provider: string;
  /** Affiliate ID (从原链接中提取) */
  affId: string;
  /** Affiliate 链接模板 (使用 {affId} 和 {pid} 占位符) */
  urlTemplate: string;
  /** 是否支持产品级别 PID */
  supportsPid: boolean;
  /** 原始 affiliate 链接 (参考) */
  originalUrl?: string;
}

/**
 * ✅ 真实 Affiliate 配置 (从 Excel 导入)
 */
export const AFFILIATE_CONFIGS: Record<string, AffiliateConfig> = {
  // ========== S-Tier Providers (补货重点) ==========

  bandwagonhost: {
    provider: 'bandwagonhost',
    affId: '68376',
    urlTemplate: 'https://bandwagonhost.com/aff.php?aff={affId}&pid={pid}',
    supportsPid: true,
    originalUrl: 'https://bandwagonhost.com/aff.php?aff=68376',
  },

  dmit: {
    provider: 'dmit',
    affId: '6077',
    urlTemplate: 'https://www.dmit.io/aff.php?aff={affId}&pid={pid}',
    supportsPid: true,
    originalUrl: 'https://www.dmit.io/aff.php?aff=6077',
  },

  buyvm: {
    provider: 'buyvm',
    affId: '6836',
    urlTemplate: 'https://my.frantech.ca/aff.php?aff={affId}',
    supportsPid: false,
    originalUrl: 'https://my.frantech.ca/aff.php?aff=6836',
  },

  hosthatch: {
    provider: 'hosthatch',
    affId: '4354',
    urlTemplate: 'https://cloud.hosthatch.com/a/{affId}',
    supportsPid: false,
    originalUrl: 'https://cloud.hosthatch.com/a/4354',
  },

  spartanhost: {
    provider: 'spartanhost',
    affId: '2459',
    urlTemplate: 'https://billing.spartanhost.net/aff.php?aff={affId}',
    supportsPid: false,
    originalUrl: 'https://billing.spartanhost.net/aff.php?aff=2459',
  },

  vmiss: {
    provider: 'vmiss',
    affId: '1922',
    urlTemplate: 'https://app.vmiss.com/aff.php?aff={affId}',
    supportsPid: false,
    originalUrl: 'https://app.vmiss.com/aff.php?aff=1922',
  },

  vps: {
    provider: 'vps',
    affId: '723',
    urlTemplate: 'https://vps.hosting/?affid={affId}',
    supportsPid: false,
    originalUrl: 'https://vps.hosting/?affid=723',
  },

  saltyfish: {
    provider: 'saltyfish',
    affId: '575',
    urlTemplate: 'https://portal.saltyfish.io/aff.php?aff={affId}',
    supportsPid: false,
    originalUrl: 'https://portal.saltyfish.io/aff.php?aff=575',
  },

  greencloudvps: {
    provider: 'greencloudvps',
    affId: '6807',
    urlTemplate: 'https://greencloudvps.com/billing/aff.php?aff={affId}',
    supportsPid: false,
    originalUrl: 'https://greencloudvps.com/billing/aff.php?aff=6807',
  },

  akilecloud: {
    provider: 'akilecloud',
    affId: '77106f01-65c7-4d97-af2a-2c043eef90b0',
    urlTemplate: 'https://akile.io/register?aff_code={affId}',
    supportsPid: false,
    originalUrl: 'https://akile.io/register?aff_code=77106f01-65c7-4d97-af2a-2c043eef90b0',
  },

  // ========== A-Tier Providers ==========

  racknerd: {
    provider: 'racknerd',
    affId: '5550',
    urlTemplate: 'https://my.racknerd.com/aff.php?aff={affId}&pid={pid}',
    supportsPid: true,
    originalUrl: 'https://my.racknerd.com/aff.php?aff=5550',
  },

  clouvider: {
    provider: 'clouvider',
    affId: '543',
    urlTemplate: 'https://console.clouvider.co.uk/?affid={affId}',
    supportsPid: false,
    originalUrl: 'https://console.clouvider.co.uk/?affid=543',
  },

  liteserver: {
    provider: 'liteserver',
    affId: '771',
    urlTemplate: 'https://clients.liteserver.nl/aff.php?aff={affId}',
    supportsPid: false,
    originalUrl: 'https://clients.liteserver.nl/aff.php?aff=771',
  },

  crunchbits: {
    provider: 'crunchbits',
    affId: 'PLACEHOLDER', // Excel 中没有 aff 参数
    urlTemplate: 'https://crunchbits.com/',
    supportsPid: false,
    originalUrl: 'https://crunchbits.com/',
  },

  servarica: {
    provider: 'servarica',
    affId: 'PLACEHOLDER', // Excel 中没有 aff 参数
    urlTemplate: 'https://clients.servarica.com/',
    supportsPid: false,
    originalUrl: 'https://clients.servarica.com/index.php',
  },

  evoxt: {
    provider: 'evoxt',
    affId: '994',
    urlTemplate: 'https://console.evoxt.com/aff.php?aff={affId}',
    supportsPid: false,
    originalUrl: 'https://console.evoxt.com/aff.php?aff=994',
  },

  alwyzon: {
    provider: 'alwyzon',
    affId: 'PLACEHOLDER', // Excel 中无数据
    urlTemplate: 'https://www.alwyzon.com/',
    supportsPid: false,
    originalUrl: 'https://www.alwyzon.com/',
  },

  dedirock: {
    provider: 'dedirock',
    affId: '77',
    urlTemplate: 'https://billing.dedirock.com/aff.php?aff={affId}',
    supportsPid: false,
    originalUrl: 'https://billing.dedirock.com/aff.php?aff=77',
  },

  onidel: {
    provider: 'onidel',
    affId: '1572199',
    urlTemplate: 'https://onidel.com/?referral={affId}',
    supportsPid: false,
    originalUrl: 'https://onidel.com/?referral=1572199',
  },

  // ========== B-Tier Providers ==========

  tierhive: {
    provider: 'tierhive',
    affId: '4FB89FE7369E',
    urlTemplate: 'https://tierhive.com/r/{affId}',
    supportsPid: false,
    originalUrl: 'https://tierhive.com/r/4FB89FE7369E',
  },

  gullos: {
    provider: 'gullos',
    affId: 'PLACEHOLDER', // Excel 中 Gullo's Hosting 无链接
    urlTemplate: 'https://hosting.gullo.me/',
    supportsPid: false,
    originalUrl: 'https://hosting.gullo.me/',
  },

  webhorizon: {
    provider: 'webhorizon',
    affId: 'PLACEHOLDER', // Excel 中无 aff 参数
    urlTemplate: 'https://my.webhorizon.net/',
    supportsPid: false,
    originalUrl: 'https://my.webhorizon.net/',
  },
};

/**
 * 生成 affiliate 链接
 * @param providerSlug Provider slug
 * @param whmcsPid WHMCS 产品 ID (数字字符串,如 "95")
 * @returns 完整的 affiliate 链接
 */
export function generateAffiliateUrl(
  providerSlug: string,
  whmcsPid?: string | null,
): string {
  const config = AFFILIATE_CONFIGS[providerSlug];

  if (!config) {
    console.warn(`No affiliate config for provider: ${providerSlug}`);
    return '#';
  }

  if (config.affId === 'PLACEHOLDER') {
    console.warn(`Affiliate ID not configured for provider: ${providerSlug}`);
    return config.urlTemplate;
  }

  let url = config.urlTemplate.replace('{affId}', config.affId);

  // 如果支持 PID 且提供了 whmcsPid,则添加 WHMCS PID
  if (config.supportsPid && whmcsPid) {
    url = url.replace('{pid}', whmcsPid);
  } else {
    // 移除未使用的 {pid} 占位符
    url = url.replace('&pid={pid}', '').replace('?pid={pid}', '');
  }

  return url;
}

/**
 * 生成短链接 slug (用于 /go/:slug)
 * @param providerSlug Provider slug
 * @param productId 可选的产品 ID
 * @returns 短链接 slug
 */
export function generateShortLinkSlug(
  providerSlug: string,
  productId?: string,
): string {
  if (productId) {
    // 产品级别: provider-product (例: bwg-dc6-95)
    return `${providerSlug}-${productId.replace(/[^a-z0-9-]/gi, '-')}`;
  }
  // Provider 级别: provider (例: buyvm)
  return providerSlug;
}

/**
 * 获取配置的 provider 数量
 */
export function getConfiguredProvidersCount(): number {
  return Object.keys(AFFILIATE_CONFIGS).filter(
    (key) => AFFILIATE_CONFIGS[key]?.affId !== 'PLACEHOLDER',
  ).length;
}

/**
 * 获取未配置的 provider 列表
 */
export function getUnconfiguredProviders(): string[] {
  return Object.keys(AFFILIATE_CONFIGS).filter(
    (key) => AFFILIATE_CONFIGS[key]?.affId === 'PLACEHOLDER',
  );
}
