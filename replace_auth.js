const fs = require('fs');
const file = 'components/providers/AuthProvider.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
/export interface UserProfile \{[\s\S]*?department\?: string;\s*\}/,
`export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  role: string;
  status?: string;
  jobRole?: string;
  employeeId?: string;
  designation?: string;
  department?: string;
  dateOfJoining?: string;
}`
);

content = content.replace(
/function toProfile\(row: any\): UserProfile \{[\s\S]*?department: row\.department,\s*\};\s*\}/,
`function toProfile(row: any): UserProfile {
  return {
    uid: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    status: row.status,
    jobRole: row.job_role,
    employeeId: row.employee_id,
    designation: row.designation,
    department: row.department,
    dateOfJoining: row.date_of_joining,
  };
}`
);

fs.writeFileSync(file, content);
console.log('Update AuthProvider complete');
