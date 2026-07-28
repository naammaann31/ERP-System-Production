"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/AuthProvider";
import { Bell, Lock, User, Globe, Moon } from "lucide-react";

export default function SettingsPage() {
  const { profile } = useAuth();

  return (
    <div className="max-w-[1000px] mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Account Settings</h1>
        <p className="text-slate-500 mt-1">Manage your account preferences and configurations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 space-y-1">
          <Button variant="secondary" className="w-full justify-start font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100">
            <User className="h-4 w-4 mr-3" /> Profile
          </Button>
          <Button variant="ghost" className="w-full justify-start text-slate-600">
            <Bell className="h-4 w-4 mr-3" /> Notifications
          </Button>
          <Button variant="ghost" className="w-full justify-start text-slate-600">
            <Lock className="h-4 w-4 mr-3" /> Security
          </Button>
          <Button variant="ghost" className="w-full justify-start text-slate-600">
            <Globe className="h-4 w-4 mr-3" /> Language
          </Button>
          <Button variant="ghost" className="w-full justify-start text-slate-600">
            <Moon className="h-4 w-4 mr-3" /> Appearance
          </Button>
        </div>

        <div className="md:col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Update your personal details here.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-slate-500">Full Name</label>
                  <input type="text" className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" defaultValue={profile?.fullName || ""} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-slate-500">Email Address</label>
                  <input type="email" disabled className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-100 text-slate-500 outline-none cursor-not-allowed" defaultValue={profile?.email || ""} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-slate-500">Phone Number</label>
                  <input type="text" className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="+1 (555) 000-0000" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-slate-500">Timezone</label>
                  <select className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none">
                    <option>Pacific Time (PT)</option>
                    <option>Eastern Time (ET)</option>
                    <option>Coordinated Universal Time (UTC)</option>
                  </select>
                </div>
              </div>
              <div className="pt-4 flex justify-end">
                <Button>Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
