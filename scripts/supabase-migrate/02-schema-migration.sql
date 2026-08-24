-- 02-schema-migration.sql
-- IDEMPOTENT MIGRATION FOR PUSH MAS KURIR FEATURES
-- Safely applies schema to Production without touching existing data.

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

-- Seed default template (Data Migration - Master Data)
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

-- Alter whatsapp_send_batches for bulk processing
ALTER TABLE public.whatsapp_send_batches
ADD COLUMN IF NOT EXISTS drop_point_id TEXT,
ADD COLUMN IF NOT EXISTS sender_code TEXT,
ADD COLUMN IF NOT EXISTS group_name TEXT,
ADD COLUMN IF NOT EXISTS group_code VARCHAR(15),
ADD COLUMN IF NOT EXISTS blast_id BIGINT,
ADD COLUMN IF NOT EXISTS bablast_group_id BIGINT,
ADD COLUMN IF NOT EXISTS delay_seconds INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS total_messages INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS queued_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS success_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS failed_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

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

-- Alter whatsapp_send_logs for bulk processing
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

-- Enable RLS
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_sender_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_send_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_send_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_configurations ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies can be handled individually or mapped.
-- Safe creation of basic RLS policies using PL/pgSQL block to ignore 'already exists' errors
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable read access for authenticated users' AND tablename = 'whatsapp_contacts') THEN
        CREATE POLICY "Enable read access for authenticated users" ON public.whatsapp_contacts FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable read access for authenticated users' AND tablename = 'whatsapp_sender_connections') THEN
        CREATE POLICY "Enable read access for authenticated users" ON public.whatsapp_sender_connections FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable read access for authenticated users' AND tablename = 'whatsapp_message_templates') THEN
        CREATE POLICY "Enable read access for authenticated users" ON public.whatsapp_message_templates FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable read access for authenticated users' AND tablename = 'whatsapp_send_batches') THEN
        CREATE POLICY "Enable read access for authenticated users" ON public.whatsapp_send_batches FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable read access for authenticated users' AND tablename = 'whatsapp_send_logs') THEN
        CREATE POLICY "Enable read access for authenticated users" ON public.whatsapp_send_logs FOR SELECT TO authenticated USING (true);
    END IF;
END
$$;

-- Update role permissions safely
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

INSERT INTO public.role_permissions (role, menu_key, enabled)
VALUES 
    ('Admin DP', 'push_mas_kurir', true),
    ('SPV Drop Point', 'push_mas_kurir', true),
    ('Admin Cabang', 'push_mas_kurir', true),
    ('Manager Kota', 'push_mas_kurir', true),
    ('Asisten Manager Kota', 'push_mas_kurir', true)
ON CONFLICT (role, menu_key) DO NOTHING;
