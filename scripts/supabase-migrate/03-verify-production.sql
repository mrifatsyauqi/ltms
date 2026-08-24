-- 03-verify-production.sql
-- VERIFIKASI KEBERADAAN TABEL UNTUK PUSH MAS KURIR

DO $$
DECLARE
    missing_tables TEXT[] := '{}';
    tbl TEXT;
    all_tables TEXT[] := ARRAY[
        'whatsapp_contacts',
        'whatsapp_sender_connections',
        'whatsapp_message_templates',
        'whatsapp_send_batches',
        'whatsapp_send_logs',
        'whatsapp_configurations'
    ];
BEGIN
    FOREACH tbl IN ARRAY all_tables
    LOOP
        IF NOT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = tbl
        ) THEN
            missing_tables := array_append(missing_tables, tbl);
        END IF;
    END LOOP;

    IF array_length(missing_tables, 1) > 0 THEN
        RAISE EXCEPTION 'VERIFICATION FAILED. Missing tables: %', missing_tables;
    ELSE
        RAISE NOTICE 'VERIFICATION SUCCESSFUL. All Push Mas Kurir tables exist.';
    END IF;
END
$$;
