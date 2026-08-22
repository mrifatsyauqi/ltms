import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('whatsapp_sender_connections').select('*').limit(1);
  if (error) console.error(error);
  else if (data && data.length > 0) console.log(Object.keys(data[0]));
  else console.log('Table empty, cannot infer columns, use introspection');
  
  // Try to insert a dummy row to test if column exists
  const res = await supabase.from('whatsapp_sender_connections').insert({
    sender_id: 'test_col_check',
    sender_code: 'abc',
    channel_type: 'waba'
  }).select();
  
  if (res.error) {
    console.log("Insert failed. Error:", res.error.message);
  } else {
    console.log("Insert succeeded! Columns exist.");
    await supabase.from('whatsapp_sender_connections').delete().eq('sender_id', 'test_col_check');
  }
}
check();
