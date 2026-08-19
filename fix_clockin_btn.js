const fs = require('fs');
const file = 'components/dashboard/LiveAttendanceCard.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace the disabled prop
content = content.replace(
  /disabled=\{loading \|\| alreadyCheckedOut\}/g,
  'disabled={loading || alreadyCheckedOut || isTooLateToClockIn}'
);

// Replace the class logic for graying out the button
const oldClassCondition = `alreadyCheckedOut 
                ? 'bg-slate-300 cursor-not-allowed text-slate-500 shadow-none'`;
const newClassCondition = `(alreadyCheckedOut || isTooLateToClockIn) 
                ? 'bg-slate-300 cursor-not-allowed text-slate-500 shadow-none'`;

if (content.includes(oldClassCondition)) {
    content = content.replace(oldClassCondition, newClassCondition);
} else {
    // try looser replace
    content = content.replace(
        /alreadyCheckedOut\s*\?\s*'bg-slate-300 cursor-not-allowed text-slate-500 shadow-none'/g,
        "(alreadyCheckedOut || isTooLateToClockIn) ? 'bg-slate-300 cursor-not-allowed text-slate-500 shadow-none'"
    );
}

fs.writeFileSync(file, content);
console.log("Replaced successfully");
