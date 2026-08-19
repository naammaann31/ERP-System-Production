const fs = require('fs');
const file = 'components/dashboard/attendance/EmployeeAttendanceDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/selectedMonth/g, 'selectedDate');
content = content.replace(/setSelectedMonth/g, 'setSelectedDate');
content = content.replace(/type="month"/g, 'type="date"');

fs.writeFileSync(file, content);
console.log("Fixed remaining selectedMonth occurrences");
