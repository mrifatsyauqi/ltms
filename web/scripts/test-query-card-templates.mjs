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
  console.log('--- Query: SELECT * FROM card_templates LIMIT 1; ---');
  const { data: cards, error: errCards } = await supabase.from('card_templates').select('*').limit(1);
  if (errCards) {
    console.error('Error:', errCards);
  } else {
    console.log('Result:', JSON.stringify(cards, null, 2));
  }

  console.log('\n--- Query: SELECT * FROM message_templates LIMIT 1; ---');
  const { data: msgs, error: errMsgs } = await supabase.from('message_templates').select('*').limit(1);
  if (errMsgs) {
    console.error('Error:', errMsgs);
  } else {
    console.log('Result:', JSON.stringify(msgs, null, 2));
  }
}

main();
