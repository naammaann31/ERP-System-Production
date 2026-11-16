"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { getTodayAttendance } from "@/lib/attendance";
import { toast } from "sonner";

interface GenerateSalesReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * EOD report is scoped to one specific attendance record (the employee's
 * current or most-recently-closed shift, via getTodayAttendance - same
 * selection logic as before), but now reads from sales_lead_status_history
 * filtered by status_updated_attendance_id, instead of live-querying
 * sales_leads by a status_updated_at timestamp range.
 *
 * Why this matters: the attendance_id was captured PERMANENTLY on each
 * history row at the moment the status changed (see migration 45's
 * resolve_sales_status_work_context()) - a later correction to this
 * attendance record's clock-in/clock-out time can no longer silently move a
 * status change in or out of "this shift" the way a live timestamp-range
 * query could.
 *
 * Same final-state-per-lead-per-shift snapshot semantics as before: if a
 * lead's status changed more than once during this shift, it's counted
 * once, under whichever status it reached LAST during this shift - never
 * once per transition.
 */
export default function GenerateSalesReportModal({ isOpen, onClose }: GenerateSalesReportModalProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [attendance, setAttendance] = useState<any>(null);
  const [stats, setStats] = useState({
    totalCalls: 0,
    newCalls: 0,
    churnedCalls: 0,
    followUpRequested: 0,
    interested: 0,
    notInterested: 0,
    meetingScheduled: 0,
    closed: 0,
    deadLead: 0,
  });
  const [linkedinRequestsSent, setLinkedinRequestsSent] = useState<number>(0);

  useEffect(() => {
    if (!isOpen || !profile?.uid) return;
    const load = async () => {
      setLoading(true);
      const record = await getTodayAttendance(profile.uid);
      setAttendance(record);
      if (!record?.id) {
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const { data, error } = await supabase
        .from("sales_lead_status_history")
        .select("lead_id, new_status, changed_at")
        .eq("attendance_id", record.id)
        .order("changed_at", { ascending: true });

      if (error) {
        toast.error("Failed to load report data: " + error.message);
        setLoading(false);
        return;
      }

      // Final status reached per lead DURING THIS SHIFT - last write per
      // lead_id wins, since rows are ordered by changed_at ascending.
      const finalStatusByLead = new Map<string, string>();
      for (const row of data || []) {
        finalStatusByLead.set(row.lead_id, row.new_status);
      }
      const statuses = Array.from(finalStatusByLead.values());

      setStats({
        totalCalls: statuses.length,
        newCalls: statuses.filter((s) => s === "Attempt 1").length,
        churnedCalls: statuses.filter((s) => s === "Attempt 2" || s === "Attempt 3").length,
        followUpRequested: statuses.filter((s) => s === "Follow up requested").length,
        interested: statuses.filter((s) => s === "Interested").length,
        notInterested: statuses.filter((s) => s === "Not interested").length,
        meetingScheduled: statuses.filter((s) => s === "Meeting scheduled").length,
        closed: statuses.filter((s) => s === "Closed").length,
        deadLead: statuses.filter((s) => s === "Dead Lead").length,
      });
      setLoading(false);
    };
    load();
  }, [isOpen, profile?.uid]);

  const handleSubmit = async () => {
    if (!profile?.uid || !attendance) return;
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("sales_daily_reports").insert({
      user_id: profile.uid,
      user_name: profile.fullName,
      report_date: attendance.date,
      attendance_id: attendance.id || null,
      total_calls: stats.totalCalls,
      new_calls: stats.newCalls,
      churned_calls: stats.churnedCalls,
      follow_up_requested: stats.followUpRequested,
      interested: stats.interested,
      not_interested: stats.notInterested,
      meeting_scheduled: stats.meetingScheduled,
      closed: stats.closed,
      dead_lead: stats.deadLead,
      linkedin_requests_sent: linkedinRequestsSent || 0,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Failed to submit report: " + error.message);
      return;
    }
    toast.success("Report submitted");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Generate EOD Report</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-400">Loading...</div>
        ) : !attendance ? (
          <div className="py-8 text-center text-slate-500 text-sm">
            No active or recently-closed shift found for you today. Clock in first, work your leads, then generate the report.
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500">
              Report for <span className="font-medium text-slate-700">{attendance.date}</span> — covering every status change you made during this shift
              {attendance.checkOutTime ? "" : " (still checked in)"}.
            </p>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Total Calls" value={stats.totalCalls} />
              <Stat label="New Calls (Attempt 1)" value={stats.newCalls} />
              <Stat label="Churned Calls (Attempt 2/3)" value={stats.churnedCalls} />
              <Stat label="Follow Up Requested" value={stats.followUpRequested} />
              <Stat label="Interested" value={stats.interested} />
              <Stat label="Not Interested" value={stats.notInterested} />
              <Stat label="Meeting Scheduled" value={stats.meetingScheduled} />
              <Stat label="Closed" value={stats.closed} />
              <Stat label="Dead Lead" value={stats.deadLead} />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">LinkedIn Connection Requests Sent</label>
              <input
                type="number"
                min={0}
                value={linkedinRequestsSent}
                onChange={(e) => setLinkedinRequestsSent(Number(e.target.value))}
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Report"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-bold text-slate-800">{value}</div>
    </div>
  );
}
