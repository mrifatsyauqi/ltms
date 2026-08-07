-- ============================================================================
-- PRODUCTION SYNC — Menyamakan skema Supabase Production ("ltms") dengan
-- Dev/MVP ("ltms-mvp"), disusun dari hasil audit Bagian A + verifikasi live
-- Bagian B (bandingkan information_schema kedua project).
--
-- STATUS TERKONFIRMASI SUDAH ADA DI PRODUCTION (TIDAK ada di file ini,
-- JANGAN dijalankan ulang):
--   - public_share_links.sql, auth_nik_migration.sql, cabang_migration.sql,
--     jabatan_migration.sql + jabatan_backfill.sql + jabatan_not_null.sql,
--     role_expansion_migration.sql, role_permissions_migration.sql,
--     role_akses_hierarchy_migration.sql, super_admin_account.sql
--     (m.rifatsyauqii@gmail.com sudah role='Super Admin').
--
-- CARA PAKAI (WAJIB, sesuai Bagian E — SATU PER SATU, BUKAN sekaligus):
--   Ada 9 MIGRASI di bawah, ditandai jelas "MIGRASI N/9". Jalankan SATU
--   migrasi per Run di Supabase SQL Editor (copy-paste blok itu saja),
--   laporkan hasilnya, tunggu konfirmasi, baru lanjut ke migrasi berikutnya.
--   Beberapa migrasi (ditandai "CHECKPOINT WAJIB") punya sub-langkah
--   SELECT/REVIEW yang HARUS dijalankan & ditinjau SEBELUM sub-langkah
--   berikutnya (INSERT/UPDATE) — JANGAN copy-paste seluruh blok migrasi itu
--   sekaligus, ikuti sub-langkahnya persis seperti tertulis.
-- ============================================================================


-- ============================================================================
-- MIGRASI 1/9 — monitoring_delivery_dp_seed_migration.sql
-- Risiko: AMAN. INSERT idempotent (ON CONFLICT DO NOTHING) - aman dijalankan
-- walau ternyata sebagian/semua baris ini sudah ada.
-- ============================================================================

insert into role_permissions (role, menu_key, enabled)
select r.role, 'monitoring_delivery_dp', true
from (values ('SPV Drop Point'), ('Admin DP')) as r(role)
on conflict (role, menu_key) do nothing;


-- ============================================================================
-- MIGRASI 2/9 — master_cabang_drop_point_default_false_migration.sql
-- Risiko: KEBIJAKAN (bukan risiko kehilangan data, tapi MENGUBAH AKSES akun
-- Production sungguhan). CHECKPOINT WAJIB: jalankan Langkah 1 (SELECT) DULU,
-- tinjau hasilnya, BARU putuskan mau jalankan Langkah 2 (UPDATE) atau tidak.
-- ============================================================================

-- --- Langkah 1 (JALANKAN & TINJAU DULU) ------------------------------------
-- Akun mana saja yang SUDAH override master_cabang/master_drop_point secara
-- individual - akses mereka TIDAK akan berubah oleh Langkah 2 (override
-- tetap menang atas default). Kosong = semua akun ikut default baru (false).
select
  u.email, u.nama, u.role, up.menu_key, up.enabled as override_enabled, up.updated_at
from user_permissions up
join users u on u.id = up.user_id
where up.menu_key in ('master_cabang', 'master_drop_point')
  and u.role in ('Admin Cabang', 'Manager Kota', 'Asisten Manager Kota')
order by u.role, u.email, up.menu_key;

-- --- Langkah 2 (JALANKAN SETELAH TINJAU Langkah 1) -------------------------
-- Balik default role_permissions ke false utk 2 menu_key x 3 role ini.
update role_permissions
set enabled = false
where menu_key in ('master_cabang', 'master_drop_point')
  and role in ('Admin Cabang', 'Manager Kota', 'Asisten Manager Kota');

-- --- Langkah 3 (VERIFIKASI) -------------------------------------------------
select role, menu_key, enabled
from role_permissions
where menu_key in ('master_cabang', 'master_drop_point')
order by role, menu_key;


