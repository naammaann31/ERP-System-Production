const fs = require('fs');
const file = 'lib/leave.ts';
let content = fs.readFileSync(file, 'utf8');

const target = `export const updateLeaveStatus = async (leaveId: string, status: "Approved" | "Rejected") => {
  const supabase = createClient();
  const { error } = await supabase.from("leave_requests").update({ status }).eq("id", leaveId);
  if (error) throw error;
};`;

const replacement = `export const updateLeaveStatus = async (leaveId: string, status: "Approved" | "Rejected") => {
  const supabase = createClient();
  
  // Fetch leave details
  const { data: leave } = await supabase.from("leave_requests").select("*").eq("id", leaveId).single();
  
  const { error } = await supabase.from("leave_requests").update({ status }).eq("id", leaveId);
  if (error) throw error;
  
  if (leave) {
    try {
      const { data: profile } = await supabase.from("profiles").select("email").eq("id", leave.user_id).single();
      
      if (profile?.email) {
        const formatDate = (dateStr: string) => {
            if (!dateStr) return "-";
            const d = new Date(dateStr);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        };
        const duration = \`\${formatDate(leave.start_date)} - \${formatDate(leave.end_date)}\`;
        
        await fetch("/api/send-leave-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeName: leave.full_name,
            employeeEmail: profile.email,
            leaveType: leave.leave_type,
            duration: duration,
            days: leave.days,
            reason: leave.reason,
            status: status
          })
        });
      }
    } catch (e) {
      console.error("Failed to trigger email", e);
    }
  }
};`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(file, content);
    console.log("Successfully replaced!");
} else {
    console.log("Target not found!");
}
