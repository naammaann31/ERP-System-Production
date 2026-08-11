"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { useAuth } from "@/components/providers/AuthProvider";
import { getLocalDateString } from "@/lib/attendance";
import { useRouter } from "next/navigation";

type TeamMember = {
  id: string;
  name: string;
  role: string;
  status: string;
  label?: string;
  isMe?: boolean;
};

export default function TeamStatusWidget() {
  const { profile } = useAuth();
  const router = useRouter();
  const isAdmin = profile?.role === "Admin";
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.role) {
      setLoading(false);
      return;
    }

    const todayDate = getLocalDateString();
    let usersData: any[] = [];
    let attendanceData: Record<string, string> = {};

    const updateTeam = () => {
      const members: TeamMember[] = [];
      usersData.forEach((doc) => {
        const data = doc.data();
        const isMe = doc.id === profile.uid;
        const attStatus = attendanceData[doc.id];
        
        let finalStatus = "offline";
        if (attStatus === "Checked In" || attStatus === "Present") {
          finalStatus = "online";
        } else if (data.status === "Active" || !data.status) {
          finalStatus = "online";
        }
        
        members.push({
          id: doc.id,
          name: data.fullName || "Unknown",
          role: data.jobRole || data.role || "Employee",
          status: finalStatus,
          label: data.status === "On Leave" ? "On Leave" : undefined,
          isMe
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


    const qUsers = isAdmin 
      ? collection(db, "users") 
      : query(collection(db, "users"), where("role", "==", profile.role));
      
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      usersData = snap.docs;
      updateTeam();
    }, (error) => {
      console.error("Error fetching team users:", error);
      setLoading(false);
    });

    const qAtt = query(collection(db, "attendance"), where("date", "==", todayDate));
    const unsubAtt = onSnapshot(qAtt, (snap) => {
      const newAtt: Record<string, string> = {};
      snap.docs.forEach((doc) => {
        const d = doc.data();
        newAtt[d.userId] = d.status;
      });
      attendanceData = newAtt;
      updateTeam();
    }, (error) => {
      console.error("Error fetching attendance:", error);
    });

    return () => {
      unsubUsers();
      unsubAtt();
    };
  }, [profile]);

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
      <CardContent>
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
