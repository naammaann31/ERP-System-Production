import { createClient } from "@/lib/supabase/client";

export interface UserSettings {
  fullName?: string;
  phone?: string;
  timezone?: string;
  notificationsEmail?: boolean;
  notificationsLeave?: boolean;
  notificationsPayroll?: boolean;
}

export const updateUserProfile = async (uid: string, data: UserSettings) => {
  const supabase = createClient();
  const update: Record<string, any> = {};
  if (data.fullName !== undefined) update.full_name = data.fullName;
  if (data.phone !== undefined) update.phone = data.phone;
  if (data.timezone !== undefined) update.timezone = data.timezone;
  if (data.notificationsEmail !== undefined) update.notifications_email = data.notificationsEmail;
  if (data.notificationsLeave !== undefined) update.notifications_leave = data.notificationsLeave;
  if (data.notificationsPayroll !== undefined) update.notifications_payroll = data.notificationsPayroll;

  const { error } = await supabase.from("profiles").update(update).eq("id", uid);
  if (error) throw error;
};

export const getUserSettings = async (uid: string): Promise<UserSettings> => {
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("full_name, phone, timezone, notifications_email, notifications_leave, notifications_payroll")
    .eq("id", uid)
    .maybeSingle();

  if (data) {
    return {
      fullName: data.full_name,
      phone: data.phone || "",
      timezone: data.timezone || "Asia/Kolkata",
      notificationsEmail: data.notifications_email ?? true,
      notificationsLeave: data.notifications_leave ?? true,
      notificationsPayroll: data.notifications_payroll ?? true,
    };
  }

  return {};
};
