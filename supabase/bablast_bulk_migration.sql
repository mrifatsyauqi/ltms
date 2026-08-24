-- Migration: Bablast Bulk Send Integration
-- Adds missing columns to whatsapp_send_batches and whatsapp_send_logs for bulk processing

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

-- Add index on blast_id for fast lookup in webhook
CREATE INDEX IF NOT EXISTS idx_whatsapp_send_batches_blast_id
ON public.whatsapp_send_batches(blast_id);


ALTER TABLE public.whatsapp_send_logs
ADD COLUMN IF NOT EXISTS drop_point_id TEXT,
ADD COLUMN IF NOT EXISTS sender_code TEXT,
ADD COLUMN IF NOT EXISTS sequence_number INTEGER;
