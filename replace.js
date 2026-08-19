const fs = require('fs');
const file = 'components/dashboard/attendance/EmployeeAttendanceDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove getRecentMonthOptions from imports
content = content.replace('  getRecentMonthOptions,\n', '');

// 2. Remove states and refs
const statesRegex = /  const months = useMemo\(\(\) => getRecentMonthOptions\(12\), \[\]\);\n  const \[selectedMonth, setSelectedMonth\] = useState\(getISTYearMonth\);\n  const selectedMonthLabel =\n    months.find\(\(m\) => m.value === selectedMonth\)\?.label \?\? selectedMonth;\n  const \[isMonthDropdownOpen, setIsMonthDropdownOpen\] = useState\(false\);\n  const dropdownRef = useRef<HTMLDivElement>\(null\);/;
content = content.replace(statesRegex, '  const [selectedMonth, setSelectedMonth] = useState(getISTYearMonth);');

// 3. Remove handleClickOutside
const useEffectRegex = /  \/\/ Close dropdown when clicking outside\n  useEffect\(\(\) => \{\n    const handleClickOutside = \(event: MouseEvent\) => \{\n      if \(dropdownRef.current && !dropdownRef.current.contains\(event.target as Node\)\) \{\n        setIsMonthDropdownOpen\(false\);\n      \}\n    \};\n    document.addEventListener\("mousedown", handleClickOutside\);\n    return \(\) => document.removeEventListener\("mousedown", handleClickOutside\);\n  \}, \[\]\);\n\n/;
content = content.replace(useEffectRegex, '');

// 4. Replace Dropdown with Input
const dropdownRegex = /<div className="relative w-full md:w-auto" ref=\{dropdownRef\}>[\s\S]*?<\/div>\s*<Button className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500\/20">/;
const newDropdown = `<input 
            type="month" 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full md:w-auto bg-white flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-800 font-medium ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <Button className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20">`;
content = content.replace(dropdownRegex, newDropdown);

// 5. Remove Badges
const badgeRegex = /<div className=\{`flex items-center gap-1 text-\[9px\] font-bold px-2 py-0.5 rounded-full border shadow-sm transition-colors duration-300 \$\{stat.trendUp \? 'bg-green-50 text-green-700 border-green-200 group-hover:bg-green-100' : 'bg-red-50 text-red-700 border-red-200 group-hover:bg-red-100'\}\`\}>\s*\{stat.trend\}\s*<\/div>/g;
content = content.replace(badgeRegex, '');

fs.writeFileSync(file, content);
console.log("File updated via Node script");
