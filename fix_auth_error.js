const fs = require('fs');
const file = 'components/providers/AuthProvider.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('.single();', '.maybeSingle();');
fs.writeFileSync(file, content);
console.log("Updated AuthProvider to use maybeSingle()");
