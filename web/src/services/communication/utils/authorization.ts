import { db } from '@/lib/data/supabase/client';
import { requireActor, getSupervisedDPs } from '@/lib/data/supabase/helpers';
import { hasFullAccess } from '@/lib/roles';
import { ApiError } from '@/lib/errors';
import type { Actor } from '@/lib/data/supabase/helpers';
import type { SendMessagePayload } from '../communication.types';

export interface UserCommunicationScope {
  actorId: string;
  email: string;
  namaTampilan: string;
  role: string;
  dropPoint: string;
  isSuperAdmin: boolean;
  isCabangLevel: boolean;
  isKotaLevel: boolean;
  isSpvLevel: boolean;
  isDpLevel: boolean;
  /** Null = Tidak dibatasi / seluruh kota di cabang */
  allowedKota: string[] | null;
  /** Null = Tidak dibatasi / seluruh Drop Point di cabang */
  allowedDropPoints: string[] | null;
}

export class CommunicationAuthorizationService {
  /**
   * Mengambil dan memetakan Data Scope lengkap dari user yang sedang login.
   */
  public async resolveUserScope(actorEmail: string): Promise<UserCommunicationScope> {
    const actor = await requireActor(actorEmail);
    const role = actor.role;

    const isSuperAdmin = role === 'Super Admin';
    const isCabangLevel = hasFullAccess(role);
    const isKotaLevel = role === 'Manager Kota' || role === 'Asisten Manager Kota';
    const isSpvLevel = role === 'SPV Drop Point';
    const isDpLevel = role === 'Admin DP' || role === 'Admin Drop Point';

    let allowedKota: string[] | null = null;
    let allowedDropPoints: string[] | null = null;

    if (isSuperAdmin || (isCabangLevel && !isKotaLevel)) {
      // Super Admin & Admin Cabang memiliki akses seluruh cakupan
      allowedKota = null;
      allowedDropPoints = null;
    } else if (isKotaLevel) {
      // Manager Kota & Asisten Manager Kota: Resolusi kota dari tabel cabang
      try {
        const { data: cabangRows } = await db()
          .from('cabang')
          .select('kode_kota, nama_kota')
          .or(`manager_kota_user_id.eq.${actor.id},asisten_manager_user_id.eq.${actor.id}`);

        if (cabangRows && cabangRows.length > 0) {
          const kotaList: string[] = [];
          cabangRows.forEach((c: { kode_kota?: string; nama_kota?: string }) => {
            if (c.kode_kota) kotaList.push(c.kode_kota.toUpperCase());
            if (c.nama_kota) kotaList.push(c.nama_kota.toUpperCase());
          });
          allowedKota = [...new Set(kotaList)];

          // Ambil DP yang berada di bawah kota-kota tersebut
          const { data: dpRows } = await db()
            .from('master_drop_point')
            .select('kode_dp')
            .in('kode_kota', cabangRows.map((c) => c.kode_kota).filter(Boolean));

          if (dpRows && dpRows.length > 0) {
            allowedDropPoints = dpRows.map((d: { kode_dp: string }) => d.kode_dp.toUpperCase());
          }
        }
      } catch (err) {
        console.warn('Gagal memuat mapping kota untuk Manager Kota:', err);
      }
    } else if (isSpvLevel) {
      // SPV Drop Point: Resolusi DP yang disupervisi
      const supervised = await getSupervisedDPs(actor.id);
      allowedDropPoints = supervised.map((d) => d.toUpperCase());

      // Resolusi kota induk dari DP yang disupervisi
      if (allowedDropPoints.length > 0) {
        try {
          const { data: dpRows } = await db()
            .from('master_drop_point')
            .select('kode_kota')
            .in('kode_dp', supervised);

          if (dpRows && dpRows.length > 0) {
            const kotaCodes = [...new Set(dpRows.map((r: { kode_kota?: string }) => r.kode_kota).filter(Boolean))] as string[];
            if (kotaCodes.length > 0) {
              const { data: cabangRows } = await db()
                .from('cabang')
                .select('kode_kota, nama_kota')
                .in('kode_kota', kotaCodes);

              const kotaList: string[] = [];
              cabangRows?.forEach((c: { kode_kota?: string; nama_kota?: string }) => {
                if (c.kode_kota) kotaList.push(c.kode_kota.toUpperCase());
                if (c.nama_kota) kotaList.push(c.nama_kota.toUpperCase());
              });
              allowedKota = kotaList.length > 0 ? [...new Set(kotaList)] : null;
            }
          }
        } catch (err) {
          console.warn('Gagal memuat kota untuk SPV Drop Point:', err);
        }
      } else {
        allowedKota = [];
      }
    } else if (isDpLevel) {
      // Admin Drop Point: Terbatas khusus pada DP miliknya
      const userDp = actor.dropPoint?.trim().toUpperCase() || '';
      allowedDropPoints = userDp ? [userDp] : [];

      if (userDp) {
        try {
          const { data: dpRow } = await db()
            .from('master_drop_point')
            .select('kode_kota')
            .eq('kode_dp', userDp)
            .maybeSingle();

          if (dpRow?.kode_kota) {
            const { data: cabangRow } = await db()
              .from('cabang')
              .select('kode_kota, nama_kota')
              .eq('kode_kota', dpRow.kode_kota)
              .maybeSingle();

            if (cabangRow) {
              allowedKota = [cabangRow.kode_kota.toUpperCase(), cabangRow.nama_kota.toUpperCase()];
            }
          }
        } catch (err) {
          console.warn('Gagal memuat kota untuk Admin DP:', err);
        }
      }
    }

    return {
      actorId: actor.id,
      email: actor.email,
      namaTampilan: actor.namaTampilan,
      role,
      dropPoint: actor.dropPoint,
      isSuperAdmin,
      isCabangLevel,
      isKotaLevel,
      isSpvLevel,
      isDpLevel,
      allowedKota,
      allowedDropPoints,
    };
  }

