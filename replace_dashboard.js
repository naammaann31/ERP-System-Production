const fs = require('fs');
const file = 'components/dashboard/leave/EmployeeLeaveDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace initialLeaveBalances
content = content.replace(
/const initialLeaveBalances = \[[\s\S]*?\];/,
`const initialLeaveBalances = [
  { type: "Total Leaves", total: 0, used: 0, pending: 0, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50" }
];`
);

// Replace the tallying logic
content = content.replace(
/let plUsed = 0, plPending = 0;\s*let clUsed = 0, clPending = 0;\s*fetched\.forEach\(l => \{[\s\S]*?\}\);\s*updatedBalances\[0\]\.used = plUsed;\s*updatedBalances\[0\]\.pending = plPending;\s*updatedBalances\[1\]\.used = clUsed;\s*updatedBalances\[1\]\.pending = clPending;/,
`let totalUsed = 0, totalPending = 0;

      fetched.forEach(l => {
        if (l.status === "Approved") totalUsed += l.days;
        if (l.status === "Pending") totalPending += l.days;
      });

      updatedBalances[0].used = totalUsed;
      updatedBalances[0].pending = totalPending;`
);

// Remove the totalBalance constant completely
content = content.replace(
/\s*const totalBalance = \{[\s\S]*?bg: "bg-green-50"\s*\};/,
''
);

// Change [...balances, totalBalance].map to balances.map
content = content.replace(
/\{\[\.\.\.balances, totalBalance\]\.map\(/g,
'{balances.map('
);

fs.writeFileSync(file, content);
console.log('Update complete');
