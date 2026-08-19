const fs = require('fs');
const file = 'components/dashboard/payroll/HRPayrollDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex1 = /const emps = \(data \|\| \[\]\)\.map\(\(row: any\) => \(\{\s*uid: row\.id,\s*id: row\.employee_id \|\| "N\/A",\s*name: row\.full_name \|\| "Unnamed",\s*department: row\.role === "OPS_HR" \? "HR" : \(row\.role \|\| "Employee"\),\s*jobRole: row\.job_role \|\| "N\/A",\s*createdAt: row\.created_at \? new Date\(row\.created_at\)\.getTime\(\) : 0,\s*\}\)\);/g;

const replacement1 = `
      const { data: salaryData } = await supabase.from("salary_structures").select("user_id");
      const configuredIds = new Set((salaryData || []).map((r) => r.user_id));

      const emps = (data || []).map((row: any) => ({
        uid: row.id,
        id: row.employee_id || "N/A",
        name: row.full_name || "Unnamed",
        department: row.role === "OPS_HR" ? "HR" : (row.role || "Employee"),
        jobRole: row.job_role || "N/A",
        createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
        isConfigured: configuredIds.has(row.id),
      }));`;

if (regex1.test(content)) {
  content = content.replace(regex1, replacement1);
  console.log("Replaced target1");
} else {
  console.log("Could not find target1");
}

const regex2 = /await saveSalaryStructure\(selectedEmployee\.uid, \{\s*grossSalary,\s*travelAllowance,\s*otherAllowances: 0,\s*otherDeductions\s*\}\);\s*setIsConfigModalOpen\(false\);\s*toast\.success\("Salary structure updated successfully!"\);/g;

const replacement2 = `await saveSalaryStructure(selectedEmployee.uid, {
        grossSalary,
        travelAllowance,
        otherAllowances: 0,
        otherDeductions
      });
      
      setEmployees(prev => prev.map(emp => 
        emp.uid === selectedEmployee.uid ? { ...emp, isConfigured: true } : emp
      ));
      
      setIsConfigModalOpen(false);
      toast.success("Salary structure updated successfully!");`;

if (regex2.test(content)) {
  content = content.replace(regex2, replacement2);
  console.log("Replaced target2");
} else {
  console.log("Could not find target2");
}

fs.writeFileSync(file, content);
