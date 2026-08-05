"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
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
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);
            
            if (firebaseUser) {
                try {
                    const docRef = doc(db, "users", firebaseUser.uid);
                    let docSnap = await getDoc(docRef);

                    // TODO(2026-10-01): Remove legacy 'Users' fallback and auto-migration code completely.
                    // If not found in 'users', check legacy 'Users' table and auto-migrate
                    if (!docSnap.exists()) {
                        const legacyRef = doc(db, "Users", firebaseUser.uid);
                        const legacySnap = await getDoc(legacyRef);
                        if (legacySnap.exists()) {
                            const data = legacySnap.data();
                            // Copy to standard 'users' collection and remove legacy document
                            await setDoc(docRef, data);
                            await deleteDoc(legacyRef).catch(() => {});
                            docSnap = await getDoc(docRef);
                        }
                    }

                    if (docSnap.exists()) {
                        const profileData = { uid: firebaseUser.uid, ...docSnap.data() } as UserProfile;
                        setProfile(profileData);

                        // If Admin or HR is logged in, perform a background sweep to migrate all remaining legacy docs from 'Users' to 'users'
                        if (["Admin", "HR", "OPS_HR"].includes(profileData.role)) {
                            getDocs(collection(db, "Users")).then(async (usersSnap) => {
                                for (const uDoc of usersSnap.docs) {
                                    try {
                                        await setDoc(doc(db, "users", uDoc.id), uDoc.data());
                                        await deleteDoc(doc(db, "Users", uDoc.id));
                                    } catch (err) {
                                        console.error("Auto-migration error for user", uDoc.id, err);
                                    }
                                }
                            }).catch(() => {});
                        }
                    } else {
                        setProfile(null);
                    }
                } catch (error) {
                    console.error("Error fetching user profile:", error);
                    setProfile(null);
                }
            } else {
                setProfile(null);
            }
            
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ user, profile, loading }}>
            {children}
        </AuthContext.Provider>
    );
}
