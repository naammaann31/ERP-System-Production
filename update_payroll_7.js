const fs = require('fs');
const file = 'components/dashboard/payroll/HRPayrollDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `  const executeDeletePayroll = async () => {
    if (!payrollToDelete || !payrollToDelete.id) return;
    await deletePayroll(payrollToDelete.id);
    getAllPayrolls().then(setAllPayrolls);
    setPayrollToDelete(null);
    toast.success("Payroll record deleted");
  };`;

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

if (content.includes(target)) {
  content = content.replace(target, replace);
  console.log("Replaced executeDeletePayroll");
} else {
  console.log("Could not find executeDeletePayroll");
}

fs.writeFileSync(file, content);
