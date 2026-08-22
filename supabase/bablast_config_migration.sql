-- Tabel untuk menyimpan konfigurasi API kunci Bablast secara global
CREATE TABLE IF NOT EXISTS public.whatsapp_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(50) NOT NULL UNIQUE, -- e.g. 'bablast'
    api_key VARCHAR(255) NOT NULL,
    base_url VARCHAR(255) DEFAULT 'https://api.bablast.id',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE public.whatsapp_configurations ENABLE ROW LEVEL SECURITY;

-- Allow read for authenticated users (the backend API will actually use service role if needed or authenticated role)
CREATE POLICY "Allow authenticated users to read whatsapp config"
    ON public.whatsapp_configurations
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow Admin DP or SPV DP to update (or just rely on application layer checks)
CREATE POLICY "Allow authenticated users to update whatsapp config"
    ON public.whatsapp_configurations
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
