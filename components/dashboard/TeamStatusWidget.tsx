"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

const team: { id: number; name: string; role: string; status: string; label?: string }[] = [];

export default function TeamStatusWidget() {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-500" />
            Team Status
          </CardTitle>
          <span className="text-xs font-semibold text-slate-500">{team.length} Members</span>
        </div>
      </CardHeader>
      <CardContent>
        {team.length > 0 ? (
          <div className="space-y-4">
            {team.map((member) => (
              <div key={member.id} className="flex items-center gap-3">
                <Avatar 
                  size="default" 
                  fallback={member.name.charAt(0)} 
                  status={member.status as any}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{member.name}</p>
                  <p className="text-xs text-slate-500 truncate">{member.role}</p>
                </div>
                {member.label && (
                  <Badge variant={member.label === "On Leave" ? "secondary" : "info"} className="text-[9px] px-1.5 py-0 uppercase tracking-wider h-4 leading-4">
                    {member.label}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center text-slate-500">
            <div className="bg-slate-50 p-3 rounded-full mb-3 border border-slate-100">
              <Users className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No Team Members</p>
            <p className="text-xs mt-1">Your team directory is currently empty.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
