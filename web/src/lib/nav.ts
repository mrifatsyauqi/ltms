import {
  Building2,
  ClipboardList,
  Database,
  FileClock,
  History,
  LayoutDashboard,
  MessageSquareText,
  Settings,
  ShieldCheck,
  Table2,
  Truck,
  Upload,
  UserCog,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { hasFullAccess } from '@/lib/roles';
import type { MenuKey } from '@/lib/data/supabase/permissions';

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  children?: NavItem[];
  /** Menu_key Role & Akses (lib/data/supabase/permissions.ts) yang menentukan
   *  TAMPIL/TIDAKnya item ini utk SEMUA role gated (GATED_ROLES: Admin
   *  Cabang/Manager Kota/Asisten Manager Kota/SPV Drop Point/Admin DP - bukan
   *  cuma 2 role DP spt sebelumnya) - lihat filterNavByAccess. undefined =
   *  SELALU tampil, dipakai utk (a) item yg memang di luar matrix (Profil
   *  Saya) dan (b) item yg menu_key-nya BELUM punya penegakan backend
   *  (requirePermission/gate di page) - SENGAJA: memasang menuKey sebelum
   *  backend-nya menegakkan = menu hilang dari sidebar tapi isinya masih bisa
   *  dibuka lewat URL. Pasang menuKey BARENGAN wiring backend-nya. */
  menuKey?: MenuKey;
};

export type NavGroup = {
  label?: string;
  items: NavItem[];
};

/**
 * Menu per role (Langkah 3 - Perluasan Role):
 * - Full access (Super Admin/Admin Cabang/Manager Kota/Asisten Manager Kota):
 *   menu utama + grup Master Data, Laporan, Pengaturan - SAMA PERSIS, tidak
 *   dibedakan berdasar jabatan (lihat lib/roles.ts).
 * - Admin DP & SPV Drop Point: flat, hanya 4 menu. TIDAK punya akses Master
 *   Data / Import / Laporan Import - SPV Drop Point dapat menu SAMA PERSIS
 *   dgn Admin DP (cakupan >1 DP ditegakkan server-side, bukan lewat menu).
 * "Data Long Tail" & "Feedback Long Tail" memakai halaman yang sama (/feedback)
 * dengan view berbeda lewat query param.
 *
 * "Cabang" vs "Drop Point" (restrukturisasi): BUKAN lagi statis per-role,
 * tapi ikut akses NYATA ke menu_key 'master_cabang' (`canCabang` di bawah -
 * `access === null` [Super Admin, bypass permanen] dihitung SEBAGAI akses
 * penuh, konsisten dgn filterNavByAccess). Praktiknya HANYA Super Admin yang
 * default punya `master_cabang` (Admin Cabang/Manager Kota/Asisten Manager
 * Kota default false sejak revisi kebijakan - lihat
 * master_cabang_drop_point_default_false_migration.sql), TAPI logic ini
 * murni ikut nilai akses aktual, BUKAN hardcode nama role - kalau Super
 * Admin suatu saat menyalakan master_cabang utk 1 akun spesifik lewat "Per
 * Akun", akun itu otomatis dapat struktur "Cabang" (+ Drop Point nested)
 * yang sama persis, tanpa perlu ubah kode ini lagi:
 * - `canCabang` true (Super Admin, atau akun manapun yg diberi akses
 *   master_cabang): SATU item "Cabang", "Drop Point" NESTED sbg children-nya
 *   (struktur organisasi Kota -> Drop Point) - lihat rendering submenu
 *   expand/collapse di Sidebar.
 * - `canCabang` false (praktiknya: Admin Cabang/Manager Kota/Asisten
 *   Manager Kota): TIDAK ADA item "Cabang" sama sekali (mereka memang tak
 *   punya menu itu) - "Drop Point" jadi item LEVEL ATAS tersendiri, sejajar
 *   dgn Master Feedback/User Management, TETAP mengarah ke halaman & data
 *   PERSIS SAMA (`/master/drop-point`, tabel `master_drop_point`) - tak ada
 *   duplikasi data, otomatis sinkron krn satu sumber. Kedua bentuk sama-sama
 *   pakai `menuKey: 'master_drop_point'` - filterNavByAccess yang lalu
 *   memutuskan tampil/tidaknya berdasar akses aktual ke key itu, terlepas
 *   dari bentuk (nested/top-level).
 */
