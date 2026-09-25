"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { listenToUserNotifications, Notification } from "@/lib/notifications";

interface NotificationContextProps {
  notifications: Notification[];
  unreadCount: number;
}

const NotificationContext = createContext<NotificationContextProps>({
  notifications: [],
  unreadCount: 0,
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!profile?.uid) {
      setNotifications([]);
      return;
    }
    
    const unsubscribe = listenToUserNotifications(profile.uid, (notifs) => {
      setNotifications(notifs);
    });

    return () => {
      unsubscribe();
    };
  }, [profile?.uid]); // dependency is strictly uid, not the full profile object

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount }}>
      {children}
    </NotificationContext.Provider>
  );
};
