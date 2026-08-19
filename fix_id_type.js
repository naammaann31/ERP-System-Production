const fs = require('fs');
const file = 'components/dashboard/attendance/HRAttendanceDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('handleStatusChange(record.id, e.target.value)', 'handleStatusChange(record.id as string, e.target.value)');

fs.writeFileSync(file, content);
console.log("Fixed record.id type error");
