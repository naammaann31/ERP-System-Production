const fs = require('fs');
const file = 'components/dashboard/payroll/HRPayrollDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

const target1 = `    const fetchEmployees = async () => {
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

const replace1 = `    const fetchEmployees = async () => {
      const { data, error } = await supabase.from("profiles").select("*").neq("role", "Admin");
      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }
      
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
      }));
      emps.sort((a, b) => b.createdAt - a.createdAt);
      setEmployees(emps);
      setLoading(false);
    };`;

if (content.includes(target1)) {
  content = content.replace(target1, replace1);
  console.log("Replaced target1");
} else {
  console.log("Could not find target1");
}

fs.writeFileSync(file, content);
