import { prisma } from '@vpsknow/database';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json(
      { status: 'healthy', database: 'healthy' },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch {
    return Response.json(
      { status: 'unhealthy', database: 'unhealthy' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }
}
