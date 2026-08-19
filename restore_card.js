const fs = require('fs');
const file = 'components/dashboard/TopStats.tsx';
let content = fs.readFileSync(file, 'utf8');

// The stats for !isAdmin currently looks like:
//      : [
//        { title: "Attendance", value: attendanceStatus, subtitle: "Today", icon: CalendarCheck, color: "text-green-600", bg: "bg-green-100/50", accent: "bg-green-500" },
//        { title: "Leave Balance", value: leaveBalance, subtitle: "Days", icon: Palmtree, color: "text-emerald-600", bg: "bg-emerald-100/50", accent: "bg-emerald-500" },

// We will insert { title: "Total Working Hours", value: workingHrs, subtitle: "Today", icon: Clock, color: "text-indigo-600", bg: "bg-indigo-100/50", accent: "bg-indigo-500" },

content = content.replace(
  '        { title: "Attendance", value: attendanceStatus, subtitle: "Today", icon: CalendarCheck, color: "text-green-600", bg: "bg-green-100/50", accent: "bg-green-500" },',
  '        { title: "Attendance", value: attendanceStatus, subtitle: "Today", icon: CalendarCheck, color: "text-green-600", bg: "bg-green-100/50", accent: "bg-green-500" },\n        { title: "Total Working Hours", value: workingHrs, subtitle: "Today", icon: Clock, color: "text-indigo-600", bg: "bg-indigo-100/50", accent: "bg-indigo-500" },'
);

// We also need to restore the grid-cols from `stats.length === 3` check back to normal md:grid-cols-4 since it's 4 items now.
content = content.replace(
  '<div className={`grid grid-cols-2 ${stats.length === 3 ? "md:grid-cols-3" : "md:grid-cols-4"} gap-3 md:gap-4`}>',
  '<div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">'
);

fs.writeFileSync(file, content);
console.log("Restored Total Working Hours card");
