import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export default auth((req) => {
  if (!req.auth) {
    return NextResponse.redirect(new URL('/login', req.nextUrl));
  }
});

export const config = {
  // Lindungi semua route kecuali halaman login, endpoint auth, dan aset statis.
  matcher: ['/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)'],
};
