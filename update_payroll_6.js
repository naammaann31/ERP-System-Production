const fs = require('fs');
const file = 'components/dashboard/payroll/HRPayrollDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex1 = /const \{ data: salaryData \} = await supabase\.from\("salary_structures"\)\.select\("user_id"\);\s*const configuredIds = new Set\(\(salaryData \|\| \[\]\)\.map\(\(r\) => r\.user_id\)\);/g;
content = content.replace(regex1, '');

const regex2 = /isConfigured: configuredIds\.has\(row\.id\)/g;
content = content.replace(regex2, 'isConfigured: false');

fs.writeFileSync(file, content);
console.log("Updated HRPayrollDashboard");
