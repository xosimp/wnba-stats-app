import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  // Skip middleware for static files and API routes (except auth routes)
  if (
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/api/auth/heartbeat') ||
    request.nextUrl.pathname.startsWith('/api/auth/signin') ||
    request.nextUrl.pathname.startsWith('/api/auth/signout') ||
    request.nextUrl.pathname.startsWith('/api/auth/callback')
  ) {
    return NextResponse.next();
  }

  // Check for session token in cookies
  const token = await getToken({ 
    req: request,
    secret: process.env.NEXTAUTH_SECRET 
  });

  // If no token or token is expired, redirect to signin
  if (!token) {
    // Only redirect if trying to access protected routes
    if (
      request.nextUrl.pathname.startsWith('/account') ||
      request.nextUrl.pathname.startsWith('/api/account') ||
      request.nextUrl.pathname.startsWith('/api/admin')
    ) {
      return NextResponse.redirect(new URL('/auth/signin', request.url));
    }
  }

  // Add session validation headers
  const response = NextResponse.next();
  response.headers.set('X-Session-Valid', token ? 'true' : 'false');
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
} 