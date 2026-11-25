import type { Locale } from './config';

export type Dictionary = {
  meta: {
    titleDefault: string;
    titleTemplate: string;
    description: string;
    stockTitle: string;
    stockDescription: string;
  };
  nav: {
    home: string;
    stock: string;
    offers: string;
    alerts: string;
    channel: string;
  };
  common: {
    order: string;
    orderNow: string;
    notifyMe: string;
    details: string;
    subscribe: string;
    source: string;
    reset: string;
    applyFilters: string;
    officialSite: string;
    officialWebsite: string;
    fullPage: string;
    monitor: string;
    na: string;
    yes: string;
    no: string;
    any: string;
    all: string;
    unknown: string;
    never: string;
    notChecked: string;
    unlimited: string;
    billed: string;
    chooseCurrency: string;
    anyCurrency: string;
    language: string;
    switchToZh: string;
    switchToEn: string;
    lightMode: string;
    darkMode: string;
  };
  stock: {
    inStock: string;
    soldOut: string;
    unknown: string;
    outOfStock: string;
  };
  offerTag: {
    special: string;
    promo: string;
    limited: string;
    regular: string;
    limitedBadge: string;
  };
  category: {
    vps: string;
    vds: string;
    dedicated: string;
    nat_vps: string;
    storage: string;
  };
  footer: {
    getAlerts: string;
    offersChannel: string;
    disclaimer: string;
  };
  home: {
    tagline: string;
    getAlerts: string;
    offersChannel: string;
    browseStock: string;
    providerStatus: string;
    stockMonitor: string;
    inStockCount: string;
    unknownCount: string;
    productsCount: string;
    checked: string;
    latestRestocks: string;
    noRestocks: string;
    newOffers: string;
    viewAll: string;
    noOffers: string;
    limitedOffers: string;
    noLimitedOffers: string;
    recentlySoldOut: string;
    catchNext: string;
    noSoldOut: string;
    recentEvents: string;
    unspecified: string;
    priceUnavailable: string;
    offerFallback: string;
  };
  providers: {
    title: string;
    monitored: string;
    allProviders: string;
    noActive: string;
    summary: string;
    lastCheckedUnknown: string;
    specsMode: string;
    minimum: string;
    exact: string;
    stock: string;
    region: string;
    allRegions: string;
    location: string;
    allLocations: string;
    category: string;
    allTypes: string;
    optimizedLine: string;
    allLines: string;
    standardLine: string;
    ram: string;
    storage: string;
    diskType: string;
    bandwidth: string;
    cpu: string;
    ipv4: string;
    included: string;
    notIncluded: string;
    billing: string;
    allCycles: string;
    currency: string;
    allCurrencies: string;
    offer: string;
    allOffers: string;
    minMonthly: string;
    maxMonthly: string;
    sort: string;
    sortPriceAsc: string;
    sortPriceDesc: string;
    sortName: string;
    search: string;
    searchPlaceholder: string;
    shown: string;
    noMatch: string;
    plan: string;
    type: string;
    line: string;
    offerCol: string;
    priceMonthly: string;
    status: string;
    action: string;
    anyRam: string;
    ram1: string;
    ram2: string;
    ram4: string;
    ram8: string;
    ram16: string;
    anyDisk: string;
    disk20: string;
    disk40: string;
    disk80: string;
    disk160: string;
    disk320: string;
    disk500: string;
    disk1tb: string;
    anyDiskType: string;
    anyBandwidth: string;
    bw05: string;
    bw1: string;
    bw2: string;
    bw5: string;
    bw10: string;
    bwUnmetered: string;
    anyCpu: string;
    cpu1: string;
    cpu2: string;
    cpu4: string;
    cpu8: string;
  };
  offers: {
    eyebrow: string;
    title: string;
    subtitle: string;
    provider: string;
    allProviders: string;
    category: string;
    allCategories: string;
    region: string;
    allRegions: string;
    location: string;
    allLocations: string;
    billing: string;
    allBilling: string;
    network: string;
    anyNetwork: string;
    ipv4Included: string;
    availability: string;
    anyStock: string;
    limitedOnly: string;
    minPrice: string;
    maxPrice: string;
    any: string;
    sort: string;
    newest: string;
    priceAsc: string;
    priceDesc: string;
    count: string;
    noMatch: string;
    price: string;
    locations: string;
    ipv4: string;
    unspecified: string;
    included: string;
    notIncluded: string;
    priceUnavailable: string;
    recentlyDiscovered: string;
    offerFallback: string;
    bodyFallback: string;
  };
  provider: {
    notFound: string;
    stockMonitor: string;
    subscribeTelegram: string;
    lastChecked: string;
    statusUnknown: string;
    availablePlans: string;
    noInStock: string;
    stockUnknown: string;
    catalogOnly: string;
    outOfStock: string;
    noSoldOut: string;
    plan: string;
    location: string;
    line: string;
    cpu: string;
    ram: string;
    storage: string;
    bandwidth: string;
    price: string;
    lastCheckedCol: string;
    action: string;
  };
  plan: {
    notFound: string;
    stock: string;
    specifications: string;
    priceHistory: string;
    stockTimeline: string;
    noTransitions: string;
    restocked: string;
    manualOverride: string;
    soldOut: string;
    lastChecked: string;
    cpu: string;
    ram: string;
    storage: string;
    bandwidth: string;
    optimizedLine: string;
    ipv4: string;
    category: string;
    billing: string;
    availability: string;
    inStock: string;
    unknownCatalog: string;
    soldOutStatus: string;
    currentlyInStock: string;
    currentlyOutOfStock: string;
  };
};

