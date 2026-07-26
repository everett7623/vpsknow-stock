import { NextResponse, type NextRequest } from 'next/server';
import { hasValidAdminAuthorization } from '@/lib/admin-auth';

export function middleware(request: NextRequest): NextResponse {
  if (!process.env.ADMIN_DASHBOARD_TOKEN) {
    return new NextResponse('Admin dashboard is not configured.', { status: 503 });
  }
  if (!hasValidAdminAuthorization(request.headers.get('authorization'))) {
    return new NextResponse('Authentication required.', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="VPSKnow Admin", charset="UTF-8"' },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
