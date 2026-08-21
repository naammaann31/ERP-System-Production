const fs = require('fs');
const file = 'lib/leave.ts';
let content = fs.readFileSync(file, 'utf8');

const replacement = `export const updateLeaveStatus = async (leaveId: string, status: "Approved" | "Rejected") => {
  const supabase = createClient();
  
  // Fetch leave details
  const { data: leave } = await supabase.from("leave_requests").select("*").eq("id", leaveId).single();
  
  const { error } = await supabase.from("leave_requests").update({ status }).eq("id", leaveId);
  if (error) throw error;
  
  if (leave) {
    try {
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
          userId: leave.user_id,
          employeeName: leave.full_name,
          leaveType: leave.leave_type,
          duration: duration,
          days: leave.days,
          reason: leave.reason,
          status: status
        })
      });
    } catch (e) {
      console.error("Failed to trigger email", e);
    }
  }
};`;

content = content.replace(/export const updateLeaveStatus = async [\s\S]*?if \(error\) throw error;\s*if \(leave\) \{[\s\S]*?\s*\}\s*\};/, replacement);
fs.writeFileSync(file, content);
console.log("Successfully updated lib/leave.ts!");
