"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/providers/AuthProvider";
import { Activity, UserPlus, UserMinus, CheckCircle2, XCircle, Wallet, Search, Filter } from "lucide-react";
import { AuditLogEntry, listenToAuditLogs } from "@/lib/audit";

const getActionIcon = (action: string) => {
  if (action.includes("Added") || action.includes("Created")) return { icon: UserPlus, color: "text-emerald-600", bg: "bg-emerald-100" };
  if (action.includes("Deleted") || action.includes("Removed")) return { icon: UserMinus, color: "text-red-600", bg: "bg-red-100" };
  if (action.includes("Approved")) return { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-100" };
  if (action.includes("Rejected")) return { icon: XCircle, color: "text-red-600", bg: "bg-red-100" };
  if (action.includes("Payroll") || action.includes("Salary")) return { icon: Wallet, color: "text-purple-600", bg: "bg-purple-100" };
  return { icon: Activity, color: "text-blue-600", bg: "bg-blue-100" };
};

const formatTime = (ts: any) => {
  if (!ts || !ts.toDate) return "";
  const date = ts.toDate();
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const formatFullDate = (ts: any) => {
  if (!ts || !ts.toDate) return "";
  return ts.toDate().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export default function ActivityPage() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setLoading(true);
    const unsubscribe = listenToAuditLogs((fetched) => {
      setLogs(fetched);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const actionTypes = ["All", ...Array.from(new Set(logs.map((l) => l.action)))];

  const filteredLogs = logs.filter((l) => {
    const matchesAction = filterAction === "All" || l.action === filterAction;
    const matchesSearch =
      l.actorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.target.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.action.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesAction && matchesSearch;
  });

  return (
    <div className="max-w-[1400px] mx-auto space-y-5 pb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-600" />
            Activity Log
          </h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">Track all HR actions and system events.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-56">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search activity..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {actionTypes.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <svg className="animate-spin h-6 w-6 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Activity className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <p className="font-semibold">No activity recorded yet</p>
          <p className="text-sm mt-1">Actions will appear here as they happen.</p>
        </div>
      ) : (
        <Card className="rounded-2xl border-slate-100 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {filteredLogs.map((log, i) => {
                const { icon: ActionIcon, color, bg } = getActionIcon(log.action);
                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors group"
                  >
                    <div className={`p-2 rounded-xl ${bg} ${color} shrink-0 mt-0.5`}>
                      <ActionIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800">
                        <span className="font-bold">{log.actorName}</span>{" "}
                        <span className="text-slate-500 font-medium">{log.action}</span>{" "}
                        <span className="font-semibold text-slate-700">{log.target}</span>
                      </p>
                      {log.details && (
                        <p className="text-xs text-slate-400 mt-0.5 font-medium">{log.details}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-semibold text-slate-400">{formatTime(log.createdAt)}</p>
                      <p className="text-[9px] text-slate-300 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">{formatFullDate(log.createdAt)}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
