import { prisma } from '@vpsknow/database';
import { NextRequest, NextResponse } from 'next/server';

/**
 * 短链接重定向服务
 *
 * 用户点击: https://stock.vpsknow.com/go/greencloudvps-gc-2017
 *       ↓
 * 302 重定向: https://provider.com/aff.php?aff=YOUR_ID&pid=123
 *       ↓
 * 最终页面: https://provider.com/cart.php?a=confproduct&i=1
 *
 * 特点:
 * - 服务器端重定向,用户看不到中间的 affiliate 链接
 * - 自动记录点击统计
 * - 支持产品级别和 provider 级别链接
 * - Slug 格式校验 + 仅允许 http(s) 目标, 防止路径注入与开放重定向
 */

const CACHE_SECONDS = 3600; // 缓存 1 小时
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;
const MAX_SLUG_LENGTH = 200;

function isSafeRedirectTarget(targetUrl: string): boolean {
  try {
    const url = new URL(targetUrl);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  if (!id || id.length > MAX_SLUG_LENGTH || !SLUG_PATTERN.test(id)) {
    return new NextResponse('Short link not found', { status: 404 });
  }

  try {
    // 查询数据库获取目标链接（targetUrl 由 worker 用正确 aff+pid 写入）
    const link = await prisma.affiliateLink.findUnique({
      where: { slug: id },
      select: {
        targetUrl: true,
      },
    });

    if (!link || !isSafeRedirectTarget(link.targetUrl)) {
      return new NextResponse('Short link not found', { status: 404 });
    }

    // 异步更新点击计数(不阻塞重定向)
    prisma.affiliateLink
      .update({
        where: { slug: id },
        data: { clicks: { increment: 1 } },
      })
      .catch((err) => console.error('Failed to update click count:', err));

    // 302 重定向到目标链接；忽略请求 query，避免用户篡改 aff/pid
    return NextResponse.redirect(link.targetUrl, {
      status: 302,
      headers: {
        'Cache-Control': `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`,
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (error) {
    console.error('Error processing short link:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
