const fs = require('fs');
const file = 'components/dashboard/attendance/EmployeeAttendanceDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove state and refs related to the custom dropdown
content = content.replace(/const months = useMemo\(\(\) => getRecentMonthOptions\(12\), \[\]\);\s*/, '');
content = content.replace(/const selectedMonthLabel =[\s\S]*?months\.find[\s\S]*?\?\s*\.label \?\? selectedMonth;\s*/, '');
content = content.replace(/const \[isMonthDropdownOpen, setIsMonthDropdownOpen\] = useState\(false\);\s*/, '');
content = content.replace(/const dropdownRef = useRef<HTMLDivElement>\(null\);\s*/, '');

// 2. Remove handleClickOutside useEffect
const useEffectRegex = /  \/\/ Close dropdown when clicking outside\s*useEffect\(\(\) => \{[\s\S]*?return \(\) => document\.removeEventListener\("mousedown", handleClickOutside\);\s*\}, \[\]\);\s*/;
content = content.replace(useEffectRegex, '');

// 3. Replace the actual dropdown in JSX
const dropdownJsxRegex = /<div className="relative w-full md:w-auto" ref=\{dropdownRef\}>[\s\S]*?<\/div>\s*<\/div>/;
const newDropdown = `<input 
            type="month" 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full md:w-auto bg-white flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-800 font-medium ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />`;

content = content.replace(dropdownJsxRegex, newDropdown);

fs.writeFileSync(file, content);
console.log("Updated EmployeeAttendanceDashboard dropdown to match HR and Admin");