export function navForRole(role: string | undefined, access: Record<MenuKey, boolean> | null): NavGroup[] {
  if (hasFullAccess(role)) {
    // menuKey di cabang ini dipasang BARENGAN gate page + requirePermission()
    // endpoint-nya (dashboard, feedback_longtail_view, riwayat_feedback,
    // monitoring_delivery_cabang, role_akses, data_longtail, import_longtail,
    // riwayat_import - CHECKPOINT 3; master_cabang, master_drop_point,
    // master_feedback, user_management - CHECKPOINT 4; pengaturan -
    // CHECKPOINT 5). SEMUA 15 menu_key SEKARANG punya menuKey - tak ada lagi
    // yang "sengaja belum digating" (rollout 9 menu_key yang dimulai dari
    // audit PRD v2.0 selesai).
    const canCabang = access === null || access.master_cabang === true;
    const dropPointItem: NavItem = { label: 'Drop Point', href: '/master/drop-point', icon: Database, menuKey: 'master_drop_point' };
    const masterDataItems: NavItem[] = canCabang
      ? [{ label: 'Cabang', href: '/master/cabang', icon: Building2, menuKey: 'master_cabang', children: [dropPointItem] }]
      : [dropPointItem];

    return [
      {
        items: [
          { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, menuKey: 'dashboard' },
          { label: 'Feedback Long Tail', href: '/feedback', icon: MessageSquareText, menuKey: 'feedback_longtail_view' },
          { label: 'Data Long Tail', href: '/feedback?view=data', icon: Table2, menuKey: 'data_longtail' },
          { label: 'Import Long Tail', href: '/import', icon: Upload, menuKey: 'import_longtail' },
          { label: 'Monitoring Delivery', href: '/monitoring-delivery', icon: Truck, menuKey: 'monitoring_delivery_cabang' },
        ],
      },
      {
        label: 'Master Data',
        items: [
          ...masterDataItems,
          { label: 'Master Feedback', href: '/master/feedback', icon: ClipboardList, menuKey: 'master_feedback' },
          { label: 'User Management', href: '/master/users', icon: UserCog, menuKey: 'user_management' },
          { label: 'Role & Akses', href: '/master/role-akses', icon: ShieldCheck, menuKey: 'role_akses' },
        ],
      },
      {
        label: 'Laporan',
        items: [
          { label: 'Riwayat Import', href: '/riwayat-import', icon: FileClock, menuKey: 'riwayat_import' },
          { label: 'Riwayat Feedback', href: '/riwayat-feedback', icon: History, menuKey: 'riwayat_feedback' },
        ],
      },
      {
        label: 'Pengaturan',
        items: [
          { label: 'Pengaturan', href: '/pengaturan', icon: Settings, menuKey: 'pengaturan' },
          { label: 'Profile', href: '/profil', icon: UserRound },
        ],
      },
    ];
  }

  // Admin DP & SPV Drop Point - menuKey diisi utk 4 item yang diatur lewat
  // Role & Akses (Profil Saya SENGAJA tanpa menuKey -> selalu tampil, lihat
  // filterNavByAccess). Monitoring Delivery = mode per-Sprinter
  // ('monitoring_delivery_dp') - dipakai KEDUA role ini (lihat
  // app/(app)/monitoring-delivery/page.tsx: isCabang cuma true utk full
  // access, SPV Drop Point TIDAK LAGI dapat mode Refine Total cabang -
  // sebelumnya salah, ikut memicu FORBIDDEN krn mode itu fetch
  // /api/drop-points yg cuma boleh full access).
  return [
    {
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, menuKey: 'dashboard' },
        { label: 'Monitoring Delivery', href: '/monitoring-delivery', icon: Truck, menuKey: 'monitoring_delivery_dp' },
        { label: 'Feedback Long Tail', href: '/feedback', icon: MessageSquareText, menuKey: 'feedback_longtail_view' },
        { label: 'Riwayat Feedback', href: '/riwayat-feedback', icon: History, menuKey: 'riwayat_feedback' },
        { label: 'Profil Saya', href: '/profil', icon: UserRound },
      ],
    },
  ];
}

/** Filter satu level item + REKURSIF ke `children` (submenu, mis. "Drop
 *  Point" di bawah "Cabang"). Parent yang KEHABISAN seluruh children-nya
 *  tapi lolos menuKey-nya sendiri TETAP tampil, hanya properti `children`-nya
 *  DIHAPUS (bukan disisakan array kosong) - Sidebar merender tombol chevron
 *  submenu berdasar `item.children` truthy, jadi array kosong akan bikin
 *  chevron yang membuka submenu kosong. */
function filterItems(items: NavItem[], access: Record<MenuKey, boolean>): NavItem[] {
  return items.flatMap((item) => {
    if (item.menuKey && !access[item.menuKey]) return [];
    if (!item.children) return [item];
    const children = filterItems(item.children, access);
    if (children.length > 0) return [{ ...item, children }];
    const parentOnly: NavItem = { ...item };
    delete parentOnly.children;
    return [parentOnly];
  });
}

/**
 * Sembunyikan TOTAL item nav yang menu_key-nya enabled=false utk actor ini -
 * bukan cuma memblokir isinya setelah diklik (lihat lib/data/supabase/
 * permissions.ts, requirePermission() di endpoint). Berlaku utk SEMUA role
 * gated (GATED_ROLES = 5 role, termasuk Admin Cabang/Manager Kota/Asisten
 * Manager Kota sejak bypass hasPermission() dihapus) - BUKAN cuma SPV Drop
 * Point/Admin DP.
 *
 * `access` null = JANGAN filter, kembalikan `groups` apa adanya. Sekarang itu
 * cuma dipakai utk Super Admin (bypass permanen, akses efektifnya toh
 * all-true) dan role tak dikenal (legacy 'Admin Pusat') - lihat app/(app)/
 * layout.tsx yang menentukan null vs terhitung lewat isGatedRole().
 *
 * Item tanpa `menuKey` (Profil Saya, plus item yang backend-nya belum
 * digating) selalu tampil apa pun isi `access`. Children ikut difilter per
 * menu_key-nya sendiri (lihat filterItems). Grup yang kehabisan seluruh
 * item-nya ikut dibuang.
 */
export function filterNavByAccess(groups: NavGroup[], access: Record<MenuKey, boolean> | null): NavGroup[] {
  if (!access) return groups;
  return groups
    .map((group) => ({ ...group, items: filterItems(group.items, access) }))
    .filter((group) => group.items.length > 0);
}
