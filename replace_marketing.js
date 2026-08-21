const fs = require('fs');
const file = 'components/dashboard/MarketingClient.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add GenerateReportModal component
const modalCode = `
function GenerateReportModal({ isOpen, onClose, profile }: { isOpen: boolean, onClose: () => void, profile: any }) {
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ candidates: 0, applications: 0, screenings: 0, interviews: 0 });
    const [rtr, setRtr] = useState("");

    useEffect(() => {
        if (!isOpen || !profile) return;
        const fetchStats = async () => {
            const supabase = createClient();
            const today = new Date().toISOString().split("T")[0];
            
            // Applications (Leads added today)
            const { count: applications } = await supabase
                .from("marketing")
                .select("*", { count: "exact", head: true })
                .eq("created_by", profile.uid)
                .eq("date", today);
            
            // Interviews/Screenings
            const { data: isData } = await supabase
                .from("interview_screening")
                .select("stage")
                .eq("created_by", profile.uid)
                .eq("date", today);
                
            let screenings = 0;
            let interviews = 0;
            if (isData) {
                isData.forEach(r => {
                    const stage = r.stage || "";
                    if (stage.toLowerCase().includes("screening") || stage.toLowerCase().includes("ai")) {
                        screenings++;
                    } else {
                        interviews++;
                    }
                });
            }

            setStats({
                candidates: (applications || 0) + screenings + interviews, // Fallback logic
                applications: applications || 0,
                screenings,
                interviews
            });
        };
        fetchStats();
    }, [isOpen, profile]);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        try {
            setLoading(true);
            const supabase = createClient();
            const today = new Date().toISOString().split("T")[0];
            
            const { error } = await supabase.from("marketing_daily_reports").insert({
                user_id: profile.uid,
                user_name: profile.fullName || "Unknown",
                report_date: today,
                no_of_candidates: stats.candidates,
                applications: stats.applications,
                rtr_submissions: parseInt(rtr) || 0,
                screenings: stats.screenings,
                interviews: stats.interviews
            });
            
            if (error) throw error;
            toast.success("Daily report sent to Team Lead successfully!");
            onClose();
        } catch (error: any) {
            toast.error(error.message || "Failed to submit report");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-700">
                <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white tracking-tight">Generate Daily Report</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-xl transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-6 space-y-4">
                    <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                        <table className="w-full text-sm text-left text-slate-300">
                            <tbody>
                                <tr className="border-b border-slate-700">
                                    <td className="px-4 py-3 font-medium text-slate-400">Name</td>
                                    <td className="px-4 py-3 text-white font-semibold">{profile?.fullName}</td>
                                </tr>
                                <tr className="border-b border-slate-700">
                                    <td className="px-4 py-3 font-medium text-slate-400">No of Candidates</td>
                                    <td className="px-4 py-3 text-white">{stats.candidates}</td>
                                </tr>
                                <tr className="border-b border-slate-700">
                                    <td className="px-4 py-3 font-medium text-slate-400">Applications</td>
                                    <td className="px-4 py-3 text-white">{stats.applications}</td>
                                </tr>
                                <tr className="border-b border-slate-700 bg-slate-800/50">
                                    <td className="px-4 py-3 font-medium text-slate-400">RTR Submissions</td>
                                    <td className="px-4 py-3">
                                        <input 
                                            type="number" 
                                            value={rtr}
                                            onChange={e => setRtr(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="Enter number..."
                                        />
                                    </td>
                                </tr>
                                <tr className="border-b border-slate-700">
                                    <td className="px-4 py-3 font-medium text-slate-400">Screenings</td>
                                    <td className="px-4 py-3 text-white">{stats.screenings}</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 font-medium text-slate-400">Interviews</td>
                                    <td className="px-4 py-3 text-white">{stats.interviews}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div className="px-6 py-4 border-t border-slate-800 bg-slate-900 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-300 hover:text-white transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSubmit} disabled={loading} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50">
                        {loading ? "Sending..." : "Submit to Team Lead"}
                    </button>
                </div>
            </div>
        </div>
    );
}
`;

content = content.replace(
/export default function MarketingClient/g,
modalCode + '\nexport default function MarketingClient'
);

// 2. Add State for modal
content = content.replace(
/const \[savingRow, setSavingRow\] = useState\(false\);/,
`const [savingRow, setSavingRow] = useState(false);
    const [reportModalOpen, setReportModalOpen] = useState(false);`
);

// 3. Add button in UI
content = content.replace(
/<button\s+onClick=\{handleExport\}\s+className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-sm font-bold transition-all shadow-sm"/,
`<button
                            onClick={() => setReportModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-xl text-sm font-bold transition-all shadow-sm border border-purple-200"
                        >
                            <TableIcon className="w-4 h-4" />
                            Generate Report
                        </button>
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-sm font-bold transition-all shadow-sm border border-emerald-200"`
);

// 4. Add Modal to return
content = content.replace(
/\{importSummary && \([\s\S]*?\}\)/,
`{importSummary && (
                <ConfirmModal
                    isOpen={!!importSummary}
                    title="Import Complete"
                    message={importSummary}
                    confirmText="OK"
                    cancelText=""
                    onConfirm={() => setImportSummary(null)}
                    onCancel={() => setImportSummary(null)}
                />
            )}
            <GenerateReportModal isOpen={reportModalOpen} onClose={() => setReportModalOpen(false)} profile={profile} />`
);

fs.writeFileSync(file, content);
console.log('Update MarketingClient complete');
