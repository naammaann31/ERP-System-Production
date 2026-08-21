const fs = require('fs');
const file = 'components/dashboard/TopStats.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add import
content = content.replace(
/import \{ getUserLeaves \} from "@\/lib\/leave";/,
`import { getUserLeaves, calculateAccruedLeaves } from "@/lib/leave";`
);

// Update logic
content = content.replace(
/const totalAvailable = 0 - totalUsed;/,
`const totalAccrued = calculateAccruedLeaves(profile.dateOfJoining);
      const totalAvailable = totalAccrued - totalUsed;`
);

fs.writeFileSync(file, content);
console.log('Update TopStats complete');
