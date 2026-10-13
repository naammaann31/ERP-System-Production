"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { useAuth } from "@/components/providers/AuthProvider";
import { Bell, Lock, User, Globe, Moon, Save, Check, ChevronDown, Camera } from "lucide-react";
import LinkedInIcon from "@/components/ui/LinkedInIcon";
import { updateUserProfile, getUserSettings, UserSettings } from "@/lib/settings";
import { uploadAvatar, AvatarUploadError } from "@/lib/avatar";
import { toast, Toaster } from "sonner";
import { createClient } from "@/lib/supabase/client";



const timezones = [
  "Indian",
  "Eastern",
  "Pacific",
  "Central",
  "Mountain",
];

export default function SettingsPage() {
  const { profile } = useAuth();
  
  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    ...(profile?.role === "Admin" ? [{ id: "security", label: "Security", icon: Lock }] : [])
  ];
  const [activeTab, setActiveTab] = useState("profile");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Profile photo
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Profile form
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [timezone, setTimezone] = useState("Indian");
  const [linkedinUrl, setLinkedinUrl] = useState("");
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
      setLinkedinUrl(settings.linkedinUrl || "");
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

    const trimmedLinkedin = linkedinUrl.trim();
    if (trimmedLinkedin && !/^https?:\/\/.+/i.test(trimmedLinkedin)) {
      toast.error("LinkedIn URL must start with http:// or https://");
      return;
    }

    setSaving(true);
    try {
      await updateUserProfile(profile.uid, {
        fullName,
        phone,
        timezone,
        linkedinUrl: trimmedLinkedin,
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

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.uid) return;

    setUploadingPhoto(true);
    try {
      await uploadAvatar(file, profile.uid);
      toast.success("Profile photo updated!");
    } catch (error) {
      console.error("Avatar upload failed:", error);
      const message = error instanceof AvatarUploadError ? error.message : "Failed to upload photo.";
      toast.error(message);
    }
    setUploadingPhoto(false);
    if (photoInputRef.current) photoInputRef.current.value = "";
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
      const supabase = createClient();
      if (profile?.email) {
        // Verify the current password by re-signing-in (Supabase has no
        // separate "reauthenticate" call — signing in again confirms it).
        const { error: reauthError } = await supabase.auth.signInWithPassword({
          email: profile.email,
          password: currentPassword,
        });
        if (reauthError) {
          toast.error("Incorrect current password.");
          setUpdatingPassword(false);
          return;
        }

        const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
        if (updateError) throw updateError;

        toast.success("Password updated successfully.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error("Could not authenticate user.");
      }
    } catch (error: any) {
      toast.error("Failed to update password.");
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
                <div className="flex items-center gap-5 pb-2">
                  <div className="relative group">
                    <Avatar
                      src={profile?.avatarThumbUrl || profile?.avatarUrl}
                      alt={profile?.fullName}
                      fallback={profile?.fullName?.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase() || "U"}
                      size="2xl"
                      className="border border-slate-200 shadow-sm"
                      fallbackClassName="bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold text-2xl"
                    />
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center shadow-md border-2 border-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      title="Change photo"
                    >
                      {uploadingPhoto ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Camera className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={handlePhotoSelected}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Profile Photo</p>
                    <p className="text-xs text-slate-500 mt-0.5">JPG, PNG, WEBP or GIF. Max 5 MB.</p>
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 mt-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {uploadingPhoto ? "Uploading..." : "Change photo"}
                    </button>
                  </div>
                </div>
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

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-slate-500">LinkedIn URL</label>
                    <div className="relative">
                      <LinkedInIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#0A66C2]" />
                      <input
                        type="url"
                        placeholder="https://www.linkedin.com/in/your-name"
                        value={linkedinUrl}
                        onChange={(e) => setLinkedinUrl(e.target.value)}
                        className="w-full pl-9 p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400">Shown to everyone on the Vectra Team directory.</p>
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

          {/* Security Tab */}
          {activeTab === "security" && (
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Update your password to keep your account secure.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-slate-500">Current Password</label>
                    <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Enter current password" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-slate-500">New Password</label>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Enter new password" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-slate-500">Confirm New Password</label>
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Confirm new password" />
                  </div>
                </div>
                <div className="pt-4 flex justify-end">
                  <Button onClick={handleUpdatePassword} disabled={updatingPassword} className="gap-2 bg-blue-600 hover:bg-blue-700">
                    {updatingPassword ? "Updating..." : <><Lock className="h-4 w-4" /> Update Password</>}
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