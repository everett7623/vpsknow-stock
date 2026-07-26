import { headers } from 'next/headers';

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export function hasValidAdminAuthorization(
  authorization: string | null,
  expectedToken = process.env.ADMIN_DASHBOARD_TOKEN,
): boolean {
  if (!authorization?.startsWith('Basic ') || !expectedToken) return false;
  try {
    const credentials = atob(authorization.slice(6));
    const separator = credentials.indexOf(':');
    if (separator < 0) return false;
    return safeEqual(credentials.slice(separator + 1), expectedToken);
  } catch {
    return false;
  }
}

export async function assertAdmin(): Promise<void> {
  const requestHeaders = await headers();
  if (!hasValidAdminAuthorization(requestHeaders.get('authorization'))) {
    throw new Error('Unauthorized admin action');
  }
}
