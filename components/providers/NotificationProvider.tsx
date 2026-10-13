"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { listenToUnreadNotificationCounts } from "@/lib/notifications";

interface NotificationContextProps {
  unreadCount: number;
  announcementUnreadCount: number;
}

const NotificationContext = createContext<NotificationContextProps>({
  unreadCount: 0,
  announcementUnreadCount: 0,
});

export const useNotifications = () => useContext(NotificationContext);

/**
 * Login-time footprint is now two `head: true` counts (zero rows
 * transferred), not every notification row the user has ever received.
 * The actual message list is fetched separately and lazily, only while
 * the Navbar bell dropdown is open — see Navbar.tsx.
 */
export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { profile } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [announcementUnreadCount, setAnnouncementUnreadCount] = useState(0);

  useEffect(() => {
    if (!profile?.uid) {
      setUnreadCount(0);
      setAnnouncementUnreadCount(0);
      return;
    }

    const unsubscribe = listenToUnreadNotificationCounts(profile.uid, (counts) => {
      setUnreadCount(counts.total);
      setAnnouncementUnreadCount(counts.announcement);
    });

    return () => {
      unsubscribe();
    };
  }, [profile?.uid]); // dependency is strictly uid, not the full profile object

  return (
    <NotificationContext.Provider value={{ unreadCount, announcementUnreadCount }}>
      {children}
    </NotificationContext.Provider>
  );
};
