const fs = require('fs');
const file = 'components/dashboard/LiveAttendanceCard.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /const hour = parseInt\(new Intl.DateTimeFormat\('en-US', options\)\.format\(currentTime\)\);/;
const replace = `const formatted = new Intl.DateTimeFormat('en-US', options).format(currentTime);
      const hour = parseInt(formatted);
      console.log("Current time:", currentTime, "Formatted IST hour:", formatted, "Parsed hour:", hour);`;

if(content.includes("const hour = parseInt(new Intl.DateTimeFormat('en-US', options).format(currentTime));")) {
    content = content.replace(regex, replace);
    fs.writeFileSync(file, content);
    console.log("Added console log");
}
