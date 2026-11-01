import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  if (!request.cookies.has('cinemate_token')) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/bookings/:path*', '/assistant/:path*'] };
