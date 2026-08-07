-- ============================================================================
-- Script: clear_demo_mention_open_ids.sql
-- Description: Mengosongkan feishu_open_id untuk 8 baris data seed awal yang
--   berisi ID placeholder (ou_demo_*), bukan Open ID Feishu asli. Kartu akan
--   otomatis fallback ke teks "@Nama" biasa (bukan mention aktif) sampai
--   Open ID sungguhan diisi lewat fitur "Cari Open ID" di halaman Mention
--   Mapping. Tidak menghapus baris, hanya mengosongkan satu kolom.
-- ============================================================================

UPDATE public.communication_mention_mappings
SET feishu_open_id = NULL
WHERE feishu_open_id LIKE 'ou_demo_%';