-- ============================================================================
-- MIGRASI 3/9 — monitoring_inc_migration.sql
-- Risiko: AMAN (memperluas CHECK constraint, bukan mempersempit). Terkonfirmasi
-- BELUM ada di Production ('monitoring_inc' belum ada di role_permissions_menu_key_check).
-- ============================================================================

alter table role_permissions drop constraint if exists role_permissions_menu_key_check;
alter table role_permissions add constraint role_permissions_menu_key_check check (
  menu_key in (
    'dashboard', 'feedback_longtail_view', 'feedback_longtail_edit',
    'data_longtail', 'import_longtail',
    'monitoring_delivery_dp', 'monitoring_delivery_cabang',
    'monitoring_inc',
    'master_cabang', 'master_drop_point', 'master_feedback', 'user_management',
    'riwayat_import', 'riwayat_feedback',
    'pengaturan', 'role_akses'
  )
);

alter table user_permissions drop constraint if exists user_permissions_menu_key_check;
alter table user_permissions add constraint user_permissions_menu_key_check check (
  menu_key in (
    'dashboard', 'feedback_longtail_view', 'feedback_longtail_edit',
    'data_longtail', 'import_longtail',
    'monitoring_delivery_dp', 'monitoring_delivery_cabang',
    'monitoring_inc',
    'master_cabang', 'master_drop_point', 'master_feedback', 'user_management',
    'riwayat_import', 'riwayat_feedback',
    'pengaturan', 'role_akses'
  )
);

insert into role_permissions (role, menu_key, enabled)
values
  ('Admin Cabang', 'monitoring_inc', true),
  ('Manager Kota', 'monitoring_inc', true),
  ('Asisten Manager Kota', 'monitoring_inc', true),
  ('SPV Drop Point', 'monitoring_inc', true),
  ('Admin DP', 'monitoring_inc', true)
on conflict (role, menu_key) do nothing;


-- ============================================================================
-- MIGRASI 4/9 — feishu_communication_center.sql
-- Risiko: AMAN. Tabel baru (feishu_groups, communication_logs) + RLS.
-- CATATAN: CREATE POLICY di sini TIDAK idempotent (tanpa IF NOT EXISTS) -
-- aman utk Production (tabel belum pernah ada), TAPI JANGAN dijalankan 2x.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feishu_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id TEXT UNIQUE NOT NULL,
    group_name TEXT NOT NULL,
    avatar TEXT,
    member_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feishu_groups_chat_id ON public.feishu_groups (chat_id);
CREATE INDEX IF NOT EXISTS idx_feishu_groups_name ON public.feishu_groups (group_name);

CREATE TABLE IF NOT EXISTS public.communication_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel TEXT NOT NULL DEFAULT 'feishu',
    chat_id TEXT NOT NULL,
    message_type TEXT NOT NULL,
    status TEXT NOT NULL,
    error_message TEXT,
    response_time_ms INTEGER,
    sender_email TEXT,
    payload_summary JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_communication_logs_channel ON public.communication_logs (channel);
CREATE INDEX IF NOT EXISTS idx_communication_logs_created_at ON public.communication_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_communication_logs_status ON public.communication_logs (status);

ALTER TABLE public.feishu_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read feishu_groups"
    ON public.feishu_groups FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read communication_logs"
    ON public.communication_logs FOR SELECT TO authenticated USING (true);

NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- MIGRASI 5/9 — communication_config_migration.sql
-- Risiko: AMAN. Tabel baru x4, kolom baru di feishu_groups, RLS, seed 2 baris
-- template default (id UUID hardcoded, ON CONFLICT DO NOTHING).
-- WAJIB dijalankan SETELAH Migrasi 4/9 (kolom di ALTER TABLE feishu_groups).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module TEXT NOT NULL DEFAULT 'monitoring_inc',
    template_name TEXT NOT NULL,
    content TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'active',
    version TEXT NOT NULL DEFAULT 'v1.0',
    version_note TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_templates_module ON public.message_templates (module);
