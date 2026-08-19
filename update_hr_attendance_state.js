const fs = require('fs');
const file = 'components/dashboard/attendance/HRAttendanceDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('setEmployees(prev => prev.map(emp =>', 'setRecords(prev => prev.map(emp =>');

fs.writeFileSync(file, content);
console.log("Updated HRAttendanceDashboard setRecords");
