const fs = require('fs');
const file = 'components/dashboard/attendance/EmployeeAttendanceDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// Find the dropdown part
const dropdownStart = content.indexOf('<div className="relative w-full md:w-auto" ref={dropdownRef}>');
const dropdownEnd = content.indexOf('</div>', content.indexOf('</Button>', dropdownStart) + 200);

if (dropdownStart > -1 && dropdownEnd > -1) {
    // We actually just want to replace the whole `div.relative` with the input
    // Let's use regex to be safe
    const regex = /<div className="relative w-full md:w-auto" ref=\{dropdownRef\}>[\s\S]*?<\/div>\s*<\/div>/;
    const match = content.match(regex);
    if (match) {
        console.log("Found match, length:", match[0].length);
    } else {
        console.log("Could not match the exact div structure");
    }
}
