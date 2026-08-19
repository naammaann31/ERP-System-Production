"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/providers/AuthProvider";
import { Megaphone, Plus, Pin, X, Trash2, Clock } from "lucide-react";
import {
  Announcement,
  createAnnouncement,
  togglePinAnnouncement,
  deleteAnnouncement,
  listenToAnnouncements,
} from "@/lib/announcements";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { toast } from "sonner";

const formatRelativeTime = (ts: any) => {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const formatExactDateTime = (ts: any) => {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
};

export default function AnnouncementsPage() {
  const { profile } = useAuth();
  const isAdminOrHR = profile?.role === "Admin" || profile?.role === "HR" || profile?.role === "OPS_HR";

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    if (profile.uid) {
      import("@/lib/notifications").then(({ markTypeAsRead }) => {
        markTypeAsRead(profile.uid, "announcement");
      });
    }
    const unsubscribe = listenToAnnouncements((records) => {
      setAnnouncements(records);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [profile]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) return;
    setIsSubmitting(true);

    await createAnnouncement(title, body, profile.uid, profile.fullName, pinned);

    setTitle("");
    setBody("");
    setPinned(false);
    setIsModalOpen(false);
    setIsSubmitting(false);
    toast.success("Announcement published successfully!");
  };

  const handleDelete = (id: string) => {
    setAnnouncementToDelete(id);
  };

  const executeDelete = async () => {
    if (!announcementToDelete) return;
    await deleteAnnouncement(announcementToDelete);
    setAnnouncementToDelete(null);
    toast.success("Announcement deleted");
  };

  const handleTogglePin = async (id: string, current: boolean) => {
    await togglePinAnnouncement(id, !current);
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-5 pb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-blue-600" />
            Announcements
          </h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">Company-wide updates, news, and important notices.</p>
        </div>
        {isAdminOrHR && (
          <Button onClick={() => setIsModalOpen(true)} className="bg-slate-900 hover:bg-slate-800 text-white h-9 px-4 shadow-sm text-sm">
            <Plus className="h-4 w-4 mr-1.5" /> New Announcement
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <svg className="animate-spin h-6 w-6 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Megaphone className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <p className="font-semibold">No announcements yet</p>
          <p className="text-sm mt-1">Check back later for company updates.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann, i) => (
            <motion.div
              key={ann.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className={`rounded-2xl shadow-sm overflow-hidden transition-all hover:shadow-md ${ann.pinned ? "border-blue-200 bg-gradient-to-r from-blue-50/60 to-indigo-50/40 ring-1 ring-blue-100" : "border-slate-100 bg-white"}`}>
                <CardContent className="p-0">
                  <div className="flex items-stretch">
                    {/* Left accent bar */}
                    <div className={`w-1.5 shrink-0 ${ann.pinned ? "bg-gradient-to-b from-blue-500 to-indigo-500" : "bg-gradient-to-b from-slate-300 to-slate-200"}`} />
                    <div className="flex-1 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Header row: badges + relative time */}
                          <div className="flex items-center gap-2 mb-3">
                            {ann.pinned && (
                              <Badge className="bg-blue-100 text-blue-700 border-blue-200 font-bold text-[9px] py-0.5 px-2">
                                <Pin className="h-2.5 w-2.5 mr-0.5 rotate-45" /> Pinned
                              </Badge>
                            )}
                          </div>
                          {/* Title */}
                          <h3 className="text-lg font-bold text-slate-900 mb-1.5 tracking-tight">{ann.title}</h3>
                          {/* Body */}
                          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{ann.body}</p>
                          {/* Footer: author + exact date/time */}
                          <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-100">
                            <div className="flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
                                <span className="text-[10px] font-bold text-slate-600">{(ann.authorName || "?").split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()}</span>
                              </div>
                              <span className="text-xs font-semibold text-slate-500">{ann.authorName}</span>
                            </div>
                            <span className="text-slate-300">•</span>
                            <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {formatExactDateTime(ann.createdAt)}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-[10px] font-semibold text-slate-400">{formatRelativeTime(ann.createdAt)}</span>
                          </div>
                        </div>
                        {isAdminOrHR && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleTogglePin(ann.id!, ann.pinned)}
                              className={`p-2 rounded-lg transition-colors ${ann.pinned ? "text-blue-600 bg-blue-100 hover:bg-blue-200" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"}`}
                              title={ann.pinned ? "Unpin" : "Pin"}
                            >
                              <Pin className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(ann.id!)}
                              className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Announcement Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-[24px] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100"
          >
            <div className="bg-slate-50/50 px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">New Announcement</h2>
                <p className="text-xs font-semibold text-slate-500 mt-1">Broadcast a message to all employees</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-5">
              <div>
                <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">Title</label>
                <input
                  type="text"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all"
                  placeholder="Announcement title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">Message</label>
                <textarea
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all resize-none"
                  rows={5}
                  placeholder="Write your announcement here..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPinned(!pinned)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${pinned ? "bg-blue-100 text-blue-700 border border-blue-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  <Pin className="h-4 w-4" /> {pinned ? "Pinned" : "Pin to top"}
                </button>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-xl border-slate-200 font-bold hover:bg-slate-50 px-6">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="rounded-xl bg-slate-900 hover:bg-slate-800 font-bold px-6 shadow-md active:scale-95 transition-all text-white">
                  {isSubmitting ? "Publishing..." : "Publish"}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!announcementToDelete}
        onClose={() => setAnnouncementToDelete(null)}
        onConfirm={executeDelete}
        title="Delete Announcement"
        description="Are you sure you want to delete this announcement? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
