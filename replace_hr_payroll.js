const fs = require('fs');
const file = 'components/dashboard/payroll/HRPayrollDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add dateOfJoining to Employee interface
content = content.replace(
/jobRole: string;\s*isConfigured\?: boolean;\s*\}/,
`jobRole: string;
  isConfigured?: boolean;
  dateOfJoining?: string;
}`
);

// 2. Map date_of_joining in fetchEmployees
content = content.replace(
/department: emp\.department,\s*jobRole: emp\.job_role,\s*\}/g,
`department: emp.department,
            jobRole: emp.job_role,
            dateOfJoining: emp.date_of_joining,
          }`
);

// 3. Update the fetchAndCalculateLop to calculate correctly!
const lopReplacement = `
        let totalLeavesTakenBeforeMonth = 0;
        let leavesTakenInMonth = 0;

        yearLeaves.forEach(l => {
            const start = new Date(l.startDate);
            if (start.getFullYear() < year || (start.getFullYear() === year && start.getMonth() + 1 < month)) {
                totalLeavesTakenBeforeMonth += l.days;
            } else if (start.getFullYear() === year && start.getMonth() + 1 === month) {
                leavesTakenInMonth += l.days;
            }
        });
        
        // Use the helper from lib/leave (we need to import it!)
        // Wait, calculateMonthsEmployed isn't imported here yet. Let's just inline the logic or import it.
        // I will add the import at the top later.
        const calculateAccrued = () => {
            if (!selectedEmployee.dateOfJoining) return 2; // Default 2 for 1st month
            const joinDate = new Date(selectedEmployee.dateOfJoining);
            if (isNaN(joinDate.getTime())) return 2;
            
            const targetDate = new Date(year, month - 1, 1);
            
            // If they are generating payroll for a month BEFORE they joined, this is weird but we handle it
            if (targetDate < joinDate) return 0;
            
            const yearsDiff = targetDate.getFullYear() - joinDate.getFullYear();
            const monthsDiff = targetDate.getMonth() - joinDate.getMonth();
            const totalMonths = (yearsDiff * 12) + monthsDiff;
            return Math.max(1, totalMonths + 1) * 2;
        };
        
        const totalAccruedUpToMonth = calculateAccrued();
        const availableBalanceAtStartOfMonth = Math.max(0, totalAccruedUpToMonth - totalLeavesTakenBeforeMonth);
        
        // If they took more leaves in this month than their available balance, the rest is LOP
        const unpaidLeaves = Math.max(0, leavesTakenInMonth - availableBalanceAtStartOfMonth);
        
        // Save these to state so we can show them in the modal
        setLopDays(unpaidLeaves);
        
        // Wait, we also need to pass leavesTakenInMonth and availableBalanceAtStartOfMonth to the modal!
        // We can add state for them.
`;

content = content.replace(
/let lopTotal = 0;\s*const limits: Record<string, number> = \{[\s\S]*?setLopDays\(lopTotal\);/,
lopReplacement
);

fs.writeFileSync(file, content);
console.log('Update HRPayrollDashboard logic complete');
