"use server";

import { createClient } from "@supabase/supabase-js";

function getSupabase() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase credentials");
    return createClient(supabaseUrl, supabaseKey);
}

export async function updatePayrollExtraFields(payrollId: string, data: {
    date_of_joining?: string | null;
    bank_name?: string | null;
    division?: string | null;
    days_worked?: number | null;
    department?: string | null;
}) {
    const supabase = getSupabase();
    const { error } = await supabase.from("payrolls").update(data).eq("id", payrollId);
    if (error) throw new Error(error.message);
    return { success: true };
}

export async function getEmployeeBankName(employeeUid: string): Promise<string> {
    const supabase = getSupabase();
    const { data } = await supabase
        .from("employee_private")
        .select("bank_name, bank_account_name")
        .eq("id", employeeUid)
        .maybeSingle();
    // Return bank_name as the primary field for the Payslip's "Bank Name", fallback to account name if needed
    return data?.bank_name || data?.bank_account_name || "";
}

export async function getEmployeeProfileFields(employeeUid: string): Promise<{
    dateOfJoining: string;
    department: string;
    role: string;
}> {
    const supabase = getSupabase();
    const { data } = await supabase
        .from("profiles")
        .select("date_of_joining, department, role")
        .eq("id", employeeUid)
        .maybeSingle();
    return {
        dateOfJoining: data?.date_of_joining || "",
        department: data?.department || "",
        role: data?.role || "",
    };
}