  /**
   * Memvalidasi apakah payload pengiriman pesan sesuai dengan Data Scope user.
   */
  public validateDataScope(
    scope: UserCommunicationScope,
    payload: SendMessagePayload
  ): { allowed: boolean; reason?: string } {
    // 1. Super Admin & Admin Cabang memiliki akses bebas ke seluruh data cabang
    if (scope.isSuperAdmin || (scope.isCabangLevel && !scope.isKotaLevel)) {
      return { allowed: true };
    }

    const targetScope = payload.data?.targetScope;
    const targetKota = (payload.data?.targetKota || targetScope?.name || '').trim().toUpperCase();
    const targetDp = (payload.data?.targetDp || '').trim().toUpperCase();

    // 2. Jika tipe cakupan adalah 'all' atau 'cabang', tolak role di bawah Admin Cabang
    if (targetScope?.type === 'all' || targetScope?.type === 'cabang') {
      return {
        allowed: false,
        reason: `Akses ditolak: Role "${scope.role}" tidak memiliki wewenang untuk membagikan laporan berskala seluruh Cabang.`,
      };
    }

    // 3. Validasi Lingkup Drop Point
    if (targetDp) {
      if (scope.allowedDropPoints !== null && !scope.allowedDropPoints.includes(targetDp)) {
        if (scope.isDpLevel) {
          const myDp = scope.allowedDropPoints[0] || scope.dropPoint || '';
          return {
            allowed: false,
            reason: `Akses ditolak: Admin DP hanya dapat membagikan data milik Drop Point sendiri (${myDp}).`,
          };
        }
        if (scope.isSpvLevel) {
          return {
            allowed: false,
            reason: `Akses ditolak: Drop Point "${targetDp}" tidak berada di bawah supervisi Anda.`,
          };
        }
        return {
          allowed: false,
          reason: `Akses ditolak: Anda tidak memiliki wewenang untuk membagikan data Drop Point "${targetDp}".`,
        };
      }
    }

    // 4. Validasi Lingkup Kota
    if (targetKota && scope.allowedKota !== null) {
      const isKotaAllowed = scope.allowedKota.some(
        (k) => k === targetKota || targetKota.includes(k) || k.includes(targetKota)
      );

      if (!isKotaAllowed) {
        return {
          allowed: false,
          reason: `Akses ditolak: Anda tidak memiliki wewenang untuk membagikan data Kota "${targetKota}".`,
        };
      }
    }

    // 5. Validasi khusus Admin DP (Jika mengirim data yang berisi target DP berbeda)
    if (scope.isDpLevel && scope.allowedDropPoints && scope.allowedDropPoints.length > 0) {
      const myDp = scope.allowedDropPoints[0];
      if (targetDp && targetDp !== myDp) {
        return {
          allowed: false,
          reason: `Akses ditolak: Admin DP hanya dapat membagikan data milik Drop Point sendiri (${myDp}).`,
        };
      }
    }

    // 6. Validasi khusus SPV Drop Point
    if (scope.isSpvLevel && scope.allowedDropPoints) {
      if (targetDp && !scope.allowedDropPoints.includes(targetDp)) {
        return {
          allowed: false,
          reason: `Akses ditolak: Drop Point "${targetDp}" tidak berada di bawah supervisi Anda.`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Mengotorisasi dan memvalidasi permintaan pengiriman pesan dari endpoint API.
   */
  public async authorizeSend(
    actorEmail: string,
    payload: SendMessagePayload
  ): Promise<{ actorEmail: string; scope: UserCommunicationScope }> {
    const scope = await this.resolveUserScope(actorEmail);
    const validation = this.validateDataScope(scope, payload);

    if (!validation.allowed) {
      throw new ApiError('FORBIDDEN', validation.reason || 'Akses ditolak ke data scope ini.');
    }

    return { actorEmail, scope };
  }
}

export const communicationAuthService = new CommunicationAuthorizationService();
