const fs = require('fs');
const file = 'components/dashboard/attendance/EmployeeAttendanceDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// The file still contains `const months = useMemo(() => getRecentMonthOptions(12), []);`
// Let's replace the whole Component body up to `const [records, setRecords] = useState<AttendanceRecord[]>([]);`
const regexState = /const months = useMemo\(\(\) => getRecentMonthOptions\(12\), \[\]\);[\s\S]*?const \[records, setRecords\] = useState<AttendanceRecord\[\]>\(\[\]\);/;
const newState = `const [selectedDate, setSelectedDate] = useState(getLocalDateString);

  const [records, setRecords] = useState<AttendanceRecord[]>([]);`;
content = content.replace(regexState, newState);

// The fetch logic
const regexFetch = /\/\/ Fetch month's attendance[\s\S]*?\}, \[profile, selectedMonth\]\);/;
const newFetch = `// Fetch day's attendance
  useEffect(() => {
    if (!profile?.uid) return;
    setLoading(true);
    const yearMonth = selectedDate.substring(0, 7);
    getUserAttendanceForMonth(profile.uid, yearMonth).then((data) => {
      setRecords(data.filter(r => r.date === selectedDate));
      setLoading(false);
    });
  }, [profile, selectedDate]);`;
content = content.replace(regexFetch, newFetch);

// The handle click outside
const regexHandleClick = /\/\/ Close dropdown when clicking outside[\s\S]*?\}, \[\]\);/;
content = content.replace(regexHandleClick, '');

// The UI
const regexUI = /<div className="relative w-full md:w-auto" ref=\{dropdownRef\}>[\s\S]*?<\/div>/;
const newUI = `<input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full md:w-auto bg-white flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-800 font-medium ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />`;
content = content.replace(regexUI, newUI);

// The excel file
content = content.replace('My_Attendance_${selectedMonth}.xlsx', 'My_Attendance_${selectedDate}.xlsx');

// Ensure getLocalDateString is only imported once
content = content.replace(/getLocalDateString,\s*getLocalDateString,/g, 'getLocalDateString,');

fs.writeFileSync(file, content);
console.log("Updated via Regex");
