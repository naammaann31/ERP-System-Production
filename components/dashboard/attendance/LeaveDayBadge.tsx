"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { PenLine } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getUserLeaves, getDailyLeavePaymentStatus, type LeaveCategory } from "@/lib/leave";

/**
 * Renders an "Earned Leave" / "Casual Leave" attendance day as "EL (Paid)",
 * "EL (LOP)", "CL (Paid)", or "CL (LOP)" - computed live via
 * getDailyLeavePaymentStatus() (lib/leave.ts), the exact same per-day logic
 * Payroll's monthly totals are built from, so this label can never disagree
 * with what payroll actually deducts for that employee/month.
 *
 * A small, separate component (rather than folding this into the existing
 * synchronous getStatusBadge() helpers) because it needs its own leave
 * history + opening-balance fetch per employee - something a plain
 * status-to-badge switch can't do without becoming async itself.
 */
export default function LeaveDayBadge({
  userId,
  date,
  category,
  isEdited,
}: {
  userId: string;
  date: string;
  category: LeaveCategory;
  isEdited?: boolean;
}) {
  const [paymentStatus, setPaymentStatus] = useState<"Paid" | "LOP" | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const [leaves, profileRes] = await Promise.all([
          getUserLeaves(userId),
          supabase.from("profiles").select("el_opening_balance, cl_opening_balance, date_of_joining").eq("id", userId).single(),
        ]);
        if (cancelled) return;
        const status = getDailyLeavePaymentStatus(
          profileRes.data?.date_of_joining || undefined,
          leaves,
          profileRes.data?.el_opening_balance,
          profileRes.data?.cl_opening_balance,
          category,
          date
        );
        setPaymentStatus(status);
      } catch (e) {
        console.error("LeaveDayBadge: failed to resolve payment status", e);
        if (!cancelled) setPaymentStatus(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, date, category]);

  const short = category === "Earned Leave" ? "EL" : "CL";
  const label =
    paymentStatus === null ? short : `${short} (${paymentStatus})`;
  const isPaid = paymentStatus === "Paid";
  const className =
    paymentStatus === null
      ? "bg-orange-50 text-orange-600 border-orange-200"
      : isPaid
      ? "bg-emerald-50 text-emerald-600 border-emerald-200"
      : "bg-red-50 text-red-600 border-red-200";

  const badge = (
    <Badge variant={paymentStatus === null ? "secondary" : isPaid ? "success" : "destructive"} className={className}>
      {label}
    </Badge>
  );

  if (!isEdited) return badge;

  return (
    <div className="flex items-center gap-1.5">
      {badge}
      <Badge variant="outline" className="bg-blue-50/50 text-blue-600 border-blue-200/60 text-[10px] px-1.5 py-0 flex items-center gap-1 font-medium">
        <PenLine className="w-2.5 h-2.5" />
        Edited
      </Badge>
    </div>
  );
}
