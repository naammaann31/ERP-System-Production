const fs = require('fs');
const file = 'app/api/send-leave-email/route.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/catch \(e\) \{/, 'catch (e: any) {');
fs.writeFileSync(file, content);
console.log('Fixed typescript error!');
