const fs = require('fs');
const file = 'components/dashboard/attendance/HRAttendanceDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes("updateAttendanceStatus")) {
  content = content.replace('getAllTodayAttendance, AttendanceRecord, getLocalDateString, formatAttendanceTime } from "@/lib/attendance";', 'getAllTodayAttendance, AttendanceRecord, getLocalDateString, formatAttendanceTime, updateAttendanceStatus } from "@/lib/attendance";');
}

const theadTarget = `<th className="px-5 py-4 font-bold">Status</th>`;
const theadReplace = `<th className="px-5 py-4 font-bold">Status</th>
                  <th className="px-5 py-4 font-bold">Action</th>`;

if (content.includes(theadTarget)) {
  content = content.replace(theadTarget, theadReplace);
}

// In the row
const rowTargetRegex = /<td className="px-5 py-3 whitespace-nowrap">\s*\{getStatusBadge\(record\.status, record\.isHalfDay, record\.isLate\)\}\s*<\/td>/;

// We need a way to change state on the fly. 
// A simple <select> element in the Action column that triggers an async call and updates the local state.
// Because it's an action, we can define a small inline function or a component.
// But we are in a functional component, so we can define a handler.

const handlerString = `
  const handleStatusChange = async (recordId: string, newStatusOption: string) => {
    let newStatus = "";
    let isHalfDay = false;
    if (newStatusOption === "present") {
      newStatus = "Present";
    } else if (newStatusOption === "half-day") {
      newStatus = "Present";
      isHalfDay = true;
    } else if (newStatusOption === "absent") {
      newStatus = "Absent";
    }
    
    try {
      await updateAttendanceStatus(recordId, newStatus, isHalfDay);
      toast.success("Attendance status updated");
      // update local state
      setEmployees(prev => prev.map(emp => 
        emp.id === recordId ? { ...emp, status: newStatus, isHalfDay } : emp
      ));
    } catch (e) {
      toast.error("Failed to update status");
      console.error(e);
    }
  };
`;

if (!content.includes("handleStatusChange")) {
  content = content.replace('const [searchTerm, setSearchTerm] = useState("");', 'const [searchTerm, setSearchTerm] = useState("");\n' + handlerString);
}

// In the loop
const rowReplace = `<td className="px-5 py-3 whitespace-nowrap">
                        {getStatusBadge(record.status, record.isHalfDay, record.isLate)}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <select
                          className="text-xs border-slate-200 rounded-md py-1 px-2"
                          value={record.status === "Absent" ? "absent" : (record.isHalfDay ? "half-day" : "present")}
                          onChange={(e) => handleStatusChange(record.id, e.target.value)}
                        >
                          <option value="present">Present</option>
                          <option value="half-day">Half Day</option>
                          <option value="absent">Absent</option>
                        </select>
                      </td>`;

content = content.replace(rowTargetRegex, rowReplace);

fs.writeFileSync(file, content);
console.log("Updated HRAttendanceDashboard");
