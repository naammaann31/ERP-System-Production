const fs = require('fs');
const file = 'components/dashboard/TopStats.tsx';
let content = fs.readFileSync(file, 'utf8');

// Update imports to include computeWorkedSeconds
content = content.replace(
  'import { getTodayAttendance } from "@/lib/attendance";',
  'import { getTodayAttendance, computeWorkedSeconds } from "@/lib/attendance";'
);

// Replace the logic
const oldLogic = `        if (record.workingSeconds > 0) {
          const hrs = Math.floor(record.workingSeconds / 3600);
          const mins = Math.floor((record.workingSeconds % 3600) / 60);
          setWorkingHrs(\`\${hrs}h \${mins}m\`);
        }`;

const newLogic = `        const computedSeconds = computeWorkedSeconds(record);
        if (computedSeconds > 0) {
          const hrs = Math.floor(computedSeconds / 3600);
          const mins = Math.floor((computedSeconds % 3600) / 60);
          setWorkingHrs(\`\${hrs}h \${mins}m\`);
        } else {
          setWorkingHrs("0h 0m");
        }`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync(file, content);
console.log("Fixed working hours computation in TopStats");
