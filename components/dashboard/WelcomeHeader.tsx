"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, MapPin, ChevronDown } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

export default function WelcomeHeader() {
  const { profile } = useAuth();

  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [timeZone, setTimeZone] = useState("Asia/Kolkata");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  const timeZones = [
    { label: "INDIAN", value: "Asia/Kolkata" },
    { label: "EASTERN", value: "America/New_York" },
    { label: "CENTRAL", value: "America/Chicago" },
    { label: "MOUNTAIN", value: "America/Denver" },
    { label: "PACIFIC", value: "America/Los_Angeles" }
  ];

  const selectedLabel = timeZones.find(tz => tz.value === timeZone)?.label || "INDIAN";

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hourStr = currentTime
    ? currentTime.toLocaleString("en-US", { timeZone, hour: 'numeric', hour12: false })
    : new Date().toLocaleString("en-US", { timeZone, hour: 'numeric', hour12: false });
  const hour = parseInt(hourStr, 10);

  let greeting = "Good evening";
  if (hour < 5 || hour >= 21) greeting = "Good night";
  else if (hour < 12) greeting = "Good morning";
  else if (hour < 17) greeting = "Good afternoon";

  // Dynamic and contextual user data
  const jobRole = profile?.jobRole || profile?.role || "Employee";
  const employeeId = profile?.employeeId || "EMP-2026-419";
  const currentShift = "US Shift (09:00 AM - 06:00 PM EST)";
  const employmentStatus = profile?.designation || "Employee";

  const isMarketing = profile?.department?.toUpperCase() === "MARKETING" || profile?.role?.toUpperCase() === "MARKETING";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-center justify-between border border-slate-100 shadow-sm relative z-10"
    >
      <div className="flex items-center gap-4 z-10">
        <div className="w-14 h-14 rounded-full bg-slate-50 border-2 border-white shadow flex items-center justify-center text-blue-600 text-xl font-bold relative">
          {profile?.fullName?.split(' ').map(n => n[0]).join('').substring(0, 2) || "U"}
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
        </div>

        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
            {greeting}, {profile?.fullName?.split(' ')[0] || "Team Member"}!
          </h1>
          <p className="text-slate-500 font-medium text-xs">
            {jobRole} &middot; {employeeId}
          </p>

        </div>
      </div>

      <div className="flex gap-5 items-center z-10 mt-4 md:mt-0">
        <div className="text-right pr-5 border-r border-slate-200 hidden md:block">
          <div className="flex items-center justify-end gap-2.5 mb-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em]">Current Time</p>
            {isMarketing && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-1.5 bg-white border border-slate-200/80 text-slate-700 text-[10px] font-extrabold uppercase tracking-[0.12em] px-3 py-1.5 rounded-full transition-colors hover:border-blue-300 hover:text-blue-700 focus:outline-none shadow-sm"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                  {selectedLabel}
                  <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute right-0 top-full mt-2 w-44 bg-white/95 backdrop-blur-sm rounded-2xl shadow-[0_8px_32px_-4px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.06)] border border-white/60 overflow-hidden z-50"
                    >
                      <div className="px-3 pt-2.5 pb-1">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em]">Select Timezone</p>
                      </div>
                      <div className="px-1.5 pb-1.5">
                        {timeZones.map((tz) => (
                          <button
                            key={tz.value}
                            onClick={() => { setTimeZone(tz.value); setIsDropdownOpen(false); }}
                            className={`w-full text-left px-2.5 py-2 text-[11px] rounded-xl transition-all duration-150 flex items-center gap-2.5 ${
                              timeZone === tz.value
                                ? 'bg-blue-600 text-white font-bold shadow-sm'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-semibold'
                            }`}
                          >
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              timeZone === tz.value ? 'bg-white/80' : 'bg-slate-300'
                            }`} />
                            {tz.label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
          <p className="text-xl font-bold text-slate-800 tabular-nums">
            {currentTime ? currentTime.toLocaleTimeString("en-US", { timeZone, hour: "2-digit", minute: "2-digit", hour12: true }) : "--:-- --"}
          </p>
          <p className="text-[10px] font-semibold text-slate-500">
            {currentTime ? currentTime.toLocaleDateString("en-US", { timeZone, weekday: "long", month: "short", day: "numeric", year: "numeric" }) : "--"}
          </p>
        </div>

        {/* Beautiful CSS Illustrated Night/Day Graphic */}
        {hour >= 6 && hour < 18 ? (
          <div className="w-48 h-20 rounded-xl overflow-hidden relative shadow-inner bg-gradient-to-br from-sky-400 via-blue-400 to-blue-300">
            {/* Sun */}
            <div className="absolute top-3 right-6 w-6 h-6 bg-yellow-300 rounded-full shadow-[0_0_20px_rgba(253,224,71,0.9)] animate-pulse"></div>
            {/* Clouds */}
            <div className="absolute top-4 left-4 w-8 h-3 bg-white/70 rounded-full"></div>
            <div className="absolute top-3 left-6 w-6 h-6 bg-white/70 rounded-full"></div>
            <div className="absolute top-8 right-16 w-12 h-4 bg-white/60 rounded-full"></div>
            <div className="absolute top-6 right-20 w-5 h-5 bg-white/60 rounded-full"></div>

            {/* Cityscape Silhouette */}
            <div className="absolute bottom-0 left-0 w-full flex items-end opacity-[0.15]">
              <div className="w-1/6 h-5 bg-black rounded-t-sm"></div>
              <div className="w-1/5 h-10 bg-black rounded-t-sm ml-1"></div>
              <div className="w-1/6 h-8 bg-black rounded-t-sm ml-1"></div>
              <div className="w-1/4 h-12 bg-black rounded-t-sm ml-1"></div>
              <div className="w-1/6 h-6 bg-black rounded-t-sm ml-1"></div>
              <div className="w-1/6 h-9 bg-black rounded-t-sm ml-1"></div>
            </div>
          </div>
        ) : (
          <div className="w-48 h-20 rounded-xl overflow-hidden relative shadow-inner bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
            <div className="absolute top-2 right-6 w-4 h-4 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]"></div>
            <div className="absolute top-2 left-4 w-1 h-1 bg-white rounded-full opacity-60"></div>
            <div className="absolute top-5 left-8 w-1 h-1 bg-white rounded-full opacity-80 animate-pulse"></div>
            <div className="absolute top-4 left-16 w-1 h-1 bg-white rounded-full opacity-40"></div>
            <div className="absolute top-6 right-14 w-1 h-1 bg-white rounded-full opacity-50"></div>

            {/* Cityscape Silhouette */}
            <div className="absolute bottom-0 left-0 w-full flex items-end opacity-20">
              <div className="w-1/6 h-5 bg-white rounded-t-sm"></div>
              <div className="w-1/5 h-10 bg-white rounded-t-sm ml-1"></div>
              <div className="w-1/6 h-8 bg-white rounded-t-sm ml-1"></div>
              <div className="w-1/4 h-12 bg-white rounded-t-sm ml-1"></div>
              <div className="w-1/6 h-6 bg-white rounded-t-sm ml-1"></div>
              <div className="w-1/6 h-9 bg-white rounded-t-sm ml-1"></div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
