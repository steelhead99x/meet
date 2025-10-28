import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return NextResponse.json({
    message: 'Next.js Diagnostic Info',
    timestamp: new Date().toISOString(),
    request: {
      url: request.url,
      pathname: request.nextUrl.pathname,
      search: request.nextUrl.search,
      origin: request.nextUrl.origin,
      host: request.nextUrl.host,
    },
    headers: headers,
    env: {
      NODE_ENV: process.env.NODE_ENV,
      hasLivekitUrl: !!process.env.LIVEKIT_URL,
      hasApiKey: !!process.env.LIVEKIT_API_KEY,
    },
    config: {
      basePath: '/',
      assetPrefix: '/',
    },
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}


