"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Clock, MapPin } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

export default function WelcomeHeader() {
  const { profile } = useAuth();
  
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hour = currentTime ? currentTime.getHours() : new Date().getHours();
  let greeting = "Good evening";
  if (hour < 5 || hour >= 21) greeting = "Good night";
  else if (hour < 12) greeting = "Good morning";
  else if (hour < 17) greeting = "Good afternoon";

  // Dynamic and contextual user data
  const jobRole = profile?.jobRole || profile?.role || "Employee";
  const employeeId = profile?.employeeId || "EMP-2026-419";
  const currentShift = "US Shift (09:00 AM - 06:00 PM EST)";
  const employmentStatus = profile?.designation || "Employee";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-center justify-between border border-slate-100 shadow-sm relative overflow-hidden"
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
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Current Time</p>
          <p className="text-xl font-bold text-slate-800 tabular-nums">
            {currentTime ? currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : "--:-- --"}
          </p>
          <p className="text-[10px] font-semibold text-slate-500">
            {currentTime ? currentTime.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" }) : "--"}
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
