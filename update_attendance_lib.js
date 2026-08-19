const fs = require('fs');
const file = 'lib/attendance.ts';
let content = fs.readFileSync(file, 'utf8');

const newFunc = `
export const updateAttendanceStatus = async (id: string, status: string, isHalfDay: boolean) => {
  const supabase = createClient();
  const { error } = await supabase
    .from("attendance")
    .update({ 
      status, 
      is_half_day: isHalfDay,
      working_seconds: status === 'Absent' ? 0 : undefined // Reset working seconds if absent, but don't strictly require it
    })
    .eq("id", id);
    
  if (error) throw error;
};
`;

content = content + newFunc;
fs.writeFileSync(file, content);
console.log("Added updateAttendanceStatus");
