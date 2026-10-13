"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { getLocalDateString } from "@/lib/attendance";
import { useRouter } from "next/navigation";
import {
  fetchAllProfilesForDashboard,
  fetchProfilesByRoleForDashboard,
  fetchTodayAttendanceForDashboard,
} from "@/lib/dashboardQueries";

type TeamMember = {
  id: string;
  name: string;
  role: string;
  status: string;
  label?: string;
  isMe?: boolean;
  avatarUrl?: string;
  avatarThumbUrl?: string;
};

export default function TeamStatusWidget() {
  const { profile } = useAuth();
  const router = useRouter();
  const isAdmin = profile?.role === "Admin";
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const todayDate = getLocalDateString();

  // Admin sees every employee — shares the exact same cache entry as
  // TopStats' own counts query (see lib/dashboardQueries.ts for why that's
  // safe: both were independently fetching essentially this same data at
  // once). HR/regular employees see only their own role/department, same
  // as before — a separately-scoped query, never shared with anything,
  // since broadening it would mean downloading the whole company's
  // profiles just to show a same-department list.
  const { data: allProfilesData } = useQuery({
    queryKey: ["dashboard", "profiles", "all"],
    queryFn: fetchAllProfilesForDashboard,
    enabled: !!profile?.role && isAdmin,
  });
  const { data: roleProfilesData } = useQuery({
    queryKey: ["dashboard", "profiles", "role", profile?.role],
    queryFn: () => fetchProfilesByRoleForDashboard(profile!.role!),
    enabled: !!profile?.role && !isAdmin,
  });
  // Safe to share across every viewer role — this query was never
  // filtered by role to begin with (unlike the profiles one above).
  const { data: todayAttendanceRows } = useQuery({
    queryKey: ["dashboard", "attendance", "today", todayDate],
    queryFn: () => fetchTodayAttendanceForDashboard(todayDate),
    enabled: !!profile?.role,
  });

  // React Query's cache is the source of truth for the INITIAL fetch only.
  // Realtime patches below mutate these local refs directly, exactly as
  // before this migration — a live update doesn't get written back
  // through the shared cache, it just keeps updating this component's own
  // copy the same way it always did.
  const usersDataRef = useRef<any[]>([]);
  const attendanceDataRef = useRef<Record<string, string>>({});

  const updateTeam = () => {
    const members: TeamMember[] = [];
    usersDataRef.current.forEach((row: any) => {
      const isMe = row.id === profile?.uid;
      const attStatus = attendanceDataRef.current[row.id];

      let finalStatus = "offline";
      if (attStatus === "Checked In" || attStatus === "Present") {
        finalStatus = "online";
      } else if (row.status === "Active" || !row.status) {
        finalStatus = "online";
      }

      members.push({
        id: row.id,
        name: row.full_name || "Unknown",
        role: row.job_role || row.role || "Employee",
        status: finalStatus,
        label: row.status === "On Leave" ? "On Leave" : undefined,
        isMe,
        avatarUrl: row.avatar_url,
        avatarThumbUrl: row.avatar_thumb_url,
      });
    });

    // Sort so the logged-in user is at the top, then alphabetically
    members.sort((a, b) => {
      if (a.isMe) return -1;
      if (b.isMe) return 1;
      return a.name.localeCompare(b.name);
    });

    setTeam(members);
    setLoading(false);
  };

  // Seed the local copy from whichever profiles query applies.
  useEffect(() => {
    const sourceData = isAdmin ? allProfilesData : roleProfilesData;
    if (!sourceData) return;
    usersDataRef.current = sourceData;
    updateTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, allProfilesData, roleProfilesData]);

  // Seed the local copy of today's attendance.
  useEffect(() => {
    if (!todayAttendanceRows) return;
    const newAtt: Record<string, string> = {};
    todayAttendanceRows.forEach((row) => {
      newAtt[row.user_id] = row.status;
    });
    attendanceDataRef.current = newAtt;
    updateTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayAttendanceRows]);

  // Realtime: patches the same local refs the two effects above seed —
  // unchanged from before this migration, only the initial fetch moved to
  // a shared cache.
  useEffect(() => {
    if (!profile?.role) {
      setLoading(false);
      return;
    }

    const supabase = createClient();

    const usersChannel = supabase
      .channel(`team_status_profiles`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (payload) => {
        if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
          const newRow = payload.new as any;
          const isEligible = isAdmin || newRow.role === profile.role;
          const index = usersDataRef.current.findIndex((u: any) => u.id === newRow.id);
          if (index !== -1) {
            if (isEligible) {
              // Still eligible — merge the update
              usersDataRef.current[index] = { ...usersDataRef.current[index], ...newRow };
            } else {
              // Bug #1 fix: role changed, no longer eligible — remove immediately
              usersDataRef.current = usersDataRef.current.filter((u: any) => u.id !== newRow.id);
            }
          } else if (isEligible) {
            // New user and eligible — add them
            usersDataRef.current = [...usersDataRef.current, newRow];
          }
        } else if (payload.eventType === "DELETE") {
          usersDataRef.current = usersDataRef.current.filter((u: any) => u.id !== (payload.old as any).id);
        }
        updateTeam();
      })
      .subscribe();

    const attChannel = supabase
      .channel(`team_status_attendance`)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, (payload) => {
        if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
          const newRow = payload.new as any;
          if (newRow.date === todayDate) {
            attendanceDataRef.current[newRow.user_id] = newRow.status;
          }
        } else if (payload.eventType === "DELETE") {
          // Bug #2 fix: attendance row deleted — clear local status immediately
          const deletedUserId = (payload.old as any).user_id;
          if (deletedUserId) {
            delete attendanceDataRef.current[deletedUserId];
          }
        }
        updateTeam();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(usersChannel);
      supabase.removeChannel(attChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.uid, profile?.role, isAdmin]);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-500" />
            {profile?.role === "Admin" ? "Company Directory" : "Team Status"}
          </CardTitle>
          <span className="text-xs font-semibold text-slate-500">{team.length} Members</span>
        </div>
      </CardHeader>
      <CardContent className="max-h-[420px] overflow-y-auto custom-scrollbar">
        {team.length > 0 ? (
          <div className="space-y-3">
            {team.map((member) => (
              <div
                key={member.id}
                onClick={() => {
                  if (isAdmin) {
                    router.push(`/dashboard/employees/${member.id}`);
                  }
                }}
                className={`flex items-center gap-3 p-2.5 rounded-xl transition-all duration-300 ${isAdmin ? "cursor-pointer" : ""} ${member.isMe ? "bg-indigo-50/80 border border-indigo-100 shadow-sm" : "hover:bg-slate-50 border border-transparent hover:-translate-y-0.5 hover:shadow-sm"}`}
              >
                <Avatar
                  src={member.avatarThumbUrl || member.avatarUrl}
                  alt={member.name}
                  size="default"
                  fallback={member.name.charAt(0)}
                  status={member.status as any}
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-base font-black tracking-tight truncate flex items-center gap-1.5 ${member.isMe ? "text-indigo-900" : "text-slate-800"}`}>
                    {member.name}
                    {member.isMe && <span className="text-[9px] font-black bg-indigo-200/50 text-indigo-700 px-1.5 py-0.5 rounded uppercase tracking-wider">You</span>}
                  </p>
                  <p className={`text-[11px] font-semibold truncate ${member.isMe ? "text-indigo-600/70" : "text-slate-500"}`}>{member.role}</p>
                </div>
                {member.label && (
                  <Badge variant={member.label === "On Leave" ? "secondary" : "info"} className="text-[9px] px-1.5 py-0 uppercase tracking-wider h-4 leading-4 font-bold">
                    {member.label}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-slate-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400 mb-3"></div>
            <p className="text-sm font-semibold text-slate-700">Loading Team...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center text-slate-500">
            <div className="bg-slate-50 p-3 rounded-full mb-3 border border-slate-100">
              <Users className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No Other Team Members</p>
            <p className="text-xs mt-1">You are currently the only one in this department.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
