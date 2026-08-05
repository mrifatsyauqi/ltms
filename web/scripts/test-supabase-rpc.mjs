import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const envLocalPath = path.join(rootDir, '.env.local');
const envContent = fs.readFileSync(envLocalPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) {
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
  }
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  // Test if any sql exec rpc exists
  const rpcs = ['exec_sql', 'exec', 'execute_sql', 'sql', 'run_sql'];
  for (const r of rpcs) {
    const { data, error } = await supabase.rpc(r, { query: 'SELECT 1;' });
    console.log(`RPC [${r}]:`, error ? error.message : 'SUCCESS', data);
  }
}

main();
