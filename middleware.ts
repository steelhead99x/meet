import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const pathname = request.nextUrl.pathname;
  
  // Quiet missing CSS source map requests (Next may reference them in dev)
  if (pathname.startsWith('/_next/static/css/') && pathname.endsWith('.map')) {
    return new NextResponse(null, { status: 204 });
  }
  
  // Skip API routes and Next.js internals
  if (pathname.startsWith('/_next/') || pathname.startsWith('/api/')) {
    return response;
  }

  // Apply COOP/COEP headers to worker files (needed for E2EE)
  if (pathname.endsWith('.mjs') && pathname.includes('worker')) {
    response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    response.headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
    return response;
  }

  // Skip other static files
  if (pathname.includes('.')) {
    return response;
  }

  // Apply security headers for HTML pages (enables SharedArrayBuffer for E2EE)
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Embedder-Policy', 'credentialless');

  return response;
}

export const config = {
  matcher: [
    // Intercept CSS sourcemap requests to avoid noisy 404s
    '/_next/static/css/:path*.map',
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Note: No basePath used - reverse proxy handles /meet routing
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

