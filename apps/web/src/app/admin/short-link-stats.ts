import { Prisma } from '@vpsknow/database';
import { prisma } from '@vpsknow/database';

const SHANGHAI_TZ = 'Asia/Shanghai';

export type PeriodKey = 'today' | 'd7' | 'd30' | 'all';

export interface ClickPeriodTotals {
  today: number;
  d7: number;
  d30: number;
  all: number;
}

export interface ProviderClickStats {
  providerId: string;
  name: string;
  slug: string;
  links: number;
  today: number;
  d7: number;
  d30: number;
  all: number;
  lastClickedAt: Date | null;
}

export interface LinkClickStats {
  id: string;
  slug: string;
  providerName: string;
  today: number;
  d7: number;
  d30: number;
  all: number;
  lastClickedAt: Date | null;
}

export interface DailyClickBucket {
  day: string; // YYYY-MM-DD in Asia/Shanghai
  clicks: number;
}

export interface RecentClickRow {
  id: string;
  clickedAt: Date;
  slug: string;
  providerName: string;
  referer: string | null;
}

/** Calendar midnight in Asia/Shanghai for the given instant. */
export function startOfShanghaiDay(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SHANGHAI_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) {
    throw new Error('Failed to resolve Asia/Shanghai calendar day');
  }
  return new Date(`${year}-${month}-${day}T00:00:00+08:00`);
}

function emptyCounts(): ClickPeriodTotals {
  return { today: 0, d7: 0, d30: 0, all: 0 };
}

function addCount(target: ClickPeriodTotals, period: PeriodKey, amount: number): void {
  target[period] += amount;
}

export async function loadShortLinkStats(now = new Date()): Promise<{
  totals: ClickPeriodTotals;
  providers: ProviderClickStats[];
  topLinks: LinkClickStats[];
  daily: DailyClickBucket[];
  recent: RecentClickRow[];
  linkCount: number;
  linksWithTraffic: number;
}> {
  const todayStart = startOfShanghaiDay(now);
  const d7Start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d30Start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const dailyStart = new Date(todayStart.getTime() - 13 * 24 * 60 * 60 * 1000);

  const [links, todayGroups, d7Groups, d30Groups, dailyRows, recent] = await Promise.all([
    prisma.affiliateLink.findMany({
      select: {
        id: true,
        slug: true,
        clicks: true,
        lastClickedAt: true,
        providerId: true,
        provider: { select: { name: true, slug: true } },
      },
      orderBy: [{ clicks: 'desc' }, { slug: 'asc' }],
    }),
    prisma.affiliateClick.groupBy({
      by: ['affiliateLinkId'],
      where: { clickedAt: { gte: todayStart } },
      _count: { _all: true },
    }),
    prisma.affiliateClick.groupBy({
      by: ['affiliateLinkId'],
      where: { clickedAt: { gte: d7Start } },
      _count: { _all: true },
    }),
    prisma.affiliateClick.groupBy({
      by: ['affiliateLinkId'],
      where: { clickedAt: { gte: d30Start } },
      _count: { _all: true },
    }),
    prisma.$queryRaw<Array<{ day: Date; clicks: bigint }>>(Prisma.sql`
      SELECT
        (timezone('Asia/Shanghai', "clickedAt"))::date AS day,
        COUNT(*)::bigint AS clicks
      FROM "affiliate_clicks"
      WHERE "clickedAt" >= ${dailyStart}
      GROUP BY 1
      ORDER BY 1 ASC
    `),
    prisma.affiliateClick.findMany({
      take: 30,
      orderBy: { clickedAt: 'desc' },
      select: {
        id: true,
        clickedAt: true,
        referer: true,
        affiliateLink: {
          select: {
            slug: true,
            provider: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const todayMap = new Map(todayGroups.map((row) => [row.affiliateLinkId, row._count._all]));
  const d7Map = new Map(d7Groups.map((row) => [row.affiliateLinkId, row._count._all]));
  const d30Map = new Map(d30Groups.map((row) => [row.affiliateLinkId, row._count._all]));

  const totals = emptyCounts();
  const providerMap = new Map<string, ProviderClickStats>();
  const linkStats: LinkClickStats[] = [];

  for (const link of links) {
    const today = todayMap.get(link.id) ?? 0;
    const d7 = d7Map.get(link.id) ?? 0;
    const d30 = d30Map.get(link.id) ?? 0;
    const all = link.clicks;

    addCount(totals, 'today', today);
    addCount(totals, 'd7', d7);
    addCount(totals, 'd30', d30);
    addCount(totals, 'all', all);

    const provider = providerMap.get(link.providerId) ?? {
      providerId: link.providerId,
      name: link.provider.name,
      slug: link.provider.slug,
      links: 0,
      today: 0,
      d7: 0,
      d30: 0,
      all: 0,
      lastClickedAt: null as Date | null,
    };
    provider.links += 1;
    provider.today += today;
    provider.d7 += d7;
    provider.d30 += d30;
    provider.all += all;
    if (
      link.lastClickedAt
      && (!provider.lastClickedAt || link.lastClickedAt > provider.lastClickedAt)
    ) {
      provider.lastClickedAt = link.lastClickedAt;
    }
    providerMap.set(link.providerId, provider);

    linkStats.push({
      id: link.id,
      slug: link.slug,
      providerName: link.provider.name,
      today,
      d7,
      d30,
      all,
      lastClickedAt: link.lastClickedAt,
    });
  }

  const providers = [...providerMap.values()]
    .filter((row) => row.all > 0 || row.d30 > 0 || row.today > 0)
    .sort((a, b) => b.d7 - a.d7 || b.all - a.all || a.name.localeCompare(b.name));

  const topLinks = [...linkStats]
    .filter((row) => row.all > 0 || row.d30 > 0 || row.today > 0)
    .sort((a, b) => b.d7 - a.d7 || b.all - a.all || a.slug.localeCompare(b.slug))
    .slice(0, 40);

  const dailyByKey = new Map(
    dailyRows.map((row) => {
      const day = row.day instanceof Date
        ? row.day.toISOString().slice(0, 10)
        : String(row.day).slice(0, 10);
      return [day, Number(row.clicks)] as const;
    }),
  );

  const daily: DailyClickBucket[] = [];
  for (let offset = 13; offset >= 0; offset -= 1) {
    const dayStart = new Date(todayStart.getTime() - offset * 24 * 60 * 60 * 1000);
    const key = new Intl.DateTimeFormat('en-CA', {
      timeZone: SHANGHAI_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(dayStart);
    daily.push({ day: key, clicks: dailyByKey.get(key) ?? 0 });
  }

  return {
    totals,
    providers,
    topLinks,
    daily,
    recent: recent.map((row) => ({
      id: row.id,
      clickedAt: row.clickedAt,
      slug: row.affiliateLink.slug,
      providerName: row.affiliateLink.provider.name,
      referer: row.referer,
    })),
    linkCount: links.length,
    linksWithTraffic: links.filter((link) => link.clicks > 0).length,
  };
}
