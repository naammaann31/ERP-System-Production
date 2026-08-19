const fs = require('fs');
const file = 'components/dashboard/TopStats.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace the line that contains the Working Hours card.
content = content.replace(/\s*\{\s*title:\s*"Working Hours".*\},/, '');

fs.writeFileSync(file, content);
console.log("Removed Working Hours card");
