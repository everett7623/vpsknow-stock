import { prisma } from '@vpsknow/database';
import { NextRequest, NextResponse } from 'next/server';

/**
 * 短链接重定向服务
 *
 * 用户点击: https://stock.vpsknow.com/go/greencloudvps-gc-2017
 *       ↓
 * 302 重定向: https://provider.com/aff.php?aff=YOUR_ID&pid=123
 *
 * - 服务器端重定向，用户看不到中间的 affiliate 链接
 * - 记录累计 clicks + 单次 AffiliateClick 事件（供 admin 分时段统计）
 * - Slug 格式校验 + 仅允许 http(s) 目标，防止路径注入与开放重定向
 */

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;
const MAX_SLUG_LENGTH = 200;
const MAX_META_LENGTH = 300;

function isSafeRedirectTarget(targetUrl: string): boolean {
  try {
    const url = new URL(targetUrl);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function truncateMeta(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > MAX_META_LENGTH ? `${trimmed.slice(0, MAX_META_LENGTH)}…` : trimmed;
}

async function recordClick(input: {
  linkId: string;
  slug: string;
  referer: string | null;
  userAgent: string | null;
}): Promise<void> {
  const clickedAt = new Date();
  await prisma.$transaction([
    prisma.affiliateClick.create({
      data: {
        affiliateLinkId: input.linkId,
        clickedAt,
        referer: input.referer,
        userAgent: input.userAgent,
      },
    }),
    prisma.affiliateLink.update({
      where: { slug: input.slug },
      data: {
        clicks: { increment: 1 },
        lastClickedAt: clickedAt,
      },
    }),
  ]);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  if (!id || id.length > MAX_SLUG_LENGTH || !SLUG_PATTERN.test(id)) {
    return new NextResponse('Short link not found', { status: 404 });
  }

  try {
    const link = await prisma.affiliateLink.findUnique({
      where: { slug: id },
      select: {
        id: true,
        targetUrl: true,
      },
    });

    if (!link || !isSafeRedirectTarget(link.targetUrl)) {
      return new NextResponse('Short link not found', { status: 404 });
    }

    const referer = truncateMeta(request.headers.get('referer'));
    const userAgent = truncateMeta(request.headers.get('user-agent'));

    // Fire-and-forget so redirect latency stays low; failures are logged only.
    void recordClick({
      linkId: link.id,
      slug: id,
      referer,
      userAgent,
    }).catch((err) => console.error('Failed to record short-link click:', err));

    // Do not cache redirects — cached 302s would under-count clicks.
    return NextResponse.redirect(link.targetUrl, {
      status: 302,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (error) {
    console.error('Error processing short link:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
