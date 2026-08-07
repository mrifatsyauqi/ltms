-- ============================================================================
-- Migration: communication_center_render_pipeline_migration.sql
-- Description: Additive, non-destructive changes to support the single
--   server-side render pipeline (CardRenderPipeline -> CardCompilerService):
--   1. communication_logs.card_json — stores the exact compiled Feishu card
--      JSON sent for a given log row, so History Preview can render the
--      identical card that was actually delivered (no separate renderer).
--   2. card_templates.json_template — no longer written as primary data at
--      save time (blocks_config is now the only source of truth). The
--      column is kept for backward compatibility with any existing rows
--      and made nullable so new inserts do not require it.
-- No existing data or columns are dropped.
-- ============================================================================

ALTER TABLE public.communication_logs
  ADD COLUMN IF NOT EXISTS card_json JSONB;

COMMENT ON COLUMN public.communication_logs.card_json IS
  'Compiled Feishu Interactive Card JSON produced by CardCompilerService at send time. Used by History Preview to render the exact card that was sent, through the same InteractiveCardPreview component as Builder/Share previews.';

ALTER TABLE public.card_templates
  ALTER COLUMN json_template DROP NOT NULL;

COMMENT ON COLUMN public.card_templates.json_template IS
  'Deprecated as primary data. blocks_config is the single source of truth; Feishu JSON is now compiled fresh on every preview/send via CardCompilerService instead of being persisted here.';
