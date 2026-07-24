import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { getUserByEmail } from '@/lib/apps-script';

const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // 8 jam idle (PRD Bagian 4)
const ALLOWED_DOMAIN = process.env.ALLOWED_GOOGLE_DOMAIN;

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: ALLOWED_DOMAIN ? { hd: ALLOWED_DOMAIN } : {},
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
    async signIn({ profile }) {
      const email = profile?.email;
      if (!email) return false;

      // Proyek ini sengaja tidak memakai domain Google Workspace (menggantikan
      // PRD Bagian 4/5) — ALLOWED_GOOGLE_DOMAIN dibiarkan kosong secara permanen,
      // jadi blok ini tidak aktif. Kontrol akses satu-satunya adalah whitelist
      // email di sheet Users di bawah.
      if (ALLOWED_DOMAIN && profile.hd !== ALLOWED_DOMAIN) {
        return false;
      }

      const user = await getUserByEmail(email);
      // Tidak ditemukan di sheet Users / status nonaktif → tolak login,
      // meski autentikasi Google-nya sendiri berhasil. Ini yang menggantikan
      // domain restriction sebagai kontrol akses utama.
      return user !== null;
    },
    async jwt({ token, profile, trigger }) {
      if (trigger === 'signIn' && profile?.email) {
        const user = await getUserByEmail(profile.email);
        if (user) {
          token.role = user.role;
          token.dropPoint = user.dropPoint;
          token.nama = user.nama;
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
