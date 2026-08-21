const fs = require('fs');
let content = fs.readFileSync('.env.local', 'utf8');

// Remove trailing quotes on SUPABASE_SERVICE_ROLE_KEY if they exist
content = content.replace(/SUPABASE_SERVICE_ROLE_KEY="(.*?)"\"/, 'SUPABASE_SERVICE_ROLE_KEY="$1"');

fs.writeFileSync('.env.local', content);
console.log('Fixed .env.local');
