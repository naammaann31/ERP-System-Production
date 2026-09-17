import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

/**
 * Ensures we have a live session before touching Supabase.
 *
 * getUser() validates against the auth server and transparently refreshes
 * an expired access token, so this usually self-heals. Without it, an
 * expired session silently downgrades requests to the `anon` role: reads
 * return zero rows with no error and writes fail with a bare
 * "violates row-level security policy", which points nowhere useful.
 */
export async function requireSession(supabase: ReturnType<typeof createClient>) {
    const { data, error: authErr } = await supabase.auth.getUser();
    if (authErr || !data?.user) {
        toast.error("Your session has expired. Please refresh the page and sign in again.");
        return null;
    }
    return data.user;
}