CREATE INDEX IF NOT EXISTS idx_message_templates_status ON public.message_templates (status);

CREATE TABLE IF NOT EXISTS public.message_template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.message_templates(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    content TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_msg_tpl_versions_tid ON public.message_template_versions (template_id);

CREATE TABLE IF NOT EXISTS public.card_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module TEXT NOT NULL DEFAULT 'monitoring_inc',
    template_name TEXT NOT NULL,
    blocks_config JSONB NOT NULL,
    json_template JSONB NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'active',
    version TEXT NOT NULL DEFAULT 'v1.0',
    version_note TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_card_templates_module ON public.card_templates (module);
CREATE INDEX IF NOT EXISTS idx_card_templates_status ON public.card_templates (status);

CREATE TABLE IF NOT EXISTS public.card_template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_template_id UUID NOT NULL REFERENCES public.card_templates(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    blocks_config JSONB NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_card_tpl_versions_cid ON public.card_template_versions (card_template_id);

ALTER TABLE public.feishu_groups ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
ALTER TABLE public.feishu_groups ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.feishu_groups ADD COLUMN IF NOT EXISTS last_sync TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.feishu_groups ADD COLUMN IF NOT EXISTS last_send TIMESTAMPTZ;

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read message_templates"
    ON public.message_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert message_templates"
    ON public.message_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update message_templates"
    ON public.message_templates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete message_templates"
    ON public.message_templates FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read message_template_versions"
    ON public.message_template_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert message_template_versions"
    ON public.message_template_versions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated read card_templates"
    ON public.card_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert card_templates"
    ON public.card_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update card_templates"
    ON public.card_templates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete card_templates"
    ON public.card_templates FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read card_template_versions"
    ON public.card_template_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert card_template_versions"
    ON public.card_template_versions FOR INSERT TO authenticated WITH CHECK (true);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'feishu_groups' AND policyname = 'Allow authenticated update feishu_groups'
    ) THEN
        CREATE POLICY "Allow authenticated update feishu_groups"
            ON public.feishu_groups FOR UPDATE TO authenticated USING (true);
    END IF;
END $$;

-- NOTE: seed template legacy (message_templates) DIPERTAHANKAN persis spt file
-- asli walau fitur "Message Template" bebas-teks sudah dihapus dari kode
-- (lihat CHANGELOG v2.6.0) - baris ini cuma data tak terpakai, tidak
-- mengganggu apa pun, dibiarkan spy migrasi ini identik dgn yang sudah
-- tervalidasi di Dev.
INSERT INTO public.message_templates (id, module, template_name, content, is_default, status, version, version_note)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'monitoring_inc',
    'Standar Monitoring INC',
    '📊 MONITORING INC' || E'\n' ||
    'Target Kota: {{city}}' || E'\n' ||
    '━━━━━━━━━━━━━━' || E'\n' ||
    '📦 Total Paket: {{total_package}}' || E'\n' ||
    '⏳ Belum TTD: {{pending_package}}' || E'\n' ||
    '✅ Clear TTD: {{clear_ttd}}' || E'\n' ||
    '🚨 Lewat SLA: {{over_sla}}' || E'\n' ||
    '📈 Progress: {{progress}}%' || E'\n' ||
    '━━━━━━━━━━━━━━' || E'\n' ||
    'Top Kecamatan:' || E'\n' ||
    '{{district_list}}' || E'\n' ||
    '━━━━━━━━━━━━━━' || E'\n' ||
    '{{footer}}',
    true, 'active', 'v1.0', 'Initial seed template'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.message_template_versions (template_id, version, content, note)
VALUES (
    '00000000-0000-0000-0000-000000000001', 'v1.0',
    '📊 MONITORING INC' || E'\n' ||
    'Target Kota: {{city}}' || E'\n' ||
    '━━━━━━━━━━━━━━' || E'\n' ||
    '📦 Total Paket: {{total_package}}' || E'\n' ||
    '⏳ Belum TTD: {{pending_package}}' || E'\n' ||
    '✅ Clear TTD: {{clear_ttd}}' || E'\n' ||
    '🚨 Lewat SLA: {{over_sla}}' || E'\n' ||
    '📈 Progress: {{progress}}%' || E'\n' ||
    '━━━━━━━━━━━━━━' || E'\n' ||
    'Top Kecamatan:' || E'\n' ||
    '{{district_list}}' || E'\n' ||
    '━━━━━━━━━━━━━━' || E'\n' ||
    '{{footer}}',
    'Initial default template version'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.card_templates (id, module, template_name, blocks_config, json_template, is_default, status, version, version_note)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'monitoring_inc',
    'Kartu Interaktif Monitoring INC',
    '{"title": "LTMS • Monitoring INC {{city}}", "theme": "red", "showLogo": true, "showSummary": true, "showKpiGrid": true, "kpiStyle": "4_column", "showTopKecamatan": true, "topKecamatanLimit": 5, "showImage": true, "showFooter": true, "footerText": "Logistics Traceability & Monitoring System (LTMS)", "actionButton": "open_dashboard"}'::jsonb,
    '{"schema": "2.0", "header": {"title": {"tag": "plain_text", "content": "LTMS • Monitoring INC {{city}}"}, "template": "red"}}'::jsonb,
    true, 'active', 'v1.0', 'Initial seed card template'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.card_template_versions (card_template_id, version, blocks_config, note)
VALUES (
    '00000000-0000-0000-0000-000000000002', 'v1.0',
    '{"title": "LTMS • Monitoring INC {{city}}", "theme": "red", "showLogo": true, "showSummary": true, "showKpiGrid": true, "kpiStyle": "4_column", "showTopKecamatan": true, "topKecamatanLimit": 5, "showImage": true, "showFooter": true, "footerText": "Logistics Traceability & Monitoring System (LTMS)", "actionButton": "open_dashboard"}'::jsonb,
    'Initial default card template version'
)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- MIGRASI 6/9 — communication_mentions_migration.sql (VERSI PRODUCTION —
-- SEED DEMO DIHAPUS, lihat catatan Bagian A poin #16)
-- Risiko: AMAN. Cuma tabel + index + RLS. TIDAK ADA INSERT seed demo (data
-- Open ID fiktif 'ou_demo_*') seperti versi asli file - Production diisi PIC
-- sungguhan lewat UI "Mention Mapping" setelah ini, bukan data placeholder.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.communication_mention_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope_type TEXT NOT NULL CHECK (scope_type IN ('kecamatan', 'drop_point', 'kurir')),
    scope_key TEXT NOT NULL,
    pic_name TEXT NOT NULL,
    role TEXT DEFAULT 'Admin DP',
    feishu_open_id TEXT,
    feishu_user_id TEXT,
    phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mention_map_scope ON public.communication_mention_mappings (scope_type, scope_key);
CREATE INDEX IF NOT EXISTS idx_mention_map_active ON public.communication_mention_mappings (is_active);

ALTER TABLE public.communication_mention_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read communication_mention_mappings"
    ON public.communication_mention_mappings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert communication_mention_mappings"
    ON public.communication_mention_mappings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update communication_mention_mappings"
    ON public.communication_mention_mappings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete communication_mention_mappings"
    ON public.communication_mention_mappings FOR DELETE TO authenticated USING (true);

-- (SENGAJA tidak ada INSERT seed demo di sini - lihat catatan di atas)


-- ============================================================================
-- MIGRASI 7/9 — communication_center_render_pipeline_migration.sql
-- Risiko: AMAN. ADD COLUMN + ALTER COLUMN DROP NOT NULL (melonggarkan).
-- WAJIB dijalankan SETELAH Migrasi 4-6/9 (kolom di tabel-tabel itu).
-- ============================================================================

ALTER TABLE public.communication_logs ADD COLUMN IF NOT EXISTS card_json JSONB;
ALTER TABLE public.card_templates ALTER COLUMN json_template DROP NOT NULL;


-- ============================================================================
-- MIGRASI 8/9 — drop_point_kecamatan_migration.sql
-- Risiko: AMAN. Tabel baru, FK ke master_drop_point (sudah ada di Production).
-- ============================================================================

create table if not exists drop_point_kecamatan (
  id          uuid primary key default gen_random_uuid(),
  kode_dp     text not null references master_drop_point(kode_dp) on delete cascade,
  kecamatan   text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint drop_point_kecamatan_kecamatan_unique unique (kecamatan),
  constraint drop_point_kecamatan_normalized check (kecamatan = upper(btrim(kecamatan)))
);

create index if not exists drop_point_kecamatan_kode_dp_idx on drop_point_kecamatan (kode_dp);

drop trigger if exists drop_point_kecamatan_updated on drop_point_kecamatan;
create trigger drop_point_kecamatan_updated before update on drop_point_kecamatan
  for each row execute function set_updated_at();


-- ============================================================================
-- MIGRASI 9/9 — drop_point_kecamatan_data_migration.sql
-- Risiko: BERISIKO-BERSYARAT. CHECKPOINT WAJIB — jalankan STEP A (3 query
-- SELECT) satu-satu DULU, tinjau hasilnya (khususnya A3 "bentrok"), BARU
-- putuskan jalankan STEP B. Data `wilayah` Production BELUM PERNAH
-- diverifikasi - JANGAN asumsikan hasilnya sama seperti Dev (yang kebetulan
-- 0 bentrok). WAJIB dijalankan SETELAH Migrasi 8/9.
-- ============================================================================

-- --- STEP A1: DP dengan wilayah kosong/NULL --------------------------------
select kode_dp, nama_dp, wilayah
from master_drop_point
where wilayah is null or btrim(wilayah) = ''
order by kode_dp;

-- --- STEP A2: preview hasil parsing -----------------------------------------
select
  kode_dp, nama_dp, wilayah as wilayah_asli,
  upper(btrim(k)) as kecamatan_parsed
from master_drop_point,
  lateral unnest(string_to_array(wilayah, ',')) as k
where wilayah is not null and btrim(wilayah) <> '' and btrim(k) <> ''
order by kode_dp, kecamatan_parsed;

-- --- STEP A3: BENTROK (PALING PENTING - tinjau dulu sebelum STEP B) --------
with parsed as (
  select distinct kode_dp, upper(btrim(k)) as kecamatan
  from master_drop_point,
    lateral unnest(string_to_array(wilayah, ',')) as k
  where wilayah is not null and btrim(wilayah) <> '' and btrim(k) <> ''
)
select kecamatan, array_agg(kode_dp order by kode_dp) as kode_dp_bentrok, count(*) as jumlah_dp
from parsed
group by kecamatan
having count(*) > 1
order by kecamatan;

-- --- STEP B: INSERT (jalankan HANYA setelah tinjau STEP A) -----------------
with parsed as (
  select distinct kode_dp, upper(btrim(k)) as kecamatan
  from master_drop_point,
    lateral unnest(string_to_array(wilayah, ',')) as k
  where wilayah is not null and btrim(wilayah) <> '' and btrim(k) <> ''
),
bentrok as (
  select kecamatan from parsed group by kecamatan having count(*) > 1
)
insert into drop_point_kecamatan (kode_dp, kecamatan)
select p.kode_dp, p.kecamatan
from parsed p
left join bentrok b on b.kecamatan = p.kecamatan
where b.kecamatan is null
on conflict (kecamatan) do nothing;

-- --- STEP C: verifikasi ------------------------------------------------------
select kode_dp, count(*) as jumlah_kecamatan
from drop_point_kecamatan
group by kode_dp
order by kode_dp;

select kecamatan, count(*)
from drop_point_kecamatan
group by kecamatan
having count(*) > 1;

select mdp.kode_dp, mdp.nama_dp, mdp.wilayah
from master_drop_point mdp
left join drop_point_kecamatan dpk on dpk.kode_dp = mdp.kode_dp
where dpk.id is null
order by mdp.kode_dp;
