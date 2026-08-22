-- ============================================================================
-- Migration: communication_mentions_migration.sql
-- Description: Tabel pemetaan mention PIC Feishu untuk Kecamatan, Drop Point, dan Kurir
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.communication_mention_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope_type TEXT NOT NULL CHECK (scope_type IN ('kecamatan', 'drop_point', 'kurir')),
    scope_key TEXT NOT NULL, -- cth: 'BATANG', 'WARUNGASEM', 'BATANG01', 'Andi'
    pic_name TEXT NOT NULL,  -- cth: 'Agus', 'Dimas', 'Rian'
    role TEXT DEFAULT 'Admin DP', -- cth: 'Admin DP', 'SPV DP', 'Kurir', 'Manager'
    feishu_open_id TEXT,     -- cth: 'ou_1234567890abcdef'
    feishu_user_id TEXT,     -- cth: 'on_xxxx' atau user_id alternatif
    phone TEXT,              -- nomor WhatsApp / telepon opsional
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indeks untuk pencarian cepat saat kompilasi kartu
CREATE INDEX IF NOT EXISTS idx_mention_map_scope ON public.communication_mention_mappings (scope_type, scope_key);
CREATE INDEX IF NOT EXISTS idx_mention_map_active ON public.communication_mention_mappings (is_active);

-- Enable RLS
ALTER TABLE public.communication_mention_mappings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow authenticated read communication_mention_mappings"
    ON public.communication_mention_mappings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert communication_mention_mappings"
    ON public.communication_mention_mappings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update communication_mention_mappings"
    ON public.communication_mention_mappings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete communication_mention_mappings"
    ON public.communication_mention_mappings FOR DELETE TO authenticated USING (true);

-- Seed data awal untuk pengujian operasional Batang & Pekalongan
INSERT INTO public.communication_mention_mappings (scope_type, scope_key, pic_name, role, feishu_open_id)
VALUES
    ('kecamatan', 'BATANG', 'Agus Supriyanto', 'Admin DP Batang', 'ou_demo_batang_01'),
    ('kecamatan', 'WARUNGASEM', 'Dimas Prasetyo', 'Admin DP Warungasem', 'ou_demo_warungasem_01'),
    ('kecamatan', 'LIMPUNG', 'Rian Hidayat', 'Admin DP Limpung', 'ou_demo_limpung_01'),
    ('kecamatan', 'BANDAR', 'Arif Munandar', 'Admin DP Bandar', 'ou_demo_bandar_01'),
    ('drop_point', 'BATANG01', 'Budi Santoso', 'SPV Drop Point Batang', 'ou_demo_spv_batang01'),
    ('kurir', 'Andi', 'Andi Setiawan', 'Sprinter / Kurir', 'ou_demo_kurir_andi'),
    ('kurir', 'Rudi', 'Rudi Hermawan', 'Sprinter / Kurir', 'ou_demo_kurir_rudi'),
    ('kurir', 'Bambang', 'Bambang Wijaya', 'Sprinter / Kurir', 'ou_demo_kurir_bambang')
ON CONFLICT DO NOTHING;
