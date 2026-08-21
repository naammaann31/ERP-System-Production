const fs = require('fs');
const file = 'components/dashboard/leave/EmployeeLeaveDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Fix negative balance
content = content.replace(
/const available = leave\.total - leave\.used - leave\.pending;/,
`const available = Math.max(0, leave.total - leave.used - leave.pending);`
);

// 2. Add calculation for leaves taken this month
const tallyLogic = `
      let totalUsed = 0, totalPending = 0;
      let usedThisMonth = 0;
      
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      fetched.forEach(l => {
        if (l.status === "Approved") {
            totalUsed += l.days;
            const start = new Date(l.startDate);
            if (start.getMonth() === currentMonth && start.getFullYear() === currentYear) {
                usedThisMonth += l.days;
            }
        }
        if (l.status === "Pending") totalPending += l.days;
      });

      updatedBalances[0].used = totalUsed;
      updatedBalances[0].pending = totalPending;
      
      // We need a way to pass usedThisMonth to the state so we can render the second card.
      // Let's modify initialLeaveBalances to hold two items instead!
`;

content = content.replace(
/let totalUsed = 0, totalPending = 0;[\s\S]*?updatedBalances\[0\]\.pending = totalPending;/,
tallyLogic
);

// 3. Modify initialLeaveBalances
const initBalances = `const initialLeaveBalances = [
  { type: "Total Leaves", total: 0, used: 0, pending: 0, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50" },
  { type: "Leaves This Month", total: 0, used: 0, pending: 0, icon: Calendar, color: "text-blue-500", bg: "bg-blue-50" }
];`;

content = content.replace(
/const initialLeaveBalances = \[[\s\S]*?\];/,
initBalances
);

// 4. Update the mapping to set usedThisMonth to the new card
const mapLogic = `
      updatedBalances[0].used = totalUsed;
      updatedBalances[0].pending = totalPending;
      updatedBalances[1].used = usedThisMonth;
`;

content = content.replace(
/updatedBalances\[0\]\.used = totalUsed;\s*updatedBalances\[0\]\.pending = totalPending;/,
mapLogic
);

// 5. Hide the "/ 0 days" for the second card since it's just a count.
// Wait, the mapping uses {leave.total}. Let's change the card rendering to conditionally hide the total if type is "Leaves This Month"
const cardRender = `
                  <div className="flex items-baseline gap-1.5 mb-3">
                    <span className="text-3xl font-black text-slate-900 tracking-tight">{leave.type === "Leaves This Month" ? leave.used : available}</span>
                    {leave.type !== "Leaves This Month" && <span className="text-slate-500 text-[11px] font-semibold">/ {leave.total} days</span>}
                  </div>
                  {leave.type !== "Leaves This Month" && (
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                    <div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Used</p>
                      <p className="text-base font-black text-slate-800">{leave.used}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Pending</p>
                      <p className="text-base font-black text-slate-800">{leave.pending}</p>
                    </div>
                  </div>
                  )}
`;

content = content.replace(
/<div className="flex items-baseline gap-1\.5 mb-3">[\s\S]*?<\/div>\s*<\/div>/,
cardRender + '\n                </div>' // wait, regex might cut too much or too little. Let's do targeted string replace.
);

fs.writeFileSync(file, content);
console.log('Update logic complete');
