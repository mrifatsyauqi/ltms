export type AppsScriptUser = {
  nama: string;
  email: string;
  role: string;
  dropPoint: string;
  statusAktif: boolean;
};

type GetUserByEmailResponse =
  | { ok: true; found: true; user: AppsScriptUser }
  | { ok: true; found: false; user: null }
  | { ok: false; error: string };

/**
 * Looks up a user's LTMS role + Drop Point from the `Users` sheet via the
 * Apps Script Web App (PRD Bagian 4: role ditentukan dari sheet Users, bukan
 * klaim client). Returns null if the user isn't found, isn't active, or the
 * backend isn't reachable — callers must treat null as "deny sign-in".
 */
export async function getUserByEmail(email: string): Promise<AppsScriptUser | null> {
  const baseUrl = process.env.APPS_SCRIPT_URL;
  const secret = process.env.APPS_SCRIPT_SHARED_SECRET;

  if (!baseUrl || !secret) {
    throw new Error('APPS_SCRIPT_URL / APPS_SCRIPT_SHARED_SECRET belum diset di environment');
  }

  const url = new URL(baseUrl);
  url.searchParams.set('action', 'getUserByEmail');
  url.searchParams.set('email', email);
  url.searchParams.set('secret', secret);

  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) {
    return null;
  }

  const data = (await res.json()) as GetUserByEmailResponse;
  if (!data.ok || !data.found || !data.user.statusAktif) {
    return null;
  }

  return data.user;
}
