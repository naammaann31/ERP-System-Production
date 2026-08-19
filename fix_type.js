const fs = require('fs');
const file = 'components/dashboard/attendance/HRAttendanceDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('let newStatus = "";', 'let newStatus: AttendanceRecord["status"] = "Present";');

fs.writeFileSync(file, content);
console.log("Fixed type error");
