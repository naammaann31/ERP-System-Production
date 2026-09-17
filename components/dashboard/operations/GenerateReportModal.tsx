export interface OperationsReportForm {
    noOfCalls: string;
    answeredCalls: string;
    churnedCalls: string;
    leads: string;
    closed: string;
}

export default function GenerateReportModal({
    isOpen,
    onClose,
    profileFullName,
    reportForm,
    setReportForm,
    onSubmit,
    isGenerating,
}: {
    isOpen: boolean;
    onClose: () => void;
    profileFullName: string;
    reportForm: OperationsReportForm;
    setReportForm: (form: OperationsReportForm) => void;
    onSubmit: () => void;
    isGenerating: boolean;
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
                <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/80">
                    <div>
                        <h3 className="font-black text-slate-900 text-lg">Generate Daily Report</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Fill in your daily sales metrics</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Name</label>
                        <input type="text" value={profileFullName || ""} disabled className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 cursor-not-allowed" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">No. of Calls</label>
                            <input type="number" value={reportForm.noOfCalls} onChange={e => setReportForm({...reportForm, noOfCalls: e.target.value})} placeholder="0" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Answered Calls</label>
                            <input type="number" value={reportForm.answeredCalls} onChange={e => setReportForm({...reportForm, answeredCalls: e.target.value})} placeholder="0" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Churned Calls</label>
                            <input type="number" value={reportForm.churnedCalls} onChange={e => setReportForm({...reportForm, churnedCalls: e.target.value})} placeholder="0" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Leads</label>
                            <input type="number" value={reportForm.leads} onChange={e => setReportForm({...reportForm, leads: e.target.value})} placeholder="0" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
                        </div>
                        <div className="space-y-1.5 col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Closed</label>
                            <input type="number" value={reportForm.closed} onChange={e => setReportForm({...reportForm, closed: e.target.value})} placeholder="0" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-100 bg-slate-50/50">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">Cancel</button>
                    <button type="button" onClick={onSubmit} disabled={isGenerating} className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm disabled:opacity-50">{isGenerating ? "Saving..." : "Submit Report"}</button>
                </div>
            </div>
        </div>
    );
}
