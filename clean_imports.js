const fs = require('fs');
const file = 'components/dashboard/attendance/EmployeeAttendanceDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/getRecentMonthOptions,\s*/, '');
fs.writeFileSync(file, content);
console.log("Cleaned up imports");
