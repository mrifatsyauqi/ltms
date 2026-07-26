import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { getUserByEmail, verifyCredentials } from '@/lib/data/auth';

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

        // Bawa role/dropPoint dari sini supaya jwt callback tak perlu query lagi.
        return { id: user.email, email: user.email, name: user.nama, role: user.role, dropPoint: user.dropPoint };
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
    async signIn({ user, account, profile }) {
      // Login Credentials SUDAH divalidasi penuh di authorize() (email+password+
      // status aktif). Jangan query ulang di sini — panggilan DB berlebih yang
      // bisa gagal setelah cookie sempat terbentuk = sumber bug "error tapi masuk".
      if (account?.provider === 'credentials') return true;

      // Login Google: email HARUS terdaftar & aktif di tabel users.
      const email = user?.email ?? profile?.email;
      if (!email) return false;
      if (ALLOWED_DOMAIN && profile && profile.hd !== ALLOWED_DOMAIN) {
        return false;
      }
      try {
        const found = await getUserByEmail(email);
        return found !== null;
      } catch {
        // Error DB saat validasi -> tolak (jangan loloskan sesi setengah jadi).
        return false;
      }
    },
    async jwt({ token, user, account, trigger }) {
      if (trigger === 'signIn' && user?.email) {
        if (account?.provider === 'credentials') {
          // role/dropPoint sudah dibawa dari authorize() — tanpa query lagi.
          const u = user as { role?: string; dropPoint?: string; name?: string | null };
          token.role = u.role;
          token.dropPoint = u.dropPoint;
          token.nama = u.name ?? undefined;
        } else {
          try {
            const found = await getUserByEmail(user.email);
            if (found) {
              token.role = found.role;
              token.dropPoint = found.dropPoint;
              token.nama = found.nama;
            }
          } catch {
            /* biarkan token tanpa role -> di-gate di layout/login */
          }
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
