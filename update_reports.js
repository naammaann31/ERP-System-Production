const fs = require('fs');
const file = 'app/dashboard/my-team/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add Calendar to imports
if (!content.includes('Calendar')) {
    content = content.replace('Users, MoreVertical, ArrowRight', 'Users, MoreVertical, ArrowRight, Calendar');
}

// 2. Add state
const stateTarget = `const [reports, setReports] = useState<any[]>([]);`;
if (content.includes(stateTarget) && !content.includes('filterDate')) {
    const newState = `const [reports, setReports] = useState<any[]>([]);
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [filterEmployee, setFilterEmployee] = useState<string>("All");`;
    content = content.replace(stateTarget, newState);
}

// 3. Replace the entire Reports view block
const reportsBlockRegex = /<Card className="border-0 shadow-sm ring-1 ring-slate-200\/60 overflow-hidden bg-white">[\s\S]*?<div className="overflow-x-auto">[\s\S]*?<table className="w-full text-sm text-left">[\s\S]*?<\/table>[\s\S]*?<\/div>[\s\S]*?<\/Card>/;

const newReportsBlock = `{(() => {
        const teamReports = reports.filter(r => teamMembers.some(tm => tm.uid === r.user_id));
        const filteredByDate = filterDate ? teamReports.filter(r => r.report_date === filterDate) : teamReports;
        const fullyFiltered = filterEmployee !== "All" ? filteredByDate.filter(r => r.user_id === filterEmployee) : filteredByDate;

        const aggregatedReports = fullyFiltered.reduce((acc: any[], curr) => {
          const key = \`\${curr.user_id}_\${curr.report_date}\`;
          const existing = acc.find(x => x.key === key);
          if (existing) {
            existing.no_of_candidates += Number(curr.no_of_candidates || 0);
            existing.applications += Number(curr.applications || 0);
            existing.rtr_submissions += Number(curr.rtr_submissions || 0);
            existing.screenings += Number(curr.screenings || 0);
            existing.interviews += Number(curr.interviews || 0);
            existing.entries += 1;
          } else {
            acc.push({
              key,
              id: curr.id,
              user_id: curr.user_id,
              user_name: curr.user_name,
              report_date: curr.report_date,
              no_of_candidates: Number(curr.no_of_candidates || 0),
              applications: Number(curr.applications || 0),
              rtr_submissions: Number(curr.rtr_submissions || 0),
              screenings: Number(curr.screenings || 0),
              interviews: Number(curr.interviews || 0),
              entries: 1
            });
          }
          return acc;
        }, []);
        aggregatedReports.sort((a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime());

        return (
        <Card className="border-0 shadow-sm ring-1 ring-slate-200/60 overflow-hidden bg-white">
          <div className="flex flex-col sm:flex-row gap-4 p-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <input 
                type="date" 
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="text-sm bg-white border border-slate-200 rounded-md px-3 py-1.5 outline-none focus:border-blue-500 transition-colors"
              />
              <button 
                onClick={() => setFilterDate('')}
                className="text-xs text-blue-600 hover:underline ml-2"
              >
                Clear Date
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500" />
              <select 
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
                className="text-sm bg-white border border-slate-200 rounded-md px-3 py-1.5 outline-none focus:border-blue-500 transition-colors min-w-[150px]"
              >
                <option value="All">All Team Members</option>
                {teamMembers.map(tm => (
                  <option key={tm.uid} value={tm.uid}>{tm.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] text-slate-500 font-bold uppercase tracking-wider bg-slate-50/80 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4 text-center">Submissions</th>
                  <th className="px-6 py-4 text-center">Candidates</th>
                  <th className="px-6 py-4 text-center">Applications</th>
                  <th className="px-6 py-4 text-center">RTR</th>
                  <th className="px-6 py-4 text-center">Screenings</th>
                  <th className="px-6 py-4 text-center">Interviews</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {aggregatedReports.map((report) => (
                  <tr key={report.key} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium">{report.report_date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-900 font-bold">{report.user_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-blue-600 font-bold bg-blue-50/30">{report.entries}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-slate-700">{report.no_of_candidates}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-slate-700">{report.applications}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-slate-700">{report.rtr_submissions}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-slate-700">{report.screenings}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-slate-700">{report.interviews}</td>
                  </tr>
                ))}
                {aggregatedReports.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                      No reports found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        );
      })}`;

content = content.replace(reportsBlockRegex, newReportsBlock);
fs.writeFileSync(file, content);
console.log('Successfully updated the Daily Reports view!');
