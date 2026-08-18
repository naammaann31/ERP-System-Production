"use server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

interface CreateEmployeeInput {
  fullName: string;
  employeeId: string;
  email: string;
  role: string;
  password: string;
  jobRole: string;
  designation: string;
}
export interface UpdateEmployeeInput {
  uid: string;
  fullName: string;
  employeeId: string;
  email: string;
  role: string;
  jobRole: string;
  designation: string;
}



async function assertCallerIsAdminOrHR() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated." };

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!callerProfile || !["Admin", "HR", "OPS_HR"].includes(callerProfile.role)) {
    return { ok: false as const, error: "Only Admin or HR can perform this action." };
  }

  return { ok: true as const, callerId: user.id };
}

/**
 * Creates a new employee's Supabase Auth account + profile.
 * Runs only on the server: verifies the caller is Admin/HR using their own
 * RLS-respecting session, then uses the service-role key (never sent to the
 * browser) to create the Auth user and set their role/employment fields.
 */
export async function createEmployeeAction(
  input: CreateEmployeeInput
): Promise<{ error?: string }> {
  const check = await assertCallerIsAdminOrHR();
  if (!check.ok) return { error: check.error };

  const email = input.email.trim().toLowerCase();
  const admin = createServiceRoleClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName.trim() },
  });

  if (createError || !created?.user) {
    return { error: createError?.message || "Failed to create employee account." };
  }

  // Follow-up update via the service-role client: protect_profile_fields
  // allows this because it runs with the service_role Postgres role.
  const { error: updateError } = await admin
    .from("profiles")
    .update({
      role: input.role,
      employee_id: input.employeeId.trim(),
      job_role: input.jobRole.trim(),
      designation: input.designation,
    })
    .eq("id", created.user.id);

  if (updateError) {
    return { error: updateError.message };
  }

  return {};
}

/**
 * Deletes an employee (Auth account + profile, cascades via FK). The
 * delete_employee() RPC re-verifies Admin/HR server-side on its own, so
 * this is safe to call with the caller's normal session.
 */
export async function deleteEmployeeAction(employeeUid: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_employee", { p_employee_uid: employeeUid });
  if (error) return { error: error.message };
  return {};
}


export async function updateEmployeeAction(
  input: UpdateEmployeeInput
): Promise<{ error?: string }> {
  const check = await assertCallerIsAdminOrHR();
  if (!check.ok) return { error: check.error };

  const email = input.email ? input.email.trim().toLowerCase() : null;
  const admin = createServiceRoleClient();

  const updateData: any = {
    user_metadata: { full_name: input.fullName.trim() },
  };
  if (email) {
    updateData.email = email;
    updateData.email_confirm = true;
  }

  // Update Auth layer (email and metadata)
  const { error: updateAuthError } = await admin.auth.admin.updateUserById(input.uid, updateData);

  if (updateAuthError) {
    return { error: updateAuthError.message || "Failed to update employee auth account." };
  }

  // Update Profiles table
  const { error: updateProfileError } = await admin
    .from("profiles")
    .update({
      full_name: input.fullName.trim(),
      role: input.role,
      employee_id: input.employeeId.trim(),
      job_role: input.jobRole.trim(),
      designation: input.designation,
    })
    .eq("id", input.uid);

  if (updateProfileError) {
    return { error: updateProfileError.message };
  }

  return {};
}
