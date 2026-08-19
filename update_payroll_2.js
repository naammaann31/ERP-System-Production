const fs = require('fs');
const file = 'components/dashboard/payroll/HRPayrollDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

const target1 = `      const { data, error } = await supabase.from("profiles").select("*").neq("role", "Admin");
      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }
      const emps = (data || []).map((row: any) => ({
        uid: row.id,
        id: row.employee_id || "N/A",
        name: row.full_name || "Unnamed",
        department: row.role === "OPS_HR" ? "HR" : (row.role || "Employee"),
        jobRole: row.job_role || "N/A",
        createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
      }));`;

const replace1 = `      const { data, error } = await supabase.from("profiles").select("*").neq("role", "Admin");
      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }
      
      const { data: salaryData } = await supabase.from("salary_structures").select("user_id");
      const configuredIds = new Set((salaryData || []).map(r => r.user_id));

      const emps = (data || []).map((row: any) => ({
        uid: row.id,
        id: row.employee_id || "N/A",
        name: row.full_name || "Unnamed",
        department: row.role === "OPS_HR" ? "HR" : (row.role || "Employee"),
        jobRole: row.job_role || "N/A",
        createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
        isConfigured: configuredIds.has(row.id),
      }));`;

if (content.includes(target1)) {
  content = content.replace(target1, replace1);
  console.log("Replaced target1");
} else {
  console.log("Could not find target1 in the file.");
}

const target2 = `      await saveSalaryStructure(selectedEmployee.uid, {
        grossSalary,
        travelAllowance,
        otherAllowances: 0,
        otherDeductions
      });
      setIsConfigModalOpen(false);
      toast.success("Salary structure updated successfully!");`;

const replace2 = `      await saveSalaryStructure(selectedEmployee.uid, {
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

if (content.includes(target2)) {
  content = content.replace(target2, replace2);
  console.log("Replaced target2");
} else {
  console.log("Could not find target2 in the file.");
}

fs.writeFileSync(file, content);
