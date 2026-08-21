const fs = require('fs');
const file = 'components/dashboard/leave/ApplyLeaveModal.tsx';
let content = fs.readFileSync(file, 'utf8');

// Remove isDropdownOpen state
content = content.replace(/const \[isDropdownOpen, setIsDropdownOpen\] = useState\(false\);\n\s*/, '');
// Remove leaveOptions
content = content.replace(/const leaveOptions = \["Leave"\];\n\s*/, '');

// Remove the dropdown block from the JSX
const dropdownBlockRegex = /<div>\s*<label className="block text-\[11px\] uppercase tracking-wider font-bold text-slate-500 mb-1\.5">Leave Type<\/label>[\s\S]*?<\/div>\s*<\/div>\n\s*/;

content = content.replace(dropdownBlockRegex, '');

fs.writeFileSync(file, content);
console.log('Removed dropdown');
