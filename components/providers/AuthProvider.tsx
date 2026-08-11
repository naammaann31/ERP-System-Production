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

        const loadProfile = async (authUser: User | null) => {
            setUser(authUser);

            if (authUser) {
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
            } else {
                setProfile(null);
            }

            setLoading(false);
        };

        supabase.auth.getUser().then(({ data }) => loadProfile(data.user));

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            loadProfile(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ user, profile, loading }}>
            {children}
        </AuthContext.Provider>
    );
}
