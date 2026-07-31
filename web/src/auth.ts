import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { verifyCredentials } from '@/lib/data/auth';

const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // 8 jam idle (PRD Bagian 4)

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    // Login manual - satu-satunya provider sejak migrasi Google->NIK selesai
    // (semua user existing terkonfirmasi punya NIK+password, lihat rencana
    // rollout). Dikelola Admin Cabang lewat User Management. Password
    // di-hash (scrypt) di sisi Next.js, tabel users cuma menyimpan hash-nya
    // (lihat lib/password.ts).
    //
    // SATU field "identifier" menerima NIK (user baru) ATAU email (user
    // lama peninggalan era Google, belum diisi NIK) — verifyCredentials()
    // coba NIK dulu, fallback email. type:'text' (BUKAN 'email') supaya NIK
    // yang bukan format email tidak diblokir validasi HTML5 bawaan browser.
    Credentials({
      credentials: {
        identifier: { label: 'NIK / Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const identifier = typeof credentials?.identifier === 'string' ? credentials.identifier.trim() : '';
        const password = typeof credentials?.password === 'string' ? credentials.password : '';
        if (!identifier || !password) return null;

        const user = await verifyCredentials(identifier, password);
        if (!user) return null;

        // Bawa role/dropPoint dari sini supaya jwt callback tak perlu query lagi.
        // name = namaTampilan: utk akun General ini "DP <KODE_DP>" (tak ada
        // nama personal) — sudah benar dipakai apa adanya di sidebar/session.
        return { id: user.email, email: user.email, name: user.namaTampilan, role: user.role, dropPoint: user.dropPoint };
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
    async signIn() {
      // Login SUDAH divalidasi penuh di authorize() (identifier+password+
      // status aktif). Jangan query ulang di sini — panggilan DB berlebih yang
      // bisa gagal setelah cookie sempat terbentuk = sumber bug "error tapi masuk".
      return true;
    },
    async jwt({ token, user, trigger }) {
      if (trigger === 'signIn' && user?.email) {
        // role/dropPoint sudah dibawa dari authorize() — tanpa query lagi.
        const u = user as { role?: string; dropPoint?: string; name?: string | null };
        token.role = u.role;
        token.dropPoint = u.dropPoint;
        token.nama = u.name ?? undefined;
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
