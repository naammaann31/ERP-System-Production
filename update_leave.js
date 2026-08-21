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
  
  // 1. Fetch leave details
  const { data: leave } = await supabase.from("leave_requests").select("*").eq("id", leaveId).single();
  
  // 2. Update status
  const { error } = await supabase.from("leave_requests").update({ status }).eq("id", leaveId);
  if (error) throw error;
  
  // 3. Send email if we have leave details
  if (leave) {
    try {
      // Fetch user profile to get email
      const { data: profile } = await supabase.from("profiles").select("email").eq("id", leave.user_id).single();
      
      if (profile?.email) {
        // Format duration exactly like the UI
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
      console.error("Failed to trigger leave status email", e);
    }
  }
};`;

content = content.replace(target, replacement);

fs.writeFileSync(file, content);
console.log('Updated leave.ts with email logic!');
