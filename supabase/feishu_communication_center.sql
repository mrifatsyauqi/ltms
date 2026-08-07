-- ============================================================================
-- Migration: feishu_communication_center.sql
-- Description: Tabel feishu_groups dan communication_logs untuk Communication Center
-- ============================================================================

-- 1. Tabel feishu_groups (menyimpan daftar group yang bot ikuti)
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

-- 2. Tabel communication_logs (audit log riwayat komunikasi)
CREATE TABLE IF NOT EXISTS public.communication_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel TEXT NOT NULL DEFAULT 'feishu',
    chat_id TEXT NOT NULL,
    message_type TEXT NOT NULL,
    status TEXT NOT NULL, -- 'SUCCESS' | 'FAILED'
    error_message TEXT,
    response_time_ms INTEGER,
    sender_email TEXT,
    payload_summary JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_communication_logs_channel ON public.communication_logs (channel);
CREATE INDEX IF NOT EXISTS idx_communication_logs_created_at ON public.communication_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_communication_logs_status ON public.communication_logs (status);

-- Enable RLS & service role bypass
ALTER TABLE public.feishu_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users, full access for service_role
CREATE POLICY "Allow authenticated read feishu_groups"
    ON public.feishu_groups
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated read communication_logs"
    ON public.communication_logs
    FOR SELECT
    TO authenticated
    USING (true);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

