import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=\s*(.*)/);

const url = urlMatch[1].trim().replace(/^['"]|['"]$/g, '');
const key = keyMatch[1].trim().replace(/^['"]|['"]$/g, '');

const supabase = createClient(url, key);

async function run() {
  const { error } = await supabase.from('notifications').delete().eq('type', 'announcement');
  if (error) console.error(error);
  else console.log('Deleted all orphaned announcement notifications.');
}
run();
