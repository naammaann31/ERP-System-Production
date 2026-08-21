const fs = require('fs');
const file = 'components/dashboard/leave/HRLeaveDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = 'if (myRole === "HR" && (reqRole === "HR" || reqRole === "ADMIN" || reqRole === "OPS_HR")) {';
const replaceStr = 'if (myRole === "HR" && (reqRole === "HR" || reqRole === "ADMIN")) {';

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replaceStr);
    fs.writeFileSync(file, content);
    console.log("Successfully updated HRLeaveDashboard");
} else {
    console.log("Could not find the target string.");
}
