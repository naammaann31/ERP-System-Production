const fs = require('fs');
const file = 'lib/attendance.ts';
let content = fs.readFileSync(file, 'utf8');

const oldFunc = `export const getUserAttendanceForMonth = async (userId: string, yearMonth: string) => {
  const supabase = createClient();
  const startDate = \`\${yearMonth}-01\`;
  const endDate = \`\${yearMonth}-31\`;

  const { data, error } = await supabase
    .from("attendance")
    .select("*")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false });

  if (error) throw error;
  return (data || []).map(fromRow).filter(r => r.role !== "Admin");
};`;

const newFunc = `export const getUserAttendanceForMonth = async (userId: string, yearMonth: string) => {
  const supabase = createClient();
  
  // 1. Fetch user profile for dummy records
  const { data: profile } = await supabase.from("profiles").select("id, full_name, role").eq("id", userId).maybeSingle();
  if (!profile) return [];
  if (profile.role === "Admin") return [];

  // 2. Fetch actual attendance records
  const startDate = \`\${yearMonth}-01\`;
  const endDate = \`\${yearMonth}-31\`;

  const { data, error } = await supabase
    .from("attendance")
    .select("*")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false });

  if (error) throw error;
  
  const existingRecords = (data || []).map(fromRow);
  const existingDates = new Set(existingRecords.map(r => r.date));
  
  // 3. Generate dates for the month up to today
  const [year, month] = yearMonth.split('-');
  const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
  const todayStr = getLocalDateString();
  
  const paddedRecords = [...existingRecords];
  
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = \`\${year}-\${month}-\${String(d).padStart(2, '0')}\`;
    
    // Don't pad future dates
    if (dateStr > todayStr) continue;
    
    // Ignore Sundays (0) if you have week off logic, but we'll just pad everything as Absent for now
    // Actually let's just pad it as Absent
    if (!existingDates.has(dateStr)) {
      paddedRecords.push({
        id: "absent-" + profile.id + "-" + dateStr,
        userId: profile.id,
        fullName: profile.full_name,
        role: profile.role,
        date: dateStr,
        checkInTime: null,
        checkOutTime: null,
        status: "Absent",
        workingSeconds: 0,
        isLate: false,
        isHalfDay: false,
      });
    }
  }
  
  // Sort descending by date
  paddedRecords.sort((a, b) => b.date.localeCompare(a.date));
  
  return paddedRecords;
};`;

content = content.replace(oldFunc, newFunc);
fs.writeFileSync(file, content);
console.log("Updated getUserAttendanceForMonth");
