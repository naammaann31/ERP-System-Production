const fs = require('fs');
const file = 'components/dashboard/TopStats.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace the attendance stat with the attendance stat AND the total working hours stat
content = content.replace(
  '{ title: "Attendance", value: attendanceStatus, subtitle: "Today", icon: CalendarCheck, color: "text-green-600", bg: "bg-green-100/50", accent: "bg-green-500" },\n      { title: "Leave Balance"',
  '{ title: "Attendance", value: attendanceStatus, subtitle: "Today", icon: CalendarCheck, color: "text-green-600", bg: "bg-green-100/50", accent: "bg-green-500" },\n      { title: "Total Working Hours", value: workingHrs, subtitle: "Today", icon: Clock, color: "text-indigo-600", bg: "bg-indigo-100/50", accent: "bg-indigo-500" },\n      { title: "Leave Balance"'
);

fs.writeFileSync(file, content);
console.log("Restored Total Working Hours card with precise target");