const zh: Dictionary = {
  meta: {
    titleDefault: 'VPSKnow Stock — VPS 补货监控',
    titleTemplate: '%s | VPSKnow Stock',
    description: '实时 VPS 补货监控与精选优惠聚合。',
    stockTitle: 'VPS 库存监控',
    stockDescription: '浏览已监控的 VPS 商家与套餐实时库存。',
  },
  nav: {
    home: '首页',
    stock: '库存',
    offers: '优惠',
    alerts: '订阅提醒',
    channel: '频道',
  },
  common: {
    order: '下单',
    orderNow: '立即下单',
    notifyMe: '到货提醒',
    details: '详情',
    subscribe: '订阅',
    source: '来源',
    reset: '重置',
    applyFilters: '应用筛选',
    officialSite: '官网',
    officialWebsite: '官方网站',
    fullPage: '完整页面',
    monitor: '监控',
    na: '暂无',
    yes: '是',
    no: '否',
    any: '不限',
    all: '全部',
    unknown: '未知',
    never: '从未',
    notChecked: '尚未检查',
    unlimited: '不限流量',
    billed: '实付',
    chooseCurrency: '先选货币',
    anyCurrency: '不限',
    language: '语言',
    switchToZh: '切换到中文',
    switchToEn: '切换到英文',
    lightMode: '浅色模式',
    darkMode: '深色模式',
  },
  stock: {
    inStock: '有货',
    soldOut: '售罄',
    unknown: '未知',
    outOfStock: '缺货',
  },
  offerTag: {
    special: '特价',
    promo: '促销',
    limited: '限量',
    regular: '常规',
    limitedBadge: '限量',
  },
  category: {
    vps: 'VPS',
    vds: 'VDS',
    dedicated: '独立服务器',
    nat_vps: 'NAT VPS',
    storage: '存储',
  },
  footer: {
    getAlerts: '订阅补货提醒 (@vpsknow_stock_bot)',
    offersChannel: '优惠频道',
    disclaimer: '下单链接经 VPSKnow 联盟短链跳转。补货提醒与精选优惠是两类独立事件。',
  },
  home: {
    tagline: '实时 VPS 补货监控与精选优惠推送。',
    getAlerts: '订阅补货提醒',
    offersChannel: '优惠频道',
    browseStock: '浏览库存 →',
    providerStatus: '商家状态',
    stockMonitor: '库存监控',
    inStockCount: '有货',
    unknownCount: '未知',
    productsCount: '套餐',
    checked: '检查于',
    latestRestocks: '最新补货',
    noRestocks: '暂无补货记录。',
    newOffers: '最新优惠',
    viewAll: '查看全部',
    noOffers: '暂无新优惠。',
    limitedOffers: '限量优惠',
    noLimitedOffers: '暂无限量优惠。',
    recentlySoldOut: '最近售罄',
    catchNext: '等下一次补货',
    noSoldOut: '暂无售罄记录。',
    recentEvents: '最近事件',
    unspecified: '未标明',
    priceUnavailable: '价格未知',
    offerFallback: '优惠',
  },
  providers: {
    title: '商家',
    monitored: '家监控中',
    allProviders: '全部商家',
    noActive: '暂无启用中的商家。',
    summary: '{inStock} 有货 · {plans} 个套餐 · 最近检查：{checked}',
    lastCheckedUnknown: '未知',
    specsMode: '规格模式',
    minimum: '最低 (≥)',
    exact: '精确 (=)',
    stock: '库存',
    region: '地区',
    allRegions: '全部地区',
    location: '机房',
    allLocations: '全部机房',
    category: '类型',
    allTypes: '全部类型',
    optimizedLine: '优化线路',
    allLines: '全部线路',
    standardLine: '常规 / 未分类',
    ram: '内存',
    storage: '硬盘',
    diskType: '硬盘类型',
    bandwidth: '流量',
    cpu: 'CPU',
    ipv4: 'IPv4',
    included: '包含',
    notIncluded: '不包含',
    billing: '计费周期',
    allCycles: '全部周期',
    currency: '货币',
    allCurrencies: '全部货币',
    offer: '优惠标签',
    allOffers: '全部优惠',
    minMonthly: '最低月折合价',
    maxMonthly: '最高月折合价',
    sort: '排序',
    sortPriceAsc: '月折合价 ↑（促销优先）',
    sortPriceDesc: '月折合价 ↓',
    sortName: '套餐名',
    search: '搜索',
    searchPlaceholder: '套餐 / 机房 / ID',
    shown: '条结果',
    noMatch: '没有符合当前筛选的套餐。',
    plan: '套餐',
    type: '类型',
    line: '线路',
    offerCol: '优惠',
    priceMonthly: '价格 / 月折合',
    status: '状态',
    action: '操作',
    anyRam: '不限内存',
    ram1: '≥ 1 GB',
    ram2: '≥ 2 GB',
    ram4: '≥ 4 GB',
    ram8: '≥ 8 GB',
    ram16: '≥ 16 GB',
    anyDisk: '不限硬盘',
    disk20: '≥ 20 GB',
    disk40: '≥ 40 GB',
    disk80: '≥ 80 GB',
    disk160: '≥ 160 GB',
    disk320: '≥ 320 GB',
    disk500: '≥ 500 GB',
    disk1tb: '≥ 1 TB',
    anyDiskType: '不限硬盘类型',
    anyBandwidth: '不限流量',
    bw05: '≥ 0.5 TB',
    bw1: '≥ 1 TB',
    bw2: '≥ 2 TB',
    bw5: '≥ 5 TB',
    bw10: '≥ 10 TB',
    bwUnmetered: '不限 / ≥ 100 TB',
    anyCpu: '不限 CPU',
    cpu1: '≥ 1 vCPU',
    cpu2: '≥ 2 vCPU',
    cpu4: '≥ 4 vCPU',
    cpu8: '≥ 8 vCPU',
  },
  offers: {
    eyebrow: '精选 VPS 优惠',
    title: '最新 VPS 优惠',
    subtitle: '精选 VPS 优惠，含价格、机房与下单链接。',
    provider: '商家',
    allProviders: '全部商家',
    category: '类型',
    allCategories: '全部类型',
    region: '地区',
    allRegions: '全部地区',
    location: '机房',
    allLocations: '全部机房',
    billing: '计费',
    allBilling: '全部计费周期',
    network: '网络',
    anyNetwork: '不限网络',
    ipv4Included: '含 IPv4',
    availability: '库存',
    anyStock: '不限库存',
    limitedOnly: '仅限量',
    minPrice: '最低价 (USD)',
    maxPrice: '最高价 (USD)',
    any: '不限',
    sort: '排序',
    newest: '最新',
    priceAsc: '价格：从低到高',
    priceDesc: '价格：从高到低',
    count: '条优惠',
    noMatch: '没有符合当前筛选的优惠。',
    price: '价格',
    locations: '机房',
    ipv4: 'IPv4',
    unspecified: '未标明',
    included: '包含',
    notIncluded: '不包含',
    priceUnavailable: '价格未知',
    recentlyDiscovered: '最近发现',
    offerFallback: '优惠',
    bodyFallback: '打开下单链接可查看完整详情。',
  },
  provider: {
    notFound: '商家未找到',
    stockMonitor: '库存监控',
    subscribeTelegram: 'Telegram 订阅',
    lastChecked: '最近检查：',
    statusUnknown: '状态未知',
    availablePlans: '有货套餐',
    noInStock: '暂无有货套餐。',
    stockUnknown: '库存未知',
    catalogOnly: '仅目录刷新，实时库存未确认（例如 Cloudflare 拦截的 VMISS）。',
    outOfStock: '已售罄',
    noSoldOut: '暂无售罄套餐。',
    plan: '套餐',
    location: '机房',
    line: '线路',
    cpu: 'CPU',
    ram: '内存',
    storage: '硬盘',
    bandwidth: '流量',
    price: '价格',
    lastCheckedCol: '最近检查',
    action: '操作',
  },
  plan: {
    notFound: '套餐未找到',
    stock: '库存',
    specifications: '规格',
    priceHistory: '价格历史',
    stockTimeline: '库存时间线',
    noTransitions: '暂无库存状态变更记录。',
    restocked: '补货',
    manualOverride: '人工覆盖',
    soldOut: '售罄',
    lastChecked: '最近检查：',
    cpu: 'CPU',
    ram: '内存',
    storage: '硬盘',
    bandwidth: '流量',
    optimizedLine: '优化线路',
    ipv4: 'IPv4',
    category: '类型',
    billing: '计费',
    availability: '库存状态',
    inStock: '有货',
    unknownCatalog: '未知（目录）',
    soldOutStatus: '售罄',
    currentlyInStock: '当前有货',
    currentlyOutOfStock: '当前缺货',
  },
};

