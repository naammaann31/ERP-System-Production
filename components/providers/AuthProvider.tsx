"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export interface UserProfile {
    uid: string;
    fullName: string;
    email: string;
    role: string;
    status?: string;
    jobRole?: string;
    employeeId?: string;
    designation?: string;
    department?: string;
}

interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    profile: null,
    loading: true,
});

export const useAuth = () => useContext(AuthContext);

function toProfile(row: any): UserProfile {
    return {
        uid: row.id,
        fullName: row.full_name,
        email: row.email,
        role: row.role,
        status: row.status,
        jobRole: row.job_role,
        employeeId: row.employee_id,
        designation: row.designation,
        department: row.department,
    };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const supabase = createClient();
        let profileChannel: ReturnType<typeof supabase.channel> | undefined;

        const loadProfile = async (authUser: User | null) => {
            setUser(authUser);

            if (profileChannel) {
                supabase.removeChannel(profileChannel);
                profileChannel = undefined;
            }

            if (authUser) {
                const fetchProfile = async () => {
                    try {
                        const { data, error } = await supabase
                            .from("profiles")
                            .select("*")
                            .eq("id", authUser.id)
                            .single();

                        if (error) throw error;
                        setProfile(data ? toProfile(data) : null);
                    } catch (error) {
                        console.error("Error fetching user profile:", error);
                        setProfile(null);
                    }
                    setLoading(false);
                };

                await fetchProfile();

                // Keep the profile live-synced — e.g. if an Admin changes
                // this user's role/status while they're logged in, their
                // UI reflects it immediately without a reload.
                profileChannel = supabase
                    .channel(`profile_${authUser.id}_${Math.random().toString(36).slice(2)}`)
                    .on(
                        "postgres_changes",
                        { event: "*", schema: "public", table: "profiles", filter: `id=eq.${authUser.id}` },
                        fetchProfile
                    )
                    .subscribe();
            } else {
                setProfile(null);
                setLoading(false);
            }
        };

        // onAuthStateChange fires immediately with the current session on
        // subscribe, so a separate getUser() call isn't needed — calling
        // both raced two concurrent loadProfile() calls against the same
        // realtime channel name and threw "cannot add postgres_changes
        // callbacks ... after subscribe()".
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            loadProfile(session?.user ?? null);
        });

        return () => {
            subscription.unsubscribe();
            if (profileChannel) supabase.removeChannel(profileChannel);
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, profile, loading }}>
            {children}
        </AuthContext.Provider>
    );
}
