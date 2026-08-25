export default function EmployeesLoading() {
  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-6 p-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse mb-2"></div>
          <div className="h-4 w-72 bg-slate-100 rounded-lg animate-pulse"></div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="h-10 w-full sm:w-64 bg-slate-200 rounded-xl animate-pulse"></div>
          <div className="h-10 w-28 bg-slate-200 rounded-xl animate-pulse"></div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex gap-4">
           {[1,2,3,4,5].map(i => <div key={i} className="h-4 w-24 bg-slate-100 rounded animate-pulse"></div>)}
        </div>
        <div className="divide-y divide-slate-100">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-slate-200 rounded-full animate-pulse"></div>
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-slate-200 rounded animate-pulse"></div>
                  <div className="h-3 w-24 bg-slate-100 rounded animate-pulse"></div>
                </div>
              </div>
              <div className="hidden md:block h-4 w-24 bg-slate-100 rounded animate-pulse"></div>
              <div className="hidden lg:block h-4 w-24 bg-slate-100 rounded animate-pulse"></div>
              <div className="h-8 w-8 bg-slate-100 rounded-full animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}