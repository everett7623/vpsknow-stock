/**
 * Affiliate 配置文件 - 从 Excel 导入的真实数据
 *
 * 数据来源: 主机与域名服务商短链接汇总-20260801.xlsx
 * 更新时间: 2026-08-01
 */

interface AffiliateConfigBase {
  /** Provider slug */
  provider: string;
  /** Affiliate ID (从原链接中提取) */
  affId: string;
  /** Affiliate 链接模板 (使用 {affId} 和 {pid} 占位符) */
  urlTemplate: string;
  /** 原始 affiliate 链接 (参考) */
  originalUrl?: string;
}

export type AffiliateConfig = AffiliateConfigBase &
  (
    | {
        /** 已确认支持 WHMCS 产品级 PID */
        supportsPid: true;
        /** PID 的可靠来源 */
        pidSource: 'order-url' | 'whmcs-card-id';
        productAffiliate?: never;
      }
    | {
        supportsPid: false;
        pidSource?: never;
        /** 非 WHMCS 系统经实站验证的产品级 affiliate 参数合并规则 */
        productAffiliate?: {
          strategy: 'query-param';
          parameter: string;
          allowedOrigin: string;
        };
      }
  );

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
    pidSource: 'order-url',
    originalUrl: 'https://bandwagonhost.com/aff.php?aff=68376',
  },

  dmit: {
    provider: 'dmit',
    affId: '6077',
    urlTemplate: 'https://www.dmit.io/aff.php?aff={affId}&pid={pid}',
    supportsPid: true,
    pidSource: 'order-url',
    originalUrl: 'https://www.dmit.io/aff.php?aff=6077',
  },

  buyvm: {
    provider: 'buyvm',
    affId: '6836',
    urlTemplate: 'https://my.frantech.ca/aff.php?aff={affId}&pid={pid}',
    supportsPid: true,
    pidSource: 'order-url',
    originalUrl: 'https://my.frantech.ca/aff.php?aff=6836',
  },

  spartanhost: {
    provider: 'spartanhost',
    affId: '2459',
    urlTemplate: 'https://billing.spartanhost.net/aff.php?aff={affId}&pid={pid}',
    supportsPid: true,
    pidSource: 'order-url',
    originalUrl: 'https://billing.spartanhost.net/aff.php?aff=2459',
  },

  vmiss: {
    provider: 'vmiss',
    affId: '1922',
    urlTemplate: 'https://app.vmiss.com/aff.php?aff={affId}&pid={pid}',
    supportsPid: true,
    pidSource: 'whmcs-card-id',
    originalUrl: 'https://app.vmiss.com/aff.php?aff=1922',
  },

  vps: {
    provider: 'vps',
    affId: '723',
    urlTemplate: 'https://vps.hosting/?affid={affId}',
    supportsPid: false,
    productAffiliate: {
      strategy: 'query-param',
      parameter: 'affid',
      allowedOrigin: 'https://vps.hosting',
    },
    originalUrl: 'https://vps.hosting/?affid=723',
  },

  saltyfish: {
    provider: 'saltyfish',
    affId: '575',
    urlTemplate: 'https://portal.saltyfish.io/aff.php?aff={affId}&pid={pid}',
    supportsPid: true,
    pidSource: 'whmcs-card-id',
    originalUrl: 'https://portal.saltyfish.io/aff.php?aff=575',
  },

  greencloudvps: {
    provider: 'greencloudvps',
    affId: '6807',
    urlTemplate: 'https://greencloudvps.com/billing/aff.php?aff={affId}&pid={pid}',
    supportsPid: true,
    pidSource: 'whmcs-card-id',
    originalUrl: 'https://greencloudvps.com/billing/aff.php?aff=6807',
  },

  // ========== Approved Provider Additions ==========

  hncloud: {
    provider: 'hncloud',
    affId: '7940T0',
    urlTemplate: 'https://www.hncloud.com?k={affId}',
    supportsPid: false,
    productAffiliate: {
      strategy: 'query-param',
      parameter: 'k',
      allowedOrigin: 'https://www.hncloud.com',
    },
    originalUrl: 'https://www.hncloud.com?k=7940T0',
  },

  neburst: {
    provider: 'neburst',
    affId: '3cvoo',
    urlTemplate: 'https://neburst.com/auth/sign-up/?aff={affId}',
    supportsPid: false,
    originalUrl: 'https://neburst.com/auth/sign-up/?aff=3cvoo',
  },

  bestvm: {
    provider: 'bestvm',
    affId: '225',
    urlTemplate: 'https://bestvm.cloud/aff.php?aff={affId}&pid={pid}',
    supportsPid: true,
    pidSource: 'whmcs-card-id',
    originalUrl: 'https://bestvm.cloud/aff.php?aff=225',
  },

  highendnetwork: {
    provider: 'highendnetwork',
    affId: '68',
    urlTemplate: 'https://billing.highendnetwork.com/aff.php?aff={affId}',
    supportsPid: false,
    originalUrl: 'https://billing.highendnetwork.com/aff.php?aff=68',
  },

  // ========== A-Tier Providers ==========

  racknerd: {
    provider: 'racknerd',
    affId: '5550',
    urlTemplate: 'https://my.racknerd.com/aff.php?aff={affId}&pid={pid}',
    supportsPid: true,
    pidSource: 'whmcs-card-id',
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
    urlTemplate: 'https://clients.liteserver.nl/aff.php?aff={affId}&pid={pid}',
    supportsPid: true,
    pidSource: 'whmcs-card-id',
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
    urlTemplate: 'https://billing.dedirock.com/aff.php?aff={affId}&pid={pid}',
    supportsPid: true,
    pidSource: 'whmcs-card-id',
    originalUrl: 'https://billing.dedirock.com/aff.php?aff=77',
  },

  onidel: {
    provider: 'onidel',
    affId: '1572199',
    urlTemplate: 'https://onidel.com/?referral={affId}',
    supportsPid: false,
    originalUrl: 'https://onidel.com/?referral=1572199',
  },

  bagevm: {
    provider: 'bagevm',
    affId: '10',
    urlTemplate: 'https://www.bagevm.com/aff.php?aff={affId}&pid={pid}',
    supportsPid: true,
    pidSource: 'whmcs-card-id',
    originalUrl: 'https://www.bagevm.com/aff.php?aff=10',
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

  vmrack: {
    provider: 'vmrack',
    affId: '5YrpHKG16xf',
    urlTemplate: 'https://www.vmrack.net/vps?ref_code={affId}',
    supportsPid: false,
    productAffiliate: {
      strategy: 'query-param',
      parameter: 'ref_code',
      allowedOrigin: 'https://www.vmrack.net',
    },
    originalUrl: 'https://www.vmrack.net/vps?ref_code=5YrpHKG16xf',
  },

  gomami: {
    provider: 'gomami',
    affId: '209',
    urlTemplate: 'https://gomami.io/aff.php?aff={affId}&pid={pid}',
    supportsPid: true,
    pidSource: 'whmcs-card-id',
    originalUrl: 'https://gomami.io/aff.php?aff=209',
  },

  zgocloud: {
    provider: 'zgocloud',
    affId: '488',
    urlTemplate: 'https://clients.zgovps.com/?affid={affId}',
    supportsPid: false,
    productAffiliate: {
      strategy: 'query-param',
      parameter: 'affid',
      allowedOrigin: 'https://clients.zgovps.com',
    },
    originalUrl: 'https://clients.zgovps.com/?affid=488',
  },

  colocrossing: {
    provider: 'colocrossing',
    affId: '467',
    urlTemplate: 'https://cloud.colocrossing.com/aff.php?aff={affId}&pid={pid}',
    supportsPid: true,
    pidSource: 'whmcs-card-id',
    originalUrl: 'https://cloud.colocrossing.com/aff.php?aff=467',
  },

  chicagovps: {
    provider: 'chicagovps',
    affId: '2611',
    urlTemplate: 'https://billing.chicagovps.net/aff.php?aff={affId}&pid={pid}',
    supportsPid: true,
    pidSource: 'whmcs-card-id',
    originalUrl: 'https://billing.chicagovps.net/aff.php?aff=2611',
  },

  lightlayer: {
    provider: 'lightlayer',
    affId: '647',
    urlTemplate: 'https://account.lightlayer.net/?affid={affId}',
    supportsPid: false,
    productAffiliate: {
      strategy: 'query-param',
      parameter: 'affid',
      allowedOrigin: 'https://account.lightlayer.net',
    },
    originalUrl: 'https://account.lightlayer.net/?affid=647',
  },

  speedypage: {
    provider: 'speedypage',
    affId: '405',
    urlTemplate: 'https://my.speedypage.com/aff.php?aff={affId}&pid={pid}',
    supportsPid: true,
    pidSource: 'whmcs-card-id',
    originalUrl: 'https://my.speedypage.com/aff.php?aff=405',
  },
};

