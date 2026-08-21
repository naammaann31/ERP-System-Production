const fs = require('fs');
const file = 'components/dashboard/leave/ApplyLeaveModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const startStr = '          <div>\r\n            <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">Leave Type</label>';
const endStr = '              )}\r\n            </div>\r\n          </div>';

// Try with \r\n
let startIdx = content.indexOf(startStr);
let endIdx = content.indexOf(endStr, startIdx);

if (startIdx === -1) {
    // Try with \n
    const startStrLF = startStr.replace(/\r\n/g, '\n');
    const endStrLF = endStr.replace(/\r\n/g, '\n');
    startIdx = content.indexOf(startStrLF);
    endIdx = content.indexOf(endStrLF, startIdx);
    
    if (startIdx !== -1) {
        content = content.substring(0, startIdx) + content.substring(endIdx + endStrLF.length);
        console.log("Replaced using LF");
    } else {
        console.log("Could not find start index");
    }
} else {
    content = content.substring(0, startIdx) + content.substring(endIdx + endStr.length);
    console.log("Replaced using CRLF");
}

fs.writeFileSync(file, content);
