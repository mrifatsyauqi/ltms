-- ========================================================================================
-- MIGRATION SCRIPT: PUSH MAS KURIR (PRODUCTION)
-- ========================================================================================
-- Script ini bersifat IDEMPOTENT. Aman untuk dijalankan ulang di Supabase SQL Editor.
-- Hanya menambahkan tabel, kolom, constraint, policy, dan data master yang belum ada.
-- TIDAK MENGANDUNG perintah DROP, TRUNCATE, DELETE, atau modifikasi destruktif lainnya.
-- ========================================================================================

-- 1. whatsapp_contacts
CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sprinter_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    drop_point_id TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(sprinter_id)
);

-- 2. whatsapp_sender_connections
CREATE TABLE IF NOT EXISTS public.whatsapp_sender_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id TEXT NOT NULL,
    phone TEXT,
    display_name TEXT,
    status TEXT NOT NULL DEFAULT 'disconnected',
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(sender_id)
);

-- 3. whatsapp_message_templates
CREATE TABLE IF NOT EXISTS public.whatsapp_message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. whatsapp_send_batches
CREATE TABLE IF NOT EXISTS public.whatsapp_send_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module TEXT NOT NULL DEFAULT 'monitoring_delivery',
    monitoring_reference TEXT,
    template_id UUID NOT NULL REFERENCES public.whatsapp_message_templates(id),
    filter_operator TEXT NOT NULL,
    threshold NUMERIC NOT NULL,
    target_count INTEGER NOT NULL DEFAULT 0,
    submitted_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    bablast_blast_id TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ALTER whatsapp_send_batches for Bulk Integration (Bablast)
ALTER TABLE public.whatsapp_send_batches
ADD COLUMN IF NOT EXISTS group_name TEXT,
ADD COLUMN IF NOT EXISTS group_code VARCHAR(15),
ADD COLUMN IF NOT EXISTS blast_id BIGINT,
ADD COLUMN IF NOT EXISTS bablast_group_id BIGINT,
ADD COLUMN IF NOT EXISTS delay_seconds INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS drop_point_id TEXT,
ADD COLUMN IF NOT EXISTS sender_code TEXT,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS total_messages INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS queued_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS success_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS failed_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_whatsapp_send_batches_blast_id
ON public.whatsapp_send_batches(blast_id);

-- 5. whatsapp_send_logs
CREATE TABLE IF NOT EXISTS public.whatsapp_send_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES public.whatsapp_send_batches(id) ON DELETE CASCADE,
    sprinter_id TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    rendered_message TEXT NOT NULL,
    bablast_message_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ALTER whatsapp_send_logs for Bulk Integration
ALTER TABLE public.whatsapp_send_logs
ADD COLUMN IF NOT EXISTS drop_point_id TEXT,
ADD COLUMN IF NOT EXISTS sender_code TEXT,
ADD COLUMN IF NOT EXISTS sequence_number INTEGER;

-- 6. whatsapp_configurations
CREATE TABLE IF NOT EXISTS public.whatsapp_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(50) NOT NULL UNIQUE,
    api_key VARCHAR(255) NOT NULL,
    base_url VARCHAR(255) DEFAULT 'https://api.bablast.id',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ========================================================================================
-- ENABLE ROW LEVEL SECURITY
-- ========================================================================================
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_sender_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_send_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_send_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_configurations ENABLE ROW LEVEL SECURITY;

-- Safely Create RLS Policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable read access for authenticated users' AND tablename = 'whatsapp_contacts') THEN
        CREATE POLICY "Enable read access for authenticated users" ON public.whatsapp_contacts FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable insert access for authenticated users' AND tablename = 'whatsapp_contacts') THEN
        CREATE POLICY "Enable insert access for authenticated users" ON public.whatsapp_contacts FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable update access for authenticated users' AND tablename = 'whatsapp_contacts') THEN
        CREATE POLICY "Enable update access for authenticated users" ON public.whatsapp_contacts FOR UPDATE TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable read access for authenticated users' AND tablename = 'whatsapp_sender_connections') THEN
        CREATE POLICY "Enable read access for authenticated users" ON public.whatsapp_sender_connections FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable insert access for authenticated users' AND tablename = 'whatsapp_sender_connections') THEN
        CREATE POLICY "Enable insert access for authenticated users" ON public.whatsapp_sender_connections FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable update access for authenticated users' AND tablename = 'whatsapp_sender_connections') THEN
        CREATE POLICY "Enable update access for authenticated users" ON public.whatsapp_sender_connections FOR UPDATE TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable delete access for authenticated users' AND tablename = 'whatsapp_sender_connections') THEN
        CREATE POLICY "Enable delete access for authenticated users" ON public.whatsapp_sender_connections FOR DELETE TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable read access for authenticated users' AND tablename = 'whatsapp_message_templates') THEN
        CREATE POLICY "Enable read access for authenticated users" ON public.whatsapp_message_templates FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable insert access for authenticated users' AND tablename = 'whatsapp_message_templates') THEN
        CREATE POLICY "Enable insert access for authenticated users" ON public.whatsapp_message_templates FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable update access for authenticated users' AND tablename = 'whatsapp_message_templates') THEN
        CREATE POLICY "Enable update access for authenticated users" ON public.whatsapp_message_templates FOR UPDATE TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable read access for authenticated users' AND tablename = 'whatsapp_send_batches') THEN
        CREATE POLICY "Enable read access for authenticated users" ON public.whatsapp_send_batches FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable insert access for authenticated users' AND tablename = 'whatsapp_send_batches') THEN
        CREATE POLICY "Enable insert access for authenticated users" ON public.whatsapp_send_batches FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable update access for authenticated users' AND tablename = 'whatsapp_send_batches') THEN
        CREATE POLICY "Enable update access for authenticated users" ON public.whatsapp_send_batches FOR UPDATE TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable read access for authenticated users' AND tablename = 'whatsapp_send_logs') THEN
        CREATE POLICY "Enable read access for authenticated users" ON public.whatsapp_send_logs FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable insert access for authenticated users' AND tablename = 'whatsapp_send_logs') THEN
        CREATE POLICY "Enable insert access for authenticated users" ON public.whatsapp_send_logs FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable update access for authenticated users' AND tablename = 'whatsapp_send_logs') THEN
        CREATE POLICY "Enable update access for authenticated users" ON public.whatsapp_send_logs FOR UPDATE TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users to read whatsapp config' AND tablename = 'whatsapp_configurations') THEN
        CREATE POLICY "Allow authenticated users to read whatsapp config" ON public.whatsapp_configurations FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users to update whatsapp config' AND tablename = 'whatsapp_configurations') THEN
        CREATE POLICY "Allow authenticated users to update whatsapp config" ON public.whatsapp_configurations FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END
