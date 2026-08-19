const fs = require('fs');
const file = 'app/dashboard/employees/[uid]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add toast import
if (!content.includes('import { toast } from "sonner";')) {
    content = content.replace('import { createClient } from "@/lib/supabase/client";', 'import { toast } from "sonner";\nimport { createClient } from "@/lib/supabase/client";');
}

// 2. Add updateAttendanceStatus import
content = content.replace(
    'import { getUserAttendanceForMonth, formatAttendanceTime, AttendanceRecord } from "@/lib/attendance";',
    'import { getUserAttendanceForMonth, formatAttendanceTime, AttendanceRecord, updateAttendanceStatus } from "@/lib/attendance";'
);

// 3. Add handleStatusChange
const handleStatusChangeStr = `  const handleStatusChange = async (record: AttendanceRecord, newStatusOption: string) => {
    let newStatus: AttendanceRecord["status"] = "Present";
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
      await updateAttendanceStatus(record.id as string, newStatus, isHalfDay, record.userId, record.date, record.fullName, record.role);
      toast.success("Attendance status updated");
      setAttendance(prev => prev.map(r => 
        r.id === record.id ? { ...r, status: newStatus, isHalfDay } : r
      ));
    } catch (e) {
      toast.error("Failed to update status");
      console.error(e);
    }
  };`;

content = content.replace('  const toggleCard = (card: keyof typeof openCards) => {', handleStatusChangeStr + '\n\n  const toggleCard = (card: keyof typeof openCards) => {');

// 4. Update the Table Header to include Action if admin/HR
const oldHeader = `<th className="px-5 py-3 font-bold tracking-wider">Status</th>
                            </tr>
                          </thead>`;
const newHeader = `<th className="px-5 py-3 font-bold tracking-wider">Status</th>
                              {isAdminOrHR && <th className="px-5 py-3 font-bold tracking-wider text-right">Action</th>}
                            </tr>
                          </thead>`;
content = content.replace(oldHeader, newHeader);

// 5. Update the Table Body to include the Action dropdown if admin/HR
const oldRow = `<td className="px-5 py-2.5">
                                    <Badge
                                      variant={r.status === "Present" || r.status === "Checked In" ? "success" : "secondary"}
                                      className="font-semibold text-[10px] py-0.5"
                                    >
                                      {r.status}
                                    </Badge>
                                  </td>
                                </tr>`;
                                
const newRow = `<td className="px-5 py-2.5">
                                    <Badge
                                      variant={r.status === "Present" || r.status === "Checked In" ? "success" : r.status === "Absent" ? "destructive" : "secondary"}
                                      className="font-semibold text-[10px] py-0.5"
                                    >
                                      {r.isHalfDay ? "Half Day" : r.status}
                                    </Badge>
                                  </td>
                                  {isAdminOrHR && (
                                    <td className="px-5 py-2.5 text-right">
                                      <select
                                        className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                        value={r.status === "Absent" ? "absent" : r.isHalfDay ? "half-day" : "present"}
                                        onChange={(e) => handleStatusChange(r, e.target.value)}
                                      >
                                        <option value="present">Present</option>
                                        <option value="half-day">Half Day</option>
                                        <option value="absent">Absent</option>
                                      </select>
                                    </td>
                                  )}
                                </tr>`;

// Since there are multiple tables, we need to make sure we replace the correct one. The Attendance one.
// Let's find the Attendance table body.
let parts = content.split('Attendance This Month');
parts[1] = parts[1].replace(oldRow, newRow);
content = parts.join('Attendance This Month');

fs.writeFileSync(file, content);
console.log("Updated Employee Profile page");
