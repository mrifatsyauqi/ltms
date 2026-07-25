import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { getUserByEmail } from '@/lib/apps-script';
import { verifyCredentials } from '@/lib/apps-script/users';

const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // 8 jam idle (PRD Bagian 4)
const ALLOWED_DOMAIN = process.env.ALLOWED_GOOGLE_DOMAIN;

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: ALLOWED_DOMAIN ? { hd: ALLOWED_DOMAIN } : {},
      },
    }),
    // Login manual (username/password) - alternatif selain Google, dikelola
    // Admin Cabang lewat User Management. Password di-hash (scrypt) di sisi
    // Next.js, sheet Users cuma menyimpan hash-nya (lihat lib/password.ts).
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === 'string' ? credentials.email.trim() : '';
        const password = typeof credentials?.password === 'string' ? credentials.password : '';
        if (!email || !password) return null;

        const user = await verifyCredentials(email, password);
        if (!user) return null;

        return { id: user.email, email: user.email, name: user.nama };
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: 60 * 60, // refresh sliding expiry setiap request lewat 1 jam sejak update terakhir
  },
  callbacks: {
    async signIn({ user, profile }) {
      // `profile` cuma ada untuk login Google; login Credentials pakai `user`
      // (hasil authorize() di atas) - keduanya sama-sama punya `email`.
      const email = user?.email ?? profile?.email;
      if (!email) return false;

      // Proyek ini sengaja tidak memakai domain Google Workspace (menggantikan
      // PRD Bagian 4/5) — ALLOWED_GOOGLE_DOMAIN dibiarkan kosong secara permanen,
      // jadi blok ini tidak aktif. Kontrol akses satu-satunya adalah whitelist
      // email di sheet Users di bawah. (Cek hd hanya berlaku utk login Google.)
      if (ALLOWED_DOMAIN && profile && profile.hd !== ALLOWED_DOMAIN) {
        return false;
      }

      const found = await getUserByEmail(email);
      // Tidak ditemukan di sheet Users / status nonaktif → tolak login,
      // meski autentikasi Google-nya sendiri berhasil. Ini yang menggantikan
      // domain restriction sebagai kontrol akses utama. (Login Credentials
      // sudah divalidasi status aktif di authorize() di atas juga.)
      return found !== null;
    },
    async jwt({ token, user, trigger }) {
      if (trigger === 'signIn' && user?.email) {
        const found = await getUserByEmail(user.email);
        if (found) {
          token.role = found.role;
          token.dropPoint = found.dropPoint;
          token.nama = found.nama;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role;
        session.user.dropPoint = token.dropPoint;
        session.user.nama = token.nama;
      }
      return session;
    },
  },
});