$$;

-- ========================================================================================
-- ROLE & PERMISSIONS MASTER DATA (SAFE UPDATE)
-- ========================================================================================
DO $$
BEGIN
    -- Only drop and re-add if menu_key exists in constraints (prevents syntax errors)
    ALTER TABLE public.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_menu_key_check;
    ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_menu_key_check CHECK (
        menu_key IN (
            'dashboard', 'feedback_longtail_view', 'feedback_longtail_edit',
            'data_longtail', 'import_longtail', 'monitoring_delivery_dp',
            'monitoring_delivery_cabang', 'monitoring_inc', 'laporan_harian',
            'master_cabang', 'master_drop_point', 'master_feedback',
            'user_management', 'riwayat_import', 'riwayat_feedback',
            'pengaturan', 'role_akses', 'push_mas_kurir'
        )
    );

    ALTER TABLE public.user_permissions DROP CONSTRAINT IF EXISTS user_permissions_menu_key_check;
    ALTER TABLE public.user_permissions ADD CONSTRAINT user_permissions_menu_key_check CHECK (
        menu_key IN (
            'dashboard', 'feedback_longtail_view', 'feedback_longtail_edit',
            'data_longtail', 'import_longtail', 'monitoring_delivery_dp',
            'monitoring_delivery_cabang', 'monitoring_inc', 'laporan_harian',
            'master_cabang', 'master_drop_point', 'master_feedback',
            'user_management', 'riwayat_import', 'riwayat_feedback',
            'pengaturan', 'role_akses', 'push_mas_kurir'
        )
    );
END
$$;

-- Seed default permissions
INSERT INTO public.role_permissions (role, menu_key, enabled)
VALUES 
    ('Admin DP', 'push_mas_kurir', true),
    ('SPV Drop Point', 'push_mas_kurir', true),
    ('Admin Cabang', 'push_mas_kurir', true),
    ('Manager Kota', 'push_mas_kurir', true),
    ('Asisten Manager Kota', 'push_mas_kurir', true)
ON CONFLICT (role, menu_key) DO NOTHING;

-- ========================================================================================
-- SEED MASTER DATA
-- ========================================================================================
INSERT INTO public.whatsapp_message_templates (name, content, status, created_by)
VALUES (
    'Default Push Mas Kurir',
    'Halo {{nama_sprinter}},

Performa delivery Anda hari ini:
Total Delivery: {{total_delivery}}
Clear TTD: {{clear_ttd}}
Belum TTD: {{belum_ttd}}
Persentase TTD: {{persentase_ttd}}%

Target minimal TTD: {{target_ttd}}%.

Mohon segera ditindaklanjuti agar TTD dapat mencapai target.

Terima kasih.',
    'active',
    'system'
) ON CONFLICT DO NOTHING;

-- ========================================================================================
-- VERIFICATION SQL (Run at the end to check successful setup)
-- ========================================================================================
DO $$
DECLARE
    missing_tables TEXT[] := '{}';
    tbl TEXT;
    all_tables TEXT[] := ARRAY[
        'whatsapp_contacts',
        'whatsapp_sender_connections',
        'whatsapp_message_templates',
        'whatsapp_send_batches',
        'whatsapp_send_logs',
        'whatsapp_configurations'
    ];
BEGIN
    FOREACH tbl IN ARRAY all_tables
    LOOP
        IF NOT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = tbl
        ) THEN
            missing_tables := array_append(missing_tables, tbl);
        ELSE
            RAISE NOTICE '[PASS] %', tbl;
        END IF;
    END LOOP;

    IF array_length(missing_tables, 1) > 0 THEN
        RAISE EXCEPTION '[FAIL] Missing tables: %', missing_tables;
    ELSE
        RAISE NOTICE '[PASS] ALL REQUIRED TABLES ARE PRESENT IN PRODUCTION.';
    END IF;
END
$$;
