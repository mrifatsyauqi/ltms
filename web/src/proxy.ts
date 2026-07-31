import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export default auth((req) => {
  if (!req.auth) {
    return NextResponse.redirect(new URL('/login', req.nextUrl));
  }
});

export const config = {
  // Lindungi semua route kecuali halaman login, endpoint auth, aset statis,
  // dan Link Berbagi Laporan (/public/[token]/*, /api/public/[token]/*) -
  // route publik itu SENGAJA tanpa session sama sekali, keamanannya
  // ditegakkan sendiri lewat validasi token (lihat public-share.ts), bukan
  // NextAuth.
  matcher: ['/((?!login|api/auth|_next/static|_next/image|favicon.ico|public|api/public).*)'],
};
