import { Loader2 } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <div className="relative">
        <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
        <Loader2 className="h-10 w-10 text-blue-600 animate-spin relative z-10" />
      </div>
      <p className="text-slate-500 font-medium animate-pulse text-sm tracking-wide">Loading workspace...</p>
    </div>
  );
}