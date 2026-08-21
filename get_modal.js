const fs = require('fs');
const file = 'components/dashboard/MarketingClient.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /function GenerateReportModal[\s\S]*?<\/div>\s*\);\s*}/;
const match = content.match(regex);
if (match) {
    console.log(match[0]);
} else {
    console.log("Not found");
}