const en: Dictionary = {
  meta: {
    titleDefault: 'VPSKnow Stock — VPS Restock Alerts',
    titleTemplate: '%s | VPSKnow Stock',
    description: 'Real-time VPS restock monitoring and curated offer aggregation.',
    stockTitle: 'VPS Stock Monitor',
    stockDescription: 'Browse monitored VPS providers and live plan availability.',
  },
  nav: {
    home: 'Home',
    stock: 'Stock',
    offers: 'Offers',
    alerts: 'Alerts',
    channel: 'Channel',
  },
  common: {
    order: 'Order',
    orderNow: 'Order Now',
    notifyMe: 'Notify Me',
    details: 'Details',
    subscribe: 'Subscribe',
    source: 'Source',
    reset: 'Reset',
    applyFilters: 'Apply filters',
    officialSite: 'Official site',
    officialWebsite: 'Official website',
    fullPage: 'Full page',
    monitor: 'Monitor',
    na: 'N/A',
    yes: 'Yes',
    no: 'No',
    any: 'Any',
    all: 'All',
    unknown: 'Unknown',
    never: 'never',
    notChecked: 'Not checked',
    unlimited: 'Unmetered',
    billed: 'billed',
    chooseCurrency: 'Choose currency',
    anyCurrency: 'Any',
    language: 'Language',
    switchToZh: 'Switch to Chinese',
    switchToEn: 'Switch to English',
    lightMode: 'Light mode',
    darkMode: 'Dark mode',
  },
  stock: {
    inStock: 'In Stock',
    soldOut: 'Sold Out',
    unknown: 'Unknown',
    outOfStock: 'Out of Stock',
  },
  offerTag: {
    special: 'Special',
    promo: 'Promo',
    limited: 'Limited',
    regular: 'Regular',
    limitedBadge: 'LIMITED',
  },
  category: {
    vps: 'VPS',
    vds: 'VDS',
    dedicated: 'Dedicated',
    nat_vps: 'NAT VPS',
    storage: 'Storage',
  },
  footer: {
    getAlerts: 'Get restock alerts (@vpsknow_stock_bot)',
    offersChannel: 'Offers channel',
    disclaimer:
      'Order links go through VPSKnow affiliate short links. Restock alerts and curated offers are separate event types.',
  },
  home: {
    tagline: 'Real-time VPS restock monitoring and curated offer alerts.',
    getAlerts: 'Get restock alerts',
    offersChannel: 'Offers channel',
    browseStock: 'Browse stock →',
    providerStatus: 'Provider Status',
    stockMonitor: 'Stock monitor',
    inStockCount: 'in stock',
    unknownCount: 'unknown',
    productsCount: 'products',
    checked: 'Checked',
    latestRestocks: 'Latest Restocks',
    noRestocks: 'No restocks yet.',
    newOffers: 'New Offers',
    viewAll: 'View all',
    noOffers: 'No new offers yet.',
    limitedOffers: 'Limited Offers',
    noLimitedOffers: 'No limited offers available.',
    recentlySoldOut: 'Recently Sold Out',
    catchNext: 'Catch the next restock',
    noSoldOut: 'No sold-out events yet.',
    recentEvents: 'Recent Events',
    unspecified: 'Unspecified',
    priceUnavailable: 'Price unavailable',
    offerFallback: 'Offer',
  },
  providers: {
    title: 'Providers',
    monitored: 'monitored',
    allProviders: 'All Providers',
    noActive: 'No active providers.',
    summary: '{inStock} in stock · {plans} plans · Last checked: {checked}',
    lastCheckedUnknown: 'Unknown',
    specsMode: 'Specs mode',
    minimum: 'Minimum (≥)',
    exact: 'Exact (=)',
    stock: 'Stock',
    region: 'Region',
    allRegions: 'All regions',
    location: 'Location',
    allLocations: 'All locations',
    category: 'Category',
    allTypes: 'All types',
    optimizedLine: 'Optimized line',
    allLines: 'All lines',
    standardLine: 'Standard / unclassified',
    ram: 'RAM',
    storage: 'Storage',
    diskType: 'Disk type',
    bandwidth: 'Bandwidth',
    cpu: 'CPU',
    ipv4: 'IPv4',
    included: 'Included',
    notIncluded: 'Not included',
    billing: 'Billing',
    allCycles: 'All cycles',
    currency: 'Currency',
    allCurrencies: 'All currencies',
    offer: 'Offer',
    allOffers: 'All offers',
    minMonthly: 'Min monthly price',
    maxMonthly: 'Max monthly price',
    sort: 'Sort',
    sortPriceAsc: 'Monthly price ↑ (promo first)',
    sortPriceDesc: 'Monthly price ↓',
    sortName: 'Plan name',
    search: 'Search',
    searchPlaceholder: 'Plan / location / ID',
    shown: 'shown',
    noMatch: 'No plans match the current filters.',
    plan: 'Plan',
    type: 'Type',
    line: 'Line',
    offerCol: 'Offer',
    priceMonthly: 'Price / Monthly',
    status: 'Status',
    action: 'Action',
    anyRam: 'Any RAM',
    ram1: '≥ 1 GB',
    ram2: '≥ 2 GB',
    ram4: '≥ 4 GB',
    ram8: '≥ 8 GB',
    ram16: '≥ 16 GB',
    anyDisk: 'Any disk',
    disk20: '≥ 20 GB',
    disk40: '≥ 40 GB',
    disk80: '≥ 80 GB',
    disk160: '≥ 160 GB',
    disk320: '≥ 320 GB',
    disk500: '≥ 500 GB',
    disk1tb: '≥ 1 TB',
    anyDiskType: 'Any disk type',
    anyBandwidth: 'Any bandwidth',
    bw05: '≥ 0.5 TB',
    bw1: '≥ 1 TB',
    bw2: '≥ 2 TB',
    bw5: '≥ 5 TB',
    bw10: '≥ 10 TB',
    bwUnmetered: 'Unmetered / ≥ 100 TB',
    anyCpu: 'Any CPU',
    cpu1: '≥ 1 vCPU',
    cpu2: '≥ 2 vCPU',
    cpu4: '≥ 4 vCPU',
    cpu8: '≥ 8 vCPU',
  },
  offers: {
    eyebrow: 'CURATED VPS DEALS',
    title: 'Latest VPS Offers',
    subtitle: 'Curated VPS deals with pricing, locations, and order links.',
    provider: 'Provider',
    allProviders: 'All providers',
    category: 'Category',
    allCategories: 'All categories',
    region: 'Region',
    allRegions: 'All regions',
    location: 'Location',
    allLocations: 'All locations',
    billing: 'Billing',
    allBilling: 'All billing cycles',
    network: 'Network',
    anyNetwork: 'Any network',
    ipv4Included: 'IPv4 included',
    availability: 'Availability',
    anyStock: 'Any stock',
    limitedOnly: 'Limited only',
    minPrice: 'Min price (USD)',
    maxPrice: 'Max price (USD)',
    any: 'Any',
    sort: 'Sort',
    newest: 'Newest',
    priceAsc: 'Price: low to high',
    priceDesc: 'Price: high to low',
    count: 'offers',
    noMatch: 'No offers match the current filters.',
    price: 'Price',
    locations: 'Locations',
    ipv4: 'IPv4',
    unspecified: 'Unspecified',
    included: 'Included',
    notIncluded: 'Not included',
    priceUnavailable: 'Price unavailable',
    recentlyDiscovered: 'Recently discovered',
    offerFallback: 'Offer',
    bodyFallback: 'Offer details available after opening the order link.',
  },
  provider: {
    notFound: 'Provider Not Found',
    stockMonitor: 'Stock monitor',
    subscribeTelegram: 'Subscribe on Telegram',
    lastChecked: 'Last checked: ',
    statusUnknown: 'Status Unknown',
    availablePlans: 'Available Plans',
    noInStock: 'No in-stock plans.',
    stockUnknown: 'Stock Unknown',
    catalogOnly:
      'Catalog-only refresh — live inventory is not confirmed (for example VMISS behind Cloudflare).',
    outOfStock: 'Out of Stock',
    noSoldOut: 'No sold-out plans.',
    plan: 'Plan',
    location: 'Location',
    line: 'Line',
    cpu: 'CPU',
    ram: 'RAM',
    storage: 'Storage',
    bandwidth: 'Bandwidth',
    price: 'Price',
    lastCheckedCol: 'Last Checked',
    action: 'Action',
  },
  plan: {
    notFound: 'Plan Not Found',
    stock: 'Stock',
    specifications: 'Specifications',
    priceHistory: 'Price History',
    stockTimeline: 'Stock Timeline',
    noTransitions: 'No stock transitions recorded yet.',
    restocked: 'Restocked',
    manualOverride: 'Manual Override',
    soldOut: 'Sold Out',
    lastChecked: 'Last checked: ',
    cpu: 'CPU',
    ram: 'RAM',
    storage: 'Storage',
    bandwidth: 'Bandwidth',
    optimizedLine: 'Optimized line',
    ipv4: 'IPv4',
    category: 'Category',
    billing: 'Billing',
    availability: 'Availability',
    inStock: 'In stock',
    unknownCatalog: 'Unknown (catalog)',
    soldOutStatus: 'Sold out',
    currentlyInStock: 'currently in stock',
    currentlyOutOfStock: 'currently out of stock',
  },
};

export const dictionaries: Record<Locale, Dictionary> = { zh, en };

export function getDictionarySync(locale: Locale): Dictionary {
  return dictionaries[locale];
}
