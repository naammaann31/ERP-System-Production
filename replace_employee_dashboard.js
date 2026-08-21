const fs = require('fs');
const file = 'components/dashboard/leave/EmployeeLeaveDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add calculateAccruedLeaves to import
content = content.replace(
/import \{ applyLeave, listenToUserLeaves, LeaveRequest \} from "@\/lib\/leave";/,
`import { applyLeave, listenToUserLeaves, LeaveRequest, calculateAccruedLeaves } from "@/lib/leave";`
);

// Update initialLeaveBalances mapping inside useEffect
content = content.replace(
/const updatedBalances = initialLeaveBalances\.map\(bal => \(\{ \.\.\.bal, used: 0, pending: 0 \}\)\);/,
`const updatedBalances = initialLeaveBalances.map(bal => ({ ...bal, used: 0, pending: 0 }));
      
      const totalAccrued = calculateAccruedLeaves(profile?.dateOfJoining);
      updatedBalances[0].total = totalAccrued;`
);

fs.writeFileSync(file, content);
console.log('Update EmployeeLeaveDashboard complete');
