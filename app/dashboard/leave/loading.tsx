export default function LeaveLoading() {
  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-6 p-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse mb-2"></div>
          <div className="h-4 w-72 bg-slate-100 rounded-lg animate-pulse"></div>
        </div>
        <div className="h-10 w-32 bg-slate-200 rounded-xl animate-pulse"></div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[1,2,3].map(i => (
          <div key={i} className="h-32 bg-white rounded-2xl shadow-sm border border-slate-100 animate-pulse"></div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-h-[400px] animate-pulse"></div>
    </div>
  );
}