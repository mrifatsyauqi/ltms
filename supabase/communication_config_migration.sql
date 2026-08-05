-- ============================================================================
-- Migration: communication_config_migration.sql
-- Description: Tabel konfigurasi template pesan, kartu interaktif visual, versi, dan status grup
-- ============================================================================

-- 1. Tabel message_templates
CREATE TABLE IF NOT EXISTS public.message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module TEXT NOT NULL DEFAULT 'monitoring_inc', -- 'monitoring_inc' | 'monitoring_delivery' | 'longtail' | 'dashboard' | 'custom'
    template_name TEXT NOT NULL,
    content TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'archived'
    version TEXT NOT NULL DEFAULT 'v1.0',
    version_note TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_templates_module ON public.message_templates (module);
CREATE INDEX IF NOT EXISTS idx_message_templates_status ON public.message_templates (status);

-- 2. Tabel message_template_versions
CREATE TABLE IF NOT EXISTS public.message_template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.message_templates(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    content TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_msg_tpl_versions_tid ON public.message_template_versions (template_id);

-- 3. Tabel card_templates
CREATE TABLE IF NOT EXISTS public.card_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module TEXT NOT NULL DEFAULT 'monitoring_inc',
    template_name TEXT NOT NULL,
    blocks_config JSONB NOT NULL,
    json_template JSONB NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'archived'
    version TEXT NOT NULL DEFAULT 'v1.0',
    version_note TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_card_templates_module ON public.card_templates (module);
CREATE INDEX IF NOT EXISTS idx_card_templates_status ON public.card_templates (status);

-- 4. Tabel card_template_versions
CREATE TABLE IF NOT EXISTS public.card_template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_template_id UUID NOT NULL REFERENCES public.card_templates(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    blocks_config JSONB NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_card_tpl_versions_cid ON public.card_template_versions (card_template_id);

-- 5. Tambah kolom pada feishu_groups
ALTER TABLE public.feishu_groups ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
ALTER TABLE public.feishu_groups ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.feishu_groups ADD COLUMN IF NOT EXISTS last_sync TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.feishu_groups ADD COLUMN IF NOT EXISTS last_send TIMESTAMPTZ;

-- 6. Enable RLS
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_template_versions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated read/write access
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

-- Allow authenticated update on feishu_groups (for default group toggle)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'feishu_groups' AND policyname = 'Allow authenticated update feishu_groups'
    ) THEN
        CREATE POLICY "Allow authenticated update feishu_groups"
            ON public.feishu_groups FOR UPDATE TO authenticated USING (true);
    END IF;
END $$;

-- 7. Seed Initial Default Templates (Monitoring INC)
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
    true,
    'active',
    'v1.0',
    'Initial seed template'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.message_template_versions (template_id, version, content, note)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'v1.0',
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

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
