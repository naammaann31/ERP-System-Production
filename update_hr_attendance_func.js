const fs = require('fs');
const file = 'components/dashboard/attendance/HRAttendanceDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldHandle = `  const handleStatusChange = async (recordId: string, newStatusOption: string) => {`;
const newHandle = `  const handleStatusChange = async (record: AttendanceRecord, newStatusOption: string) => {`;
content = content.replace(oldHandle, newHandle);

const oldCall = `await updateAttendanceStatus(recordId, newStatus, isHalfDay);`;
const newCall = `await updateAttendanceStatus(record.id as string, newStatus, isHalfDay, record.userId, record.date, record.fullName, record.role);`;
content = content.replace(oldCall, newCall);

const oldMap = `emp.id === recordId ? { ...emp, status: newStatus, isHalfDay } : emp`;
const newMap = `emp.id === record.id ? { ...emp, status: newStatus, isHalfDay } : emp`;
content = content.replace(oldMap, newMap);

const oldOnChange = `onChange={(e) => handleStatusChange(record.id as string, e.target.value)}`;
const newOnChange = `onChange={(e) => handleStatusChange(record, e.target.value)}`;
content = content.replace(oldOnChange, newOnChange);

fs.writeFileSync(file, content);
console.log("Updated HRAttendanceDashboard handleStatusChange");
