const fs = require('fs');
const file = 'components/dashboard/TopStats.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /const stats = isHR[\s\S]*?\];/;
const replacement = `const stats = isHR
    ? [
      { title: "Total Employees", value: totalEmployees.toString(), subtitle: "Active", icon: Users, color: "text-blue-600", bg: "bg-blue-100/50", accent: "bg-blue-500" },
      { title: "Attendance", value: attendanceStatus, subtitle: "Today", icon: CalendarCheck, color: "text-green-600", bg: "bg-green-100/50", accent: "bg-green-500" },
      { title: "Leave Balance", value: leaveBalance, subtitle: "Days", icon: Palmtree, color: "text-emerald-600", bg: "bg-emerald-100/50", accent: "bg-emerald-500" },
      { title: "Salary Status", value: salaryStatus, subtitle: salarySubtitle, icon: Wallet, color: "text-purple-600", bg: "bg-purple-100/50", accent: "bg-purple-500" },
    ]
    : [
      { title: "Attendance", value: attendanceStatus, subtitle: "Today", icon: CalendarCheck, color: "text-green-600", bg: "bg-green-100/50", accent: "bg-green-500" },
      { title: "Total Working Hours", value: workingHrs, subtitle: "Today", icon: Clock, color: "text-indigo-600", bg: "bg-indigo-100/50", accent: "bg-indigo-500" },
      { title: "Leave Balance", value: leaveBalance, subtitle: "Days", icon: Palmtree, color: "text-emerald-600", bg: "bg-emerald-100/50", accent: "bg-emerald-500" },
      { title: "Salary Status", value: salaryStatus, subtitle: salarySubtitle, icon: Wallet, color: "text-purple-600", bg: "bg-purple-100/50", accent: "bg-purple-500" },
    ];`;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content);
console.log("Restored accurately");
