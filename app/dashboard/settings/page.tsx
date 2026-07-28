"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/AuthProvider";
import { Bell, Lock, User, Globe, Moon, Save, Check } from "lucide-react";
import { updateUserProfile, getUserSettings, UserSettings } from "@/lib/settings";
import { toast, Toaster } from "sonner";

const tabs = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Lock },
  { id: "language", label: "Language", icon: Globe },
  { id: "appearance", label: "Appearance", icon: Moon },
];

const timezones = [
  "Asia/Kolkata",
  "America/New_York",
  "America/Los_Angeles",
  "America/Chicago",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Dubai",
  "Australia/Sydney",
  "UTC",
];

export default function SettingsPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Profile form
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");

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
      setTimezone(settings.timezone || "Asia/Kolkata");
      setNotifEmail(settings.notificationsEmail ?? true);
      setNotifLeave(settings.notificationsLeave ?? true);
      setNotifPayroll(settings.notificationsPayroll ?? true);
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
                    <label className="text-xs font-semibold uppercase text-slate-500">Phone Number</label>
                    <input type="text" className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-slate-500">Timezone</label>
                    <select className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                      {timezones.map((tz) => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
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

          {/* Notifications Tab */}
          {activeTab === "notifications" && (
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Choose what notifications you receive.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Email Notifications", desc: "Receive notifications via email", value: notifEmail, setter: setNotifEmail },
                  { label: "Leave Updates", desc: "Get notified when your leave status changes", value: notifLeave, setter: setNotifLeave },
                  { label: "Payroll Alerts", desc: "Get notified when your payslip is generated", value: notifPayroll, setter: setNotifPayroll },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.desc}</p>
                    </div>
                    <button
                      onClick={() => item.setter(!item.value)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${item.value ? "bg-blue-600" : "bg-slate-200"}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${item.value ? "left-6" : "left-1"}`} />
                    </button>
                  </div>
                ))}
                <div className="pt-4 flex justify-end">
                  <Button onClick={handleSaveProfile} disabled={saving}>
                    {saved ? "Saved!" : "Save Preferences"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Security Tab */}
          {activeTab === "security" && (
            <Card>
              <CardHeader>
                <CardTitle>Security</CardTitle>
                <CardDescription>Manage your account security settings.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-slate-500">Current Password</label>
                  <input type="password" className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="••••••••" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-slate-500">New Password</label>
                    <input type="password" className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="••••••••" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-slate-500">Confirm Password</label>
                    <input type="password" className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="••••••••" />
                  </div>
                </div>
                <div className="pt-4 flex justify-end">
                  <Button>Update Password</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Language Tab */}
          {activeTab === "language" && (
            <Card>
              <CardHeader>
                <CardTitle>Language & Region</CardTitle>
                <CardDescription>Set your preferred language and regional settings.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-slate-500">Interface Language</label>
                  <select className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none">
                    <option>English (US)</option>
                    <option>Hindi (हिन्दी)</option>
                    <option>Spanish (Español)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-slate-500">Date Format</label>
                  <select className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none">
                    <option>DD/MM/YYYY</option>
                    <option>MM/DD/YYYY</option>
                    <option>YYYY-MM-DD</option>
                  </select>
                </div>
                <div className="pt-4 flex justify-end">
                  <Button>Save Changes</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Appearance Tab */}
          {activeTab === "appearance" && (
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Customize how the application looks.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500 mb-3 block">Theme</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => handleThemeChange("light")}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${theme === "light" ? "border-blue-500 bg-blue-50/50 shadow-md" : "border-slate-200 hover:border-slate-300"}`}
                    >
                      <div className="w-full h-16 rounded-lg bg-white border border-slate-200 mb-3 flex items-center justify-center">
                        <div className="w-8 h-1.5 bg-slate-300 rounded-full" />
                      </div>
                      <p className="text-sm font-bold text-slate-800">Light</p>
                      <p className="text-xs text-slate-500">Clean and bright interface</p>
                    </button>
                    <button
                      onClick={() => handleThemeChange("dark")}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${theme === "dark" ? "border-blue-500 bg-blue-50/50 shadow-md" : "border-slate-200 hover:border-slate-300"}`}
                    >
                      <div className="w-full h-16 rounded-lg bg-slate-800 border border-slate-700 mb-3 flex items-center justify-center">
                        <div className="w-8 h-1.5 bg-slate-600 rounded-full" />
                      </div>
                      <p className="text-sm font-bold text-slate-800">Dark</p>
                      <p className="text-xs text-slate-500">Easy on the eyes</p>
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
