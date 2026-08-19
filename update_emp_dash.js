const fs = require('fs');
const file = 'components/dashboard/attendance/EmployeeAttendanceDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add getLocalDateString import
content = content.replace(
  'getISTYearMonth,',
  'getISTYearMonth,\n  getLocalDateString,'
);

// 2. Replace state definitions
const oldState = `  const months = useMemo(() => getRecentMonthOptions(12), []);
  const [selectedMonth, setSelectedMonth] = useState(getISTYearMonth);
  const selectedMonthLabel =
    months.find((m) => m.value === selectedMonth)?.label ?? selectedMonth;
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);`;
  
const newState = `  const [selectedDate, setSelectedDate] = useState(getLocalDateString);`;

content = content.replace(oldState, newState);

// 3. Replace data fetching logic
const oldFetch = `  // Fetch month's attendance
  useEffect(() => {
    if (!profile?.uid) return;
    setLoading(true);
    getUserAttendanceForMonth(profile.uid, selectedMonth).then((data) => {
      setRecords(data);
      setLoading(false);
    });
  }, [profile, selectedMonth]);`;

const newFetch = `  // Fetch day's attendance
  useEffect(() => {
    if (!profile?.uid) return;
    setLoading(true);
    const yearMonth = selectedDate.substring(0, 7);
    getUserAttendanceForMonth(profile.uid, yearMonth).then((data) => {
      setRecords(data.filter(r => r.date === selectedDate));
      setLoading(false);
    });
  }, [profile, selectedDate]);`;

content = content.replace(oldFetch, newFetch);

// 4. Remove handleClickOutside
const oldHandleClick = `  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsMonthDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);`;
  
content = content.replace(oldHandleClick, '');

// 5. Replace dropdown UI with input type date
const oldUI = `          <div className="flex flex-col md:flex-row w-full md:w-auto items-stretch md:items-center gap-3">
            <div className="relative w-full md:w-auto" ref={dropdownRef}>
              <Button
                variant="outline"
                onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
                className="w-full bg-white text-slate-700 rounded-xl shadow-sm hover:bg-slate-50 hover:text-slate-900 border-slate-200"
              >
                <CalendarDays className="h-4 w-4 mr-2 text-slate-500" />
                {selectedMonthLabel}
                <ChevronDown className={\`h-4 w-4 ml-2 text-slate-400 transition-transform \${isMonthDropdownOpen ? 'rotate-180' : ''}\`} />
              </Button>

              {isMonthDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-xl shadow-lg shadow-slate-200/50 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-200">
                  {months.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => {
                        setSelectedMonth(m.value);
                        setIsMonthDropdownOpen(false);
                      }}
                      className={\`w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 transition-colors \${selectedMonth === m.value ? "text-blue-600 bg-blue-50/50" : "text-slate-600"}\`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>`;

const newUI = `          <div className="flex flex-col md:flex-row w-full md:w-auto items-stretch md:items-center gap-3">
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full md:w-auto bg-white flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-800 font-medium ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />`;

content = content.replace(oldUI, newUI);

fs.writeFileSync(file, content);
console.log("Updated EmployeeAttendanceDashboard UI and fetching logic");
