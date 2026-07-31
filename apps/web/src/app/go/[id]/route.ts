import { prisma } from '@vpsknow/database';
import { NextRequest, NextResponse } from 'next/server';

/**
 * 短链接重定向服务
 *
 * 用户点击: https://stock.vpsknow.com/go/abc123
 *       ↓
 * 302 重定向: https://provider.com/aff.php?aff=YOUR_ID&pid=123
 *       ↓
 * 最终页面: https://provider.com/cart.php?a=confproduct&i=1
 *
 * 特点:
 * - 服务器端重定向,用户看不到中间的 affiliate 链接
 * - 自动记录点击统计
 * - 支持产品级别和 provider 级别链接
 */

const CACHE_SECONDS = 3600; // 缓存 1 小时

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    // 查询数据库获取目标链接
    const link = await prisma.affiliateLink.findUnique({
      where: { slug: id },
      select: {
        targetUrl: true,
        clicks: true,
      },
    });

    if (!link) {
      // 短链接不存在,返回 404
      return new NextResponse('Short link not found', { status: 404 });
    }

    // 异步更新点击计数(不阻塞重定向)
    prisma.affiliateLink
      .update({
        where: { slug: id },
        data: { clicks: { increment: 1 } },
      })
      .catch((err) => console.error('Failed to update click count:', err));

    // 302 重定向到目标链接
    return NextResponse.redirect(link.targetUrl, {
      status: 302,
      headers: {
        'Cache-Control': `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`,
      },
    });
  } catch (error) {
    console.error('Error processing short link:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
