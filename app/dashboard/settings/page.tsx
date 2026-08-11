"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/AuthProvider";
import { Bell, Lock, User, Globe, Moon, Save, Check, ChevronDown } from "lucide-react";
import { updateUserProfile, getUserSettings, UserSettings } from "@/lib/settings";
import { toast, Toaster } from "sonner";
import { auth } from "@/lib/firebase";
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";

const tabs = [
  { id: "profile", label: "Profile", icon: User },
];

const timezones = [
  "Indian",
  "Eastern",
  "Pacific",
  "Central",
  "Mountain",
];

export default function SettingsPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Profile form
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [timezone, setTimezone] = useState("Indian");
  const [timezoneOpen, setTimezoneOpen] = useState(false);

  // Security form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Notification prefs
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifLeave, setNotifLeave] = useState(true);
  const [notifPayroll, setNotifPayroll] = useState(true);

  // Theme
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (!profile?.uid) return;

    getUserSettings(profile.uid).then((settings) => {
      setFullName(settings.fullName || profile.fullName || "");
      setPhone(settings.phone || "");
      setTimezone(settings.timezone || "Indian");
      setNotifEmail(settings.notificationsEmail ?? true);
      setNotifLeave(settings.notificationsLeave ?? true);
      setNotifPayroll(settings.notificationsPayroll ?? true);
    }).catch(error => {
      console.error("Error loading user settings:", error);
    });

    // Load theme
    const stored = localStorage.getItem("vectra-theme");
    if (stored === "dark") {
      setTheme("dark");
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!profile?.uid) return;
    setSaving(true);
    try {
      await updateUserProfile(profile.uid, {
        fullName,
        phone,
        timezone,
        notificationsEmail: notifEmail,
        notificationsLeave: notifLeave,
        notificationsPayroll: notifPayroll,
      });
      setSaved(true);
      toast.success("Settings saved successfully!");
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      toast.error("Failed to save settings.");
    }
    setSaving(false);
  };

  const handleThemeChange = (newTheme: "light" | "dark") => {
    setTheme(newTheme);
    localStorage.setItem("vectra-theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }
    
    setUpdatingPassword(true);
    try {
      const currentUser = auth.currentUser;
      if (currentUser && currentUser.email) {
        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, newPassword);
        toast.success("Password updated successfully.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error("Could not authenticate user.");
      }
    } catch (error: any) {
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        toast.error("Incorrect current password.");
      } else {
        toast.error("Failed to update password.");
      }
    }
    setUpdatingPassword(false);
  };

  return (
    <div className="max-w-[1000px] mx-auto space-y-6 pb-12">
      <Toaster position="top-right" richColors />
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Account Settings</h1>
        <p className="text-slate-500 mt-1">Manage your account preferences and configurations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 space-y-1">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "secondary" : "ghost"}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full justify-start ${activeTab === tab.id ? "font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100" : "text-slate-600"}`}
            >
              <tab.icon className="h-4 w-4 mr-3" /> {tab.label}
            </Button>
          ))}
        </div>

        <div className="md:col-span-3 space-y-6">
          {/* Profile Tab */}
          {activeTab === "profile" && (
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Update your personal details here.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-slate-500">Full Name</label>
                    <input type="text" className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-slate-500">Email Address</label>
                    <input type="email" disabled className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-100 text-slate-500 outline-none cursor-not-allowed" defaultValue={profile?.email || ""} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-slate-500">Timezone</label>
                    <div className="relative">
                      <button 
                        type="button"
                        onClick={() => setTimezoneOpen(!timezoneOpen)}
                        className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none text-left"
                      >
                        <span className="truncate">{timezone}</span>
                        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${timezoneOpen ? "rotate-180" : ""}`} />
                      </button>
                      
                      {timezoneOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setTimezoneOpen(false)} />
                          <div className="absolute z-20 mt-1 w-full bg-white rounded-lg border border-slate-200 shadow-lg py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            {timezones.map((tz) => (
                              <button
                                key={tz}
                                type="button"
                                onClick={() => {
                                  setTimezone(tz);
                                  setTimezoneOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${timezone === tz ? 'bg-blue-50/50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}
                              >
                                {tz}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="pt-4 flex justify-end">
                  <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
                    {saved ? <><Check className="h-4 w-4" /> Saved!</> : saving ? "Saving..." : <><Save className="h-4 w-4" /> Save Changes</>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
