const fs = require('fs');
const file = 'components/dashboard/LiveAttendanceCard.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldLogic = `const isTooLateToClockIn = !isCheckedIn && !alreadyCheckedOut && currentTime && (() => {`;
const newLogic = `const isTooLateToClockIn = !isCheckedIn && !alreadyCheckedOut && !!currentTime && (() => {`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync(file, content);
console.log("Fixed boolean | null type error");
