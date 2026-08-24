-- Phase A1: Add nullable columns for Async Batch Push Mas Kurir
ALTER TABLE public.whatsapp_send_batches
ADD COLUMN IF NOT EXISTS drop_point_id TEXT,
ADD COLUMN IF NOT EXISTS sender_code TEXT,
ADD COLUMN IF NOT EXISTS delay_seconds INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS total_messages INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS queued_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS success_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS failed_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Let's also check whatsapp_send_logs
ALTER TABLE public.whatsapp_send_logs
ADD COLUMN IF NOT EXISTS drop_point_id TEXT,
ADD COLUMN IF NOT EXISTS sender_code TEXT,
ADD COLUMN IF NOT EXISTS sequence_number INTEGER;