/**
 * 生成 affiliate 链接
 * @param providerSlug Provider slug
 * @param whmcsPid WHMCS 产品 ID (数字字符串,如 "95")
 * @returns 完整的 affiliate 链接
 */
export function generateAffiliateUrl(providerSlug: string, whmcsPid?: string | null): string {
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
 * 仅为明确支持 WHMCS PID 的 provider 提取产品 ID。
 */
export function extractWhmcsPid(
  providerSlug: string,
  orderUrl: string,
  productId: string,
): string | null {
  const config = AFFILIATE_CONFIGS[providerSlug];
  if (!config?.supportsPid) return null;

  try {
    const pid = new URL(orderUrl).searchParams.get('pid');
    if (pid && /^\d+$/.test(pid)) return pid;
  } catch {
    // URL 无效时继续检查 adapter 的外部产品 ID。
  }

  if (config.pidSource !== 'whmcs-card-id') return null;
  return productId.match(/(?:^|[-_])(\d+)$/)?.[1] ?? null;
}

/**
 * 生成产品级目标链接。只有经过验证的映射才会合并 affiliate 参数。
 */
export function buildProductAffiliateUrl(
  providerSlug: string,
  orderUrl: string,
  whmcsPid?: string | null,
): string {
  const config = AFFILIATE_CONFIGS[providerSlug];
  if (!config) return orderUrl;

  if (config.supportsPid && whmcsPid) {
    return generateAffiliateUrl(providerSlug, whmcsPid);
  }

  if (config.productAffiliate?.strategy === 'query-param') {
    try {
      const url = new URL(orderUrl);
      if (url.origin !== config.productAffiliate.allowedOrigin) return orderUrl;
      url.searchParams.set(config.productAffiliate.parameter, config.affId);
      return url.href;
    } catch {
      return orderUrl;
    }
  }

  return orderUrl;
}

/**
 * 生成短链接 slug (用于 /go/:slug)
 * @param providerSlug Provider slug
 * @param productId 可选的产品 ID
 * @returns 短链接 slug
 */
export function generateShortLinkSlug(providerSlug: string, productId?: string): string {
  if (productId) {
    const normalizedProductId = productId.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const providerPrefix = `${providerSlug.toLowerCase()}-`;

    // Adapter 的 productId 可能已包含 provider 前缀，避免生成 provider-provider-product。
    return normalizedProductId.startsWith(providerPrefix)
      ? normalizedProductId
      : `${providerSlug}-${normalizedProductId}`;
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
