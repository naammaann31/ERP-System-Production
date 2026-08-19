const fs = require('fs');
const file = 'components/dashboard/TopStats.tsx';
let content = fs.readFileSync(file, 'utf8');

// The stats for !isHR currently looks exactly like this:
//      : [
//        { title: "Attendance", value: attendanceStatus, subtitle: "Today", icon: CalendarCheck, color: "text-green-600", bg: "bg-green-100/50", accent: "bg-green-500" },
//        { title: "Leave Balance", value: leaveBalance, subtitle: "Days", icon: Palmtree, color: "text-emerald-600", bg: "bg-emerald-100/50", accent: "bg-emerald-500" },

const searchString = `      : [\n        { title: "Attendance", value: attendanceStatus, subtitle: "Today", icon: CalendarCheck, color: "text-green-600", bg: "bg-green-100/50", accent: "bg-green-500" },\n        { title: "Leave Balance", value: leaveBalance, subtitle: "Days", icon: Palmtree, color: "text-emerald-600", bg: "bg-emerald-100/50", accent: "bg-emerald-500" },`;

const replaceString = `      : [\n        { title: "Attendance", value: attendanceStatus, subtitle: "Today", icon: CalendarCheck, color: "text-green-600", bg: "bg-green-100/50", accent: "bg-green-500" },\n        { title: "Total Working Hours", value: workingHrs, subtitle: "Today", icon: Clock, color: "text-indigo-600", bg: "bg-indigo-100/50", accent: "bg-indigo-500" },\n        { title: "Leave Balance", value: leaveBalance, subtitle: "Days", icon: Palmtree, color: "text-emerald-600", bg: "bg-emerald-100/50", accent: "bg-emerald-500" },`;

if (content.includes(searchString)) {
    content = content.replace(searchString, replaceString);
    fs.writeFileSync(file, content);
    console.log("SUCCESS");
} else {
    console.log("NOT FOUND! Let's try flexible regex.");
    content = content.replace(
        /\{\s*title:\s*"Attendance"[\s\S]*?\},/,
        `{ title: "Attendance", value: attendanceStatus, subtitle: "Today", icon: CalendarCheck, color: "text-green-600", bg: "bg-green-100/50", accent: "bg-green-500" },\n        { title: "Total Working Hours", value: workingHrs, subtitle: "Today", icon: Clock, color: "text-indigo-600", bg: "bg-indigo-100/50", accent: "bg-indigo-500" },`
    );
    fs.writeFileSync(file, content);
    console.log("Used flexible regex.");
}
