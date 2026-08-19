const fs = require('fs');
const file = 'components/dashboard/payroll/HRPayrollDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

const regexClass = /emp\.isConfigured\s*\?\s*"bg-green-50 hover:bg-green-100 text-green-700 border-green-200"\s*:\s*"bg-white hover:bg-slate-50 text-slate-700 border-slate-200"/;

const replaceClass = 'emp.isConfigured && !hasPayrollThisMonth\n                                    ? "bg-green-50 hover:bg-green-100 text-green-700 border-green-200"\n                                    : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"';

if (regexClass.test(content)) {
  content = content.replace(regexClass, replaceClass);
  console.log("Replaced className condition.");
} else {
  console.log("Could not find className condition.");
}

const regexIcon = /emp\.isConfigured \? "text-green-600" : "text-slate-500"/;
const replaceIcon = 'emp.isConfigured && !hasPayrollThisMonth ? "text-green-600" : "text-slate-500"';

if (regexIcon.test(content)) {
  content = content.replace(regexIcon, replaceIcon);
  console.log("Replaced icon condition.");
} else {
  console.log("Could not find icon condition.");
}

fs.writeFileSync(file, content);
