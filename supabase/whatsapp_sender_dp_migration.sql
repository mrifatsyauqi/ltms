-- Tambahkan kolom drop_point_id ke whatsapp_sender_connections
ALTER TABLE public.whatsapp_sender_connections 
ADD COLUMN IF NOT EXISTS drop_point_id VARCHAR(255);

COMMENT ON COLUMN public.whatsapp_sender_connections.drop_point_id IS 'Ownership Drop Point untuk Sender Isolation (misal: BGG16)';

-- Update existing sender EFYK91RO (Syauqi) agar menjadi milik BGG16
UPDATE public.whatsapp_sender_connections
SET drop_point_id = 'BGG16'
WHERE sender_code = 'EFYK91RO' OR phone = '6281575652263';
