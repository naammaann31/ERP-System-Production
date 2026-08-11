"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubProfile: (() => void) | undefined;

        const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);

            if (unsubProfile) {
                unsubProfile();
                unsubProfile = undefined;
            }

            if (firebaseUser) {
                try {
                    const docRef = doc(db, "users", firebaseUser.uid);
                    
                    unsubProfile = onSnapshot(docRef, async (docSnap) => {
                        // TODO(2026-10-01): Remove legacy 'Users' fallback and auto-migration code completely.
                        // If not found in 'users', check legacy 'Users' table and auto-migrate
                        if (!docSnap.exists()) {
                            const legacyRef = doc(db, "Users", firebaseUser.uid);
                            const legacySnap = await getDoc(legacyRef);
                            if (legacySnap.exists()) {
                                const data = legacySnap.data();
                                // Copy to standard 'users' collection and remove legacy document
                                await setDoc(docRef, data);
                                await deleteDoc(legacyRef).catch(() => { });
                                return; // The snapshot will re-fire once created
                            }
                            setProfile(null);
                        } else {
                            const profileData = { uid: firebaseUser.uid, ...docSnap.data() } as UserProfile;
                            setProfile(profileData);
                        }
                        
                        setLoading(false);
                    }, (error) => {
                        console.error("Error fetching user profile:", error);
                        setProfile(null);
                        setLoading(false);
                    });
                } catch (error) {
                    console.error("Error setting up profile snapshot:", error);
                    setProfile(null);
                    setLoading(false);
                }
            } else {
                setProfile(null);
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubProfile) unsubProfile();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, profile, loading }}>
            {children}
        </AuthContext.Provider>
    );
}
