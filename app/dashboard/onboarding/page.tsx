"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/AuthProvider";
import { ClipboardCheck, Plus, CheckCircle2, Circle, Search, Users } from "lucide-react";
import {
  OnboardingTask,
  createOnboardingForEmployee,
  toggleOnboardingTask,
  listenToAllOnboarding,
  listenToEmployeeOnboarding,
} from "@/lib/onboarding";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

// --- Employee Onboarding View ---
function EmployeeOnboardingView() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.uid) return;
    setLoading(true);
    const unsubscribe = listenToEmployeeOnboarding(profile.uid, (fetched) => {
      if (fetched.length === 0) {
        createOnboardingForEmployee(profile.uid, profile.fullName);
      } else {
        setTasks(fetched);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [profile]);

  const completed = tasks.filter((t) => t.completed).length;
  const total = tasks.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="max-w-[1400px] mx-auto space-y-5 pb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6 text-emerald-600" />
          My Onboarding
        </h1>
        <p className="text-slate-500 mt-1 text-sm font-medium">Complete these tasks to finish your onboarding.</p>
      </div>

      {total === 0 && !loading ? (
        <div className="text-center py-16 text-slate-400">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-300" />
          <p className="font-semibold">No onboarding tasks</p>
          <p className="text-sm mt-1">Your onboarding checklist hasn't been created yet. Contact HR.</p>
        </div>
      ) : (
        <>
          {/* Progress Card */}
          <Card className="rounded-2xl border-slate-100 shadow-sm overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-800">Progress</h3>
                <span className="text-sm font-black text-slate-900">{pct}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className={`h-3 rounded-full ${pct === 100 ? "bg-emerald-500" : "bg-blue-600"}`}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2 font-medium">{completed} of {total} tasks completed</p>
            </CardContent>
          </Card>

          {/* Tasks */}
          <div className="space-y-2">
            {tasks.map((task, i) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <button
                  onClick={() => toggleOnboardingTask(task.id!, !task.completed)}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                    task.completed
                      ? "bg-emerald-50/50 border-emerald-200 hover:bg-emerald-50"
                      : "bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200"
                  }`}
                >
                  {task.completed ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-slate-300 shrink-0" />
                  )}
                  <span className={`text-sm font-semibold ${task.completed ? "text-emerald-700 line-through" : "text-slate-800"}`}>
                    {task.taskName}
                  </span>
                </button>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// --- HR Onboarding View ---
function HROnboardingView() {
  const { profile } = useAuth();
  const [allTasks, setAllTasks] = useState<OnboardingTask[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const unsub1 = listenToAllOnboarding((tasks) => {
      setAllTasks(tasks);
      setLoading(false);
    });

    // Also listen to employees
    let emps: any[] = [];
    const unsub2 = onSnapshot(collection(db, "users"), (snapshot) => {
      emps = [];
      snapshot.forEach((d) => {
        const data = d.data();
        emps.push({ uid: d.id, name: data.fullName || "Unnamed" });
      });
      setEmployees(emps);
    }, (error) => {
      if (error.code !== 'permission-denied') console.error(error);
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  // Group tasks by employee
  const grouped = useMemo(() => {
    const map: Record<string, { name: string; tasks: OnboardingTask[] }> = {};
    allTasks.forEach((t) => {
      if (!map[t.employeeUid]) {
        map[t.employeeUid] = { name: t.employeeName, tasks: [] };
      }
      map[t.employeeUid].tasks.push(t);
    });
    return Object.entries(map)
      .map(([uid, data]) => ({
        uid,
        name: data.name,
        tasks: data.tasks,
        completed: data.tasks.filter((t) => t.completed).length,
        total: data.tasks.length,
      }))
      .filter((e) => e.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [allTasks, searchQuery]);

  // Find employees without onboarding
  const employeesWithOnboarding = new Set(allTasks.map((t) => t.employeeUid));
  const employeesWithout = employees.filter((e) => !employeesWithOnboarding.has(e.uid));

  const handleCreateOnboarding = async (uid: string, name: string) => {
    await createOnboardingForEmployee(uid, name);
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-5 pb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-emerald-600" />
            Onboarding Management
          </h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">Track and manage employee onboarding progress.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-2xl border-slate-100 shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">In Progress</p>
            <p className="text-3xl font-black text-slate-800">{grouped.filter((e) => e.completed < e.total).length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-100 shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Completed</p>
            <p className="text-3xl font-black text-emerald-600">{grouped.filter((e) => e.completed === e.total && e.total > 0).length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-100 shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Not Started</p>
            <p className="text-3xl font-black text-amber-600">{employeesWithout.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Employees without onboarding */}
      {employeesWithout.length > 0 && (
        <Card className="rounded-2xl border-amber-200 bg-amber-50/30 shadow-sm">
          <CardHeader className="px-5 py-3 border-b border-amber-100">
            <CardTitle className="text-sm font-bold text-amber-800">Employees Without Onboarding</CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="flex flex-wrap gap-2">
              {employeesWithout.slice(0, 10).map((emp) => (
                <button
                  key={emp.uid}
                  onClick={() => handleCreateOnboarding(emp.uid, emp.name)}
                  className="flex items-center gap-1.5 bg-white border border-amber-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
                >
                  <Plus className="h-3 w-3" /> {emp.name}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative w-full md:w-64">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search employees..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />
      </div>

      {/* Employee Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {grouped.map((emp, i) => {
          const pct = emp.total > 0 ? Math.round((emp.completed / emp.total) * 100) : 0;
          const isDone = emp.completed === emp.total;
          return (
            <motion.div
              key={emp.uid}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className={`rounded-2xl shadow-sm overflow-hidden transition-all hover:shadow-md ${isDone ? "border-emerald-200" : "border-slate-100"}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-slate-800 text-sm">{emp.name}</h3>
                    <Badge variant={isDone ? "success" : "warning"} className="font-semibold text-[10px]">
                      {isDone ? "Complete" : `${pct}%`}
                    </Badge>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-3">
                    <div className={`h-2 rounded-full transition-all ${isDone ? "bg-emerald-500" : "bg-blue-600"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="space-y-1.5">
                    {emp.tasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-2 text-xs">
                        {task.completed ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                        )}
                        <span className={`${task.completed ? "text-slate-400 line-through" : "text-slate-700"} font-medium`}>
                          {task.taskName}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// --- Main ---
export default function OnboardingPage() {
  const { profile } = useAuth();
  const isAdminOrHR = profile?.role === "Admin" || profile?.role === "HR" || profile?.role === "OPS_HR";

  return isAdminOrHR ? <HROnboardingView /> : <EmployeeOnboardingView />;
}
