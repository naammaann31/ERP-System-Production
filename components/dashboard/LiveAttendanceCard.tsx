"use client";

import { useState, useEffect, useRef } from "react";
import { CheckCircle2, Clock, LogOut, LogIn, Info, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/components/providers/AuthProvider";
import { 
  checkIn, 
  checkOut, 
  getTodayAttendance, 
  updateWorkingSeconds,
  AttendanceRecord 
} from "@/lib/attendance";

export default function LiveAttendanceCard() {
  const { profile } = useAuth();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [workingSeconds, setWorkingSeconds] = useState(0);
  const [attendanceRecord, setAttendanceRecord] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showClockOutConfirm, setShowClockOutConfirm] = useState(false);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setCurrentTime(new Date());

    const loadAttendance = async () => {
      if (profile?.uid) {
        const record = await getTodayAttendance(profile.uid);
        if (record) {
          setAttendanceRecord(record);
          if (record.status === "Checked In") {
            setIsCheckedIn(true);
            
            // Calculate elapsed time since check-in
            let elapsed = 0;
            if (record.checkInTime) {
              const checkInDate = new Date(record.checkInTime);
              elapsed = Math.floor((new Date().getTime() - checkInDate.getTime()) / 1000);
            }
            // We use the elapsed time plus whatever was previously saved, although usually it starts at 0.
            setWorkingSeconds(record.workingSeconds + elapsed);
          } else if (record.status === "Present") {
            // Already checked out for the day
            setIsCheckedIn(false);
            setWorkingSeconds(record.workingSeconds);
          }
        }
      }
      setLoading(false);
    };

    loadAttendance();

    const interval = setInterval(() => {
      setCurrentTime(new Date());
      setIsCheckedIn((prev) => {
        if (prev) {
          setWorkingSeconds((s) => s + 1);
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [profile]);

  // Sync working seconds to Firestore every minute to prevent data loss on unexpected refresh
  useEffect(() => {
    if (isCheckedIn && attendanceRecord?.id) {
      syncIntervalRef.current = setInterval(() => {
        updateWorkingSeconds(attendanceRecord.id!, workingSeconds);
      }, 60000);
    }

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [isCheckedIn, attendanceRecord, workingSeconds]);

  const handleToggleCheckIn = async () => {
    if (!profile?.uid) return;

    if (!isCheckedIn) {
      try {
        const record = await checkIn(profile.uid, profile.fullName || "Unknown User", profile.role);
        setAttendanceRecord(record);
        setIsCheckedIn(true);
      } catch (error) {
        console.error("Error during check in:", error);
      }
    } else {
      setShowClockOutConfirm(true);
    }
  };

  const executeClockOut = async () => {
    try {
      if (attendanceRecord?.id) {
        await checkOut(attendanceRecord.id, workingSeconds);
        setAttendanceRecord({
          ...attendanceRecord,
          status: "Present",
          workingSeconds
        });
      }
      setIsCheckedIn(false);
    } catch (error) {
      console.error("Error during check out:", error);
    } finally {
      setShowClockOutConfirm(false);
    }
  };

  const formatTime = (date: Date | null) => {
    if (!date) return "--:-- --";
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  const renderDuration = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const mins = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    
    return (
      <div className="flex items-center justify-between w-full bg-gradient-to-br from-blue-50 to-indigo-50/50 p-2.5 rounded-xl border border-blue-100/60 shadow-inner mt-1">
        <div className="flex items-baseline">
          <span className="text-2xl font-black text-blue-700 tabular-nums tracking-tighter drop-shadow-sm">{hrs}</span>
          <span className="text-[10px] font-bold text-blue-500 ml-0.5 mr-1.5 uppercase">h</span>
        </div>
        <div className="text-blue-300/80 font-black text-lg animate-pulse mb-0.5">:</div>
        <div className="flex items-baseline">
          <span className="text-2xl font-black text-blue-700 tabular-nums tracking-tighter drop-shadow-sm">{mins}</span>
          <span className="text-[10px] font-bold text-blue-500 ml-0.5 mr-1.5 uppercase">m</span>
        </div>
        <div className="text-blue-300/80 font-black text-lg animate-pulse mb-0.5">:</div>
        <div className="flex items-baseline">
          <span className="text-2xl font-black text-blue-700 tabular-nums tracking-tighter drop-shadow-sm">{secs}</span>
          <span className="text-[10px] font-bold text-blue-500 ml-0.5 uppercase">s</span>
        </div>
      </div>
    );
  };

  const shiftTotalSeconds = 9 * 3600; // 9 hours
  const remainingSeconds = Math.max(0, shiftTotalSeconds - workingSeconds);
  const progressPercentage = Math.min(100, (workingSeconds / shiftTotalSeconds) * 100);

  const alreadyCheckedOut = attendanceRecord?.status === "Present";

  return (
    <>
      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col h-full relative overflow-hidden">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-slate-800 text-sm">Today's Attendance</h3>
        {loading ? (
          <div className="text-xs text-slate-400">Loading...</div>
        ) : isCheckedIn ? (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-white text-slate-500 text-[10px] font-semibold rounded-full border border-slate-200">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Live
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-white text-slate-500 text-[10px] font-semibold rounded-full border border-slate-200">
            <div className={`w-1.5 h-1.5 rounded-full ${alreadyCheckedOut ? 'bg-blue-500' : 'bg-slate-400'}`} />
            {alreadyCheckedOut ? 'Completed' : 'Offline'}
          </div>
        )}
      </div>

      <div className="flex flex-row gap-5 items-center flex-1 w-full pl-2">
        {/* Left Side Large Circular Progress */}
        <div className="flex-shrink-0 relative w-24 h-24 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="transparent" stroke="#f1f5f9" strokeWidth="6" />
            <circle cx="50" cy="50" r="44" fill="transparent" stroke={alreadyCheckedOut ? "#22c55e" : "#4f46e5"} strokeWidth="6" strokeDasharray="276.46" strokeDashoffset={276.46 * (1 - (progressPercentage / 100))} strokeLinecap="round" className="transition-all duration-1000" />
          </svg>
          <div className="absolute flex flex-col items-center justify-center mt-1">
            <Clock className="w-3 h-3 text-slate-800 mb-0.5" />
            <span className="text-xs font-black text-slate-900 tabular-nums leading-tight mb-0.5 whitespace-nowrap">
              {formatTime(currentTime)}
            </span>
            <span className="text-[8px] font-semibold text-slate-500">Clock In</span>
          </div>
        </div>

        {/* Right Side Details */}
        <div className="flex-1 flex flex-col gap-3 w-full justify-center border-l border-slate-100 pl-4">
          <div>
            <p className="text-[10px] font-semibold text-slate-500 mb-0.5">Status</p>
            <p className="text-[10px] font-bold text-blue-600 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full border-[1.5px] ${isCheckedIn ? 'border-green-500' : alreadyCheckedOut ? 'border-blue-500' : 'border-slate-400'} inline-block`}></span> 
              {isCheckedIn ? "Clocked In" : alreadyCheckedOut ? "Clocked Out" : "Awaiting Clock In"}
            </p>
          </div>
          <div className="w-full pr-4">
            <p className="text-[10px] font-semibold text-slate-500 mb-0.5">Working Hours</p>
            {renderDuration(workingSeconds)}
          </div>
          <div className="flex justify-between items-center w-full pr-2">
            <p className="text-[10px] font-semibold text-slate-500">Progress</p>
            <p className="text-[11px] font-bold text-slate-900">{Math.round(progressPercentage)}%</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-4">
        <button
          onClick={handleToggleCheckIn}
          disabled={loading || alreadyCheckedOut}
          className={`w-full flex items-center justify-center gap-2 text-white text-[11px] font-bold py-2.5 rounded-lg transition-all shadow-md active:scale-[0.98] ${
            alreadyCheckedOut 
              ? 'bg-slate-300 cursor-not-allowed text-slate-500 shadow-none'
              : isCheckedIn 
                ? 'bg-[#4f46e5] hover:bg-indigo-700' 
                : 'bg-[#4f46e5] hover:bg-indigo-700'
          }`}
        >
          {alreadyCheckedOut ? (
            <>Shift Completed</>
          ) : isCheckedIn ? (
            <><LogOut className="h-3 w-3" /> Clock Out Now</>
          ) : (
            <><span>&rarr;</span> Clock In Now</>
          )}
        </button>
        <button className="w-full flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-[10px] font-semibold py-2 rounded-lg transition-colors">
          <Info className="h-3 w-3 text-slate-400" /> View Details
        </button>
      </div>
      </div>
      
      <AnimatePresence>
        {showClockOutConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-[24px] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100"
            >
              <div className="bg-slate-50/50 px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-800 tracking-tight">Clock Out</h2>
                  <p className="text-xs font-semibold text-slate-500 mt-1">Confirm your request to finish the shift</p>
                </div>
                <button onClick={() => setShowClockOutConfirm(false)} className="p-2 rounded-full hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                <p className="text-sm font-semibold text-slate-600 mb-6">
                  Are you sure you want to clock out for the day? This action will complete your current shift.
                </p>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowClockOutConfirm(false)} className="rounded-xl border border-slate-200 font-bold hover:bg-slate-50 px-6 py-2.5 text-slate-600 text-sm transition-colors">
                    Cancel
                  </button>
                  <button type="button" onClick={executeClockOut} className="rounded-xl bg-slate-900 hover:bg-black font-bold px-6 py-2.5 shadow-md shadow-slate-900/20 active:scale-95 transition-all text-white text-sm">
                    Clock Out
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
