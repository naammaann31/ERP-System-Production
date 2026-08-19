const fs = require('fs');
const file = 'lib/attendance.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('const istParts = (d: Date): Record<string, string> => {', 'export const istParts = (d: Date): Record<string, string> => {');
fs.writeFileSync(file, content);
console.log("Exported istParts");
