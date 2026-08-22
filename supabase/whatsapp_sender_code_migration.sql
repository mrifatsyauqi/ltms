-- Tambahkan kolom sender_code dan channel_type ke whatsapp_sender_connections
ALTER TABLE public.whatsapp_sender_connections 
ADD COLUMN IF NOT EXISTS sender_code text,
ADD COLUMN IF NOT EXISTS channel_type text;

-- Tambahkan komentar untuk dokumentasi
COMMENT ON COLUMN public.whatsapp_sender_connections.sender_code IS 'Kode identifier dari Bablast untuk pengiriman pesan (misal: 8G710FV6)';
COMMENT ON COLUMN public.whatsapp_sender_connections.channel_type IS 'Jenis channel dari Bablast (misal: unofficial, waba)';
