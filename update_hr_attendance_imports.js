const fs = require('fs');
const file = 'components/dashboard/attendance/HRAttendanceDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import { toast } from "sonner";')) {
  content = content.replace('import { Badge } from "@/components/ui/badge";', 'import { Badge } from "@/components/ui/badge";\nimport { toast } from "sonner";');
  fs.writeFileSync(file, content);
  console.log("Added toast import");
}
