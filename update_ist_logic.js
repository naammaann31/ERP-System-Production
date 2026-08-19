const fs = require('fs');
const file = 'components/dashboard/LiveAttendanceCard.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add import
content = content.replace(
  'getTodayAttendance,',
  'getTodayAttendance,\n  istParts,'
);

// Modify logic
const regex = /const isTooLateToClockIn = !isCheckedIn && !alreadyCheckedOut && currentTime && \(\(\) => \{[\s\S]*?\}\)\(\);/;
const replace = `const isTooLateToClockIn = !isCheckedIn && !alreadyCheckedOut && currentTime && (() => {
    const p = istParts(currentTime);
    const hour = Number(p.hour);
    return hour >= 0 && hour < 6;
  })();`;

content = content.replace(regex, replace);
fs.writeFileSync(file, content);
console.log("Updated isTooLateToClockIn in LiveAttendanceCard");
