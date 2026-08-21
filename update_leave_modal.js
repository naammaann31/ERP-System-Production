const fs = require('fs');
const file = 'components/dashboard/leave/ApplyLeaveModal.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('useState("Paid Leave (PL)");', 'useState("Leave");');
content = content.replace('const leaveOptions = ["Paid Leave (PL)", "Casual Leave"];', 'const leaveOptions = ["Leave"];');

fs.writeFileSync(file, content);
console.log('Done');
