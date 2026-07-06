import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This config ensures the middleware doesn't block background images, APIs, or CSS
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get('host') || '';

  // 1. Route for the Super Admin Panel
  if (hostname === 'saco.myanhub.com') {
    // If they go to the root of the sacrm domain, invisibly serve the admin panel
    if (url.pathname === '/') {
      return NextResponse.rewrite(new URL('/admin-panel', req.url));
    }
  }

  // 2. Route for the Client CRM
  // If they visit co.myanhub.com, they will naturally be served the standard app routes
  return NextResponse.next();
}