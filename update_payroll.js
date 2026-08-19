const fs = require('fs');
const file = 'components/dashboard/payroll/HRPayrollDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

const fetchTarget = `    const fetchEmployees = async () => {
      const { data, error } = await supabase.from("profiles").select("*").neq("role", "Admin");
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
      }));
      emps.sort((a, b) => b.createdAt - a.createdAt);
      setEmployees(emps);
      setLoading(false);
    };`;

const fetchReplace = `    const fetchEmployees = async () => {
      const { data, error } = await supabase.from("profiles").select("*").neq("role", "Admin");
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
      }));
      emps.sort((a, b) => b.createdAt - a.createdAt);
      setEmployees(emps);
      setLoading(false);
    };`;

content = content.replace(fetchTarget, fetchReplace);

const saveTarget = `    const handleSaveStructure = async () => {
      if (!selectedEmployee) return;
      await saveSalaryStructure(selectedEmployee.uid, {
        grossSalary,
        travelAllowance,
        otherAllowances: 0,
        otherDeductions
      });
      setIsConfigModalOpen(false);
      toast.success("Salary structure updated successfully!");
    };`;

const saveReplace = `    const handleSaveStructure = async () => {
      if (!selectedEmployee) return;
      await saveSalaryStructure(selectedEmployee.uid, {
        grossSalary,
        travelAllowance,
        otherAllowances: 0,
        otherDeductions
      });
      
      setEmployees(prev => prev.map(emp => 
        emp.uid === selectedEmployee.uid ? { ...emp, isConfigured: true } : emp
      ));
      
      setIsConfigModalOpen(false);
      toast.success("Salary structure updated successfully!");
    };`;

content = content.replace(saveTarget, saveReplace);

fs.writeFileSync(file, content);
console.log('Update complete!');
