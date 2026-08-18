const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('C:\\Users\\admin\\Desktop\\ERP_PRODUCTION\\ERP-System-Production\\.env.local', 'utf8');
const vars = {};
env.split('\n').forEach(l => {
    const [k, ...v] = l.split('=');
    if(k && v.length) vars[k.trim()] = v.join('=').trim().replace(/^[\"']|[\"']$/g, '');
});
const supabase = createClient(vars.NEXT_PUBLIC_SUPABASE_URL, vars.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
    const { count } = await supabase.from('marketing').select('*', { count: 'exact', head: true });
    console.log("Total records:", count);
}
test();
