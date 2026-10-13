"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { getTodayAttendance, AttendanceRecord } from "@/lib/attendance";

interface TodayAttendanceContextValue {
  record: AttendanceRecord | null;
  loading: boolean;
  /**
   * Lets LiveAttendanceCard (the only widget that actually performs the
   * check-in/check-out mutations) push its optimistic update here after a
   * successful checkIn()/checkOut() call, so TopStats and WeeklyOverview
   * see the change immediately too, instead of staying stale until the
   * page is reloaded (which is what happened before this provider existed
   * — each widget held its own independent copy with no way to hear about
   * another widget's update).
   */
  setRecord: (record: AttendanceRecord | null) => void;
}

const TodayAttendanceContext = createContext<TodayAttendanceContextValue>({
  record: null,
  loading: true,
  setRecord: () => {},
});

export const useTodayAttendance = () => useContext(TodayAttendanceContext);

/**
 * Single shared fetch of "today's attendance row" for the Dashboard page.
 * TopStats, LiveAttendanceCard, and WeeklyOverview each used to call
 * getTodayAttendance(profile.uid) independently in their own useEffect —
 * three identical queries for the exact same row, on the same page load.
 * This fetches it once and shares the result; each widget still owns its
 * own derived local state/intervals exactly as before (TopStats' 60s tick,
 * LiveAttendanceCard's 1s tick + periodic DB sync, WeeklyOverview's chart
 * snapshot) — only the underlying fetch is shared.
 */
export function TodayAttendanceProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.uid) {
      setRecord(null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    getTodayAttendance(profile.uid).then((rec) => {
      if (!isMounted) return;
      setRecord(rec);
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [profile?.uid]);

  return (
    <TodayAttendanceContext.Provider value={{ record, loading, setRecord }}>
      {children}
    </TodayAttendanceContext.Provider>
  );
}
