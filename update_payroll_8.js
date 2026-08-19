const fs = require('fs');
const file = 'components/dashboard/payroll/HRPayrollDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /const executeDeletePayroll = async \(\) => \{\s*if \(\!payrollToDelete \|\| \!payrollToDelete\.id\) return;\s*await deletePayroll\(payrollToDelete\.id\);\s*getAllPayrolls\(\)\.then\(setAllPayrolls\);\s*setPayrollToDelete\(null\);\s*toast\.success\("Payroll record deleted"\);\s*\};/;

const replace = `  const executeDeletePayroll = async () => {
    if (!payrollToDelete || !payrollToDelete.id) return;
    await deletePayroll(payrollToDelete.id);
    getAllPayrolls().then(setAllPayrolls);
    
    setEmployees(prev => prev.map(emp => 
      emp.uid === payrollToDelete.userId ? { ...emp, isConfigured: false } : emp
    ));
    
    setPayrollToDelete(null);
    toast.success("Payroll record deleted");
  };`;

if (regex.test(content)) {
  content = content.replace(regex, replace);
  console.log("Replaced executeDeletePayroll");
} else {
  console.log("Could not find executeDeletePayroll");
}

fs.writeFileSync(file, content);
