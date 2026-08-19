const fs = require('fs');

const hrFile = 'components/dashboard/attendance/HRAttendanceDashboard.tsx';
let hrContent = fs.readFileSync(hrFile, 'utf8');

const hrRegex = /\{stat\.trendUp \? \([\s\S]*?\{stat\.trend\}[\s\S]*?<\/span>\s*\)\s*:\s*\([\s\S]*?\{stat\.trend\}[\s\S]*?<\/span>\s*\)\}/;
hrContent = hrContent.replace(hrRegex, '');
fs.writeFileSync(hrFile, hrContent);
console.log("Updated HRAttendanceDashboard");

const empFile = 'components/dashboard/attendance/EmployeeAttendanceDashboard.tsx';
let empContent = fs.readFileSync(empFile, 'utf8');

const empRegex = /<div className=\{`flex items-center gap-1 text-\[9px\] font-bold px-2 py-0\.5 rounded-full border shadow-sm transition-colors duration-300 \$\{stat\.trendUp \? 'bg-green-50 text-green-700 border-green-200 group-hover:bg-green-100' : 'bg-red-50 text-red-700 border-red-200 group-hover:bg-red-100'\}\`\}>\s*\{stat\.trend\}\s*<\/div>/;
empContent = empContent.replace(empRegex, '');
fs.writeFileSync(empFile, empContent);
console.log("Updated EmployeeAttendanceDashboard");
