import { NextResponse, type NextRequest } from 'next/server';

const backendBaseUrl = process.env.BACKEND_BASE_URL ?? 'http://127.0.0.1:4000';

async function proxy(request: NextRequest, context: { params: Promise<{ segments: string[] }> }) {
  const { segments } = await context.params;
  const path = segments.map(encodeURIComponent).join('/');
  const target = new URL(`/api/${path}${request.nextUrl.search}`, backendBaseUrl);
  const headers = new Headers();
  for (const name of ['accept', 'content-type', 'cookie', 'authorization']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      ...(request.method === 'GET' || request.method === 'HEAD' ? {} : { body: await request.arrayBuffer() }),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: { message: 'Movie service is unavailable' } }, { status: 502 });
  }
  const responseHeaders = new Headers();
  for (const name of ['content-type', 'cache-control']) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  const cookieHeaders = upstream.headers as Headers & { getSetCookie?: () => string[] };
  const cookies = cookieHeaders.getSetCookie?.() ?? (upstream.headers.get('set-cookie') ? [upstream.headers.get('set-cookie')!] : []);
  for (const cookie of cookies) responseHeaders.append('set-cookie', cookie);
  return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export const GET = proxy;
export const POST = proxy;
