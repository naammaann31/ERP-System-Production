"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import WelcomeHeader from "@/components/dashboard/WelcomeHeader";
import TopStats from "@/components/dashboard/TopStats";
import LiveAttendanceCard from "@/components/dashboard/LiveAttendanceCard";
import WeeklyOverview from "@/components/dashboard/WeeklyOverview";
import CalendarWidget from "@/components/dashboard/CalendarWidget";
import TodaySchedule from "@/components/dashboard/TodaySchedule";
import TeamStatusWidget from "@/components/dashboard/TeamStatusWidget";
import RecentNotifications from "@/components/dashboard/RecentNotifications";
import { motion, Variants } from "framer-motion";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 50, damping: 15 } }
};

export default function DashboardPage() {
  const { profile } = useAuth();

  return (
    <motion.div
      className="max-w-[1400px] mx-auto space-y-3 pb-2"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* 1. Welcome Header spanning full width */}
      <motion.div variants={itemVariants}>
        <WelcomeHeader />
      </motion.div>

      {/* 2. Top Stats row */}
      <motion.div variants={itemVariants}>
        <TopStats />
      </motion.div>

      {/* 3. Main Dashboard Grid - Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div variants={itemVariants} className="h-full">
          <LiveAttendanceCard />
        </motion.div>
        <motion.div variants={itemVariants} className="h-full">
          <WeeklyOverview />
        </motion.div>
        <motion.div variants={itemVariants} className="h-full">
          <CalendarWidget />
        </motion.div>
      </div>

      {/* 4. Main Dashboard Grid - Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={itemVariants}>
          <TeamStatusWidget />
        </motion.div>
        <motion.div variants={itemVariants}>
          <RecentNotifications />
        </motion.div>
      </div>
    </motion.div>
  );
}
