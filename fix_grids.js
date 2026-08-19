const fs = require('fs');

const filesToFix = [
    'components/dashboard/attendance/EmployeeAttendanceDashboard.tsx',
    'components/dashboard/attendance/HRAttendanceDashboard.tsx',
    'components/dashboard/leave/HRLeaveDashboard.tsx',
    'components/dashboard/payroll/HRPayrollDashboard.tsx',
    'app/dashboard/departments/page.tsx',
    'app/dashboard/documents/page.tsx',
    'app/dashboard/page.tsx'
];

for (const file of filesToFix) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace lg:grid-cols-4 with lg:grid-cols-2 xl:grid-cols-4
    content = content.replace(/lg:grid-cols-4/g, 'lg:grid-cols-2 xl:grid-cols-4');
    
    // Replace lg:grid-cols-3 with lg:grid-cols-2 xl:grid-cols-3
    content = content.replace(/lg:grid-cols-3/g, 'lg:grid-cols-2 xl:grid-cols-3');

    fs.writeFileSync(file, content);
    console.log("Updated grids in " + file);
}
