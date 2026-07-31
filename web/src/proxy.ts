import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export default auth((req) => {
  if (!req.auth) {
    return NextResponse.redirect(new URL('/login', req.nextUrl));
  }
});

export const config = {
  // Lindungi semua route kecuali halaman login, endpoint auth, aset statis,
  // ikon file-convention Next.js (icon.png/apple-icon.png - browser minta ini
  // di SETIAP halaman termasuk /login, sebelum ada sesi sama sekali; tanpa
  // pengecualian ini browser diarahkan ke /login saat minta favicon, bukan
  // gambarnya), aset branding (public/branding/* DISAJIKAN di URL /branding/*
  // - BUKAN /public/branding/* - folder "public" Next.js bukan bagian dari
  // URL, jadi butuh pengecualian sendiri; tanpa ini logo di halaman Login
  // sendiri ikut diblokir krn belum ada sesi), dan Link Berbagi Laporan
  // (/public/[token]/*, /api/public/[token]/*) - route publik itu SENGAJA
  // tanpa session sama sekali, keamanannya ditegakkan sendiri lewat validasi
  // token (lihat public-share.ts), bukan NextAuth.
  matcher: ['/((?!login|api/auth|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|branding|public|api/public).*)'],
};
