const fs = require('fs');
const file = 'components/dashboard/LiveAttendanceCard.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldButton = `<button
            onClick={handleToggleCheckIn}
            disabled={loading || alreadyCheckedOut}
            className={\`w-full flex items-center justify-center gap-2 text-white text-[11px] font-bold py-2.5 rounded-lg transition-all shadow-md active:scale-[0.98] \${
              alreadyCheckedOut 
                ? 'bg-slate-300 cursor-not-allowed text-slate-500 shadow-none'
                : isCheckedIn 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-[#4f46e5] hover:bg-[#4338ca]'
            }\`}
          >`;

const newButton = `<button
            onClick={handleToggleCheckIn}
            disabled={loading || alreadyCheckedOut || isTooLateToClockIn}
            className={\`w-full flex items-center justify-center gap-2 text-white text-[11px] font-bold py-2.5 rounded-lg transition-all shadow-md active:scale-[0.98] \${
              (alreadyCheckedOut || isTooLateToClockIn)
                ? 'bg-slate-300 cursor-not-allowed text-slate-500 shadow-none'
                : isCheckedIn 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-[#4f46e5] hover:bg-[#4338ca]'
            }\`}
          >`;

content = content.replace(oldButton, newButton);
fs.writeFileSync(file, content);
console.log("Updated button in LiveAttendanceCard");
