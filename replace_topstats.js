const fs = require('fs');
const file = 'components/dashboard/TopStats.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
/getUserLeaves\(profile\.uid\)\.then\(\(leaves\) => \{[\s\S]*?setLeaveBalance\(totalAvailable\.toString\(\)\);\s*\}\);/,
`getUserLeaves(profile.uid).then((leaves) => {
      const totalUsed = leaves.filter((l) => l.status === "Approved").reduce((s, l) => s + l.days, 0);
      const totalAvailable = 0 - totalUsed;
      setLeaveBalance(totalAvailable.toString());
    });`
);

fs.writeFileSync(file, content);
console.log('Update TopStats complete');
