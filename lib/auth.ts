import { createClient } from "@/lib/supabase/client";

/**
 * Parses Supabase authentication errors into user-friendly messages.
 */
export function getAuthErrorMessage(error: any): string {
    const message = (error?.message || "").toLowerCase();

    if (message.includes("invalid login credentials")) {
        return "Invalid email or password.";
    }
    if (message.includes("email not confirmed")) {
        return "Please confirm your email before logging in.";
    }
    if (message.includes("user already registered") || message.includes("already been registered")) {
        return "This email is already registered. Please log in instead.";
    }
    if (message.includes("password") && message.includes("least")) {
        return "Password is too weak. It must be at least 8 characters.";
    }
    if (message.includes("invalid email")) {
        return "The email address is invalid.";
    }
    if (message.includes("network")) {
        return "Network error. Please check your internet connection.";
    }
    if (message.includes("user not found")) {
        return "This account has been disabled or does not exist.";
    }

    return error?.message || "An unexpected error occurred. Please try again.";
}

/**
 * Logs out the current user.
 */
export async function logoutUser(): Promise<{ error?: string }> {
    try {
        const supabase = createClient();
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        return {};
    } catch (error: any) {
        console.error("Logout Error:", error.message);
        return { error: getAuthErrorMessage(error) };
    }
}
