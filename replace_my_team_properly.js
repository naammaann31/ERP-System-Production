const fs = require('fs');
const file = 'app/dashboard/my-team/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add states and fetchReports logic
content = content.replace(
/const \[loading, setLoading\] = useState\(true\);/,
`const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"directory" | "reports">("directory");
  const [reports, setReports] = useState<any[]>([]);`
);

content = content.replace(
/const channel = supabase/,
`const fetchReports = async () => {
      const { data, error } = await supabase
        .from("marketing_daily_reports")
        .select("*")
        .order("created_at", { ascending: false });
        
      if (!error && data) {
          setReports(data);
      }
    };
    fetchReports();

    const channel = supabase`
);

// 2. Insert Toggle and view rendering condition
const tabUI = `
      {/* View toggle */}
      <div className="flex items-center space-x-2 bg-white p-1 rounded-xl w-fit border border-slate-200">
        <button
          onClick={() => setView("directory")}
          className={\`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all \${
            view === "directory" ? "bg-slate-900 text-white shadow" : "text-slate-500 hover:text-slate-900"
          }\`}
        >
          Team Members
        </button>
        <button
          onClick={() => setView("reports")}
          className={\`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all \${
            view === "reports" ? "bg-slate-900 text-white shadow" : "text-slate-500 hover:text-slate-900"
          }\`}
        >
          Daily Reports
        </button>
      </div>

      {view === "directory" ? (
        <Card className="border-0 shadow-sm ring-1 ring-slate-200/60 overflow-hidden bg-white">
`;

content = content.replace(
/<Card className="border-0 shadow-sm ring-1 ring-slate-200\/60 overflow-hidden bg-white">/,
tabUI
);

// 3. Add closing bracket for directory view and add reports view
const reportView = `
        </Card>
      ) : (
        <Card className="border-0 shadow-sm ring-1 ring-slate-200/60 overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] text-slate-500 font-bold uppercase tracking-wider bg-slate-50/80 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4 text-center">Candidates</th>
                  <th className="px-6 py-4 text-center">Applications</th>
                  <th className="px-6 py-4 text-center">RTR</th>
                  <th className="px-6 py-4 text-center">Screenings</th>
                  <th className="px-6 py-4 text-center">Interviews</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports
                  .filter(r => teamMembers.some(tm => tm.uid === r.user_id))
                  .map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium">{report.report_date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-900 font-bold">{report.user_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-slate-700">{report.no_of_candidates}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-slate-700">{report.applications}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-slate-700">{report.rtr_submissions}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-slate-700">{report.screenings}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-slate-700">{report.interviews}</td>
                  </tr>
                ))}
                {reports.filter(r => teamMembers.some(tm => tm.uid === r.user_id)).length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      No daily reports submitted yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </motion.div>
  );
}`;

content = content.replace(
/<\/Card>\s*<\/motion\.div>\s*\);\s*}/,
reportView
);

fs.writeFileSync(file, content);
console.log('Update my-team complete');
