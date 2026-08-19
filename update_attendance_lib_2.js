const fs = require('fs');
const file = 'lib/attendance.ts';
let content = fs.readFileSync(file, 'utf8');

const oldFunc = `export const updateAttendanceStatus = async (id: string, status: string, isHalfDay: boolean) => {
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
};`;

const newFunc = `export const updateAttendanceStatus = async (
  id: string, 
  status: string, 
  isHalfDay: boolean,
  userId?: string,
  dateStr?: string,
  fullName?: string,
  role?: string
) => {
  const supabase = createClient();
  
  if (id.startsWith('absent-') && userId && dateStr) {
    // This record doesn't exist in the DB yet, insert it
    const { error } = await supabase.from("attendance").insert({
      user_id: userId,
      full_name: fullName || 'Unknown',
      role: role || 'Employee',
      date: dateStr,
      status: status,
      is_half_day: isHalfDay,
      working_seconds: 0
    });
    if (error) throw error;
  } else {
    // Update existing record
    const { error } = await supabase
      .from("attendance")
      .update({ 
        status, 
        is_half_day: isHalfDay,
        working_seconds: status === 'Absent' ? 0 : undefined 
      })
      .eq("id", id);
      
    if (error) throw error;
  }
};`;

content = content.replace(oldFunc, newFunc);
fs.writeFileSync(file, content);
console.log("Updated updateAttendanceStatus");
