const fs = require('fs');
const file = 'components/dashboard/payroll/HRPayrollDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add state variables for leaves
content = content.replace(
/const \[lopDays, setLopDays\] = useState<number>\(0\);/,
`const [lopDays, setLopDays] = useState<number>(0);
  const [leavesTakenThisMonth, setLeavesTakenThisMonth] = useState<number>(0);
  const [paidLeavesThisMonth, setPaidLeavesThisMonth] = useState<number>(0);`
);

// 2. Set the state variables in fetchAndCalculateLop
content = content.replace(
/setLopDays\(unpaidLeaves\);/,
`setLopDays(unpaidLeaves);
        setLeavesTakenThisMonth(leavesTakenInMonth);
        setPaidLeavesThisMonth(Math.min(leavesTakenInMonth, availableBalanceAtStartOfMonth));`
);

// 3. Pass them as props to GeneratePayrollModal
content = content.replace(
/setLopDays=\{setLopDays\}/,
`setLopDays={setLopDays}
          leavesTakenThisMonth={leavesTakenThisMonth}
          paidLeavesThisMonth={paidLeavesThisMonth}`
);

fs.writeFileSync(file, content);
console.log('Update HRPayrollDashboard state complete');
