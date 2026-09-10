const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL="(.*)"/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY="(.*)"/);

if (urlMatch && keyMatch) {
  const url = `${urlMatch[1]}/rest/v1/attendance?select=*`;
  fetch(url, {
    headers: {
      'apikey': keyMatch[1],
      'Authorization': `Bearer ${keyMatch[1]}`
    }
  }).then(res => res.json()).then(data => console.log(JSON.stringify(data, null, 2)));
} else {
  console.log("Could not find supabase credentials");
}
