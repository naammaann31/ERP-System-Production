import app, { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword, signOut, User, getAuth as getFirebaseAuth } from "firebase/auth";
import { doc, setDoc, serverTimestamp, getFirestore } from "firebase/firestore";
import { getApps, initializeApp } from "firebase/app";

/**
 * Parses Firebase authentication errors into user-friendly messages.
 */
export function getFirebaseErrorMessage(error: any): string {
    const code = error?.code;
    switch (code) {
        case "auth/email-already-in-use":
            return "This email is already registered. Please log in instead.";
        case "auth/weak-password":
            return "Password is too weak. It must be at least 8 characters.";
        case "auth/invalid-email":
            return "The email address is invalid.";
        case "auth/operation-not-allowed":
            return "Email/password accounts are not enabled in Firebase.";
        case "auth/network-request-failed":
            return "Network error. Please check your internet connection.";
        case "auth/user-disabled":
            return "This account has been disabled by an administrator.";
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
            return "Invalid email or password.";
        default:
            return error?.message || "An unexpected error occurred. Please try again.";
    }
}

/**
 * Registers a new Admin user using Firebase Auth and stores details in Firestore.
 */
export async function registerAdmin(
    fullName: string,
    email: string,
    password: string
): Promise<{ user?: User; error?: string }> {
    try {
        // 1. Create user in Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Store additional user details in Firestore
        // Document ID is set to the Firebase Auth UID
        await setDoc(doc(db, "Users", user.uid), {
            uid: user.uid,
            fullName: fullName.trim(),
            email: email.trim().toLowerCase(),
            role: "Admin",
            status: "Active",
            createdAt: serverTimestamp(),
        });



        // Sign out immediately to prevent auto-login
        await signOut(auth);

        return { user };
    } catch (error: any) {
        console.error("Registration Error:", error.message);
        return { error: getFirebaseErrorMessage(error) };
    }
}

/**
 * Registers a new Employee user using Firebase Auth and stores details in Firestore.
 */
export async function registerEmployee(
    fullName: string,
    employeeId: string,
    email: string,
    role: string,
    password: string,
    designation: string,
    employmentType: string
): Promise<{ user?: User; error?: string }> {
    try {
        // 1. Create user in Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Store additional user details in Firestore
        // Document ID is set to the Firebase Auth UID
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            fullName: fullName.trim(),
            employeeId: employeeId.trim(),
            email: email.trim().toLowerCase(),
            role: role,
            designation: designation.trim(),
            employmentType: employmentType,
            createdAt: serverTimestamp(),
        });



        // Sign out immediately to prevent auto-login
        await signOut(auth);

        return { user };
    } catch (error: any) {
        console.error("Employee Registration Error:", error.message);
        return { error: getFirebaseErrorMessage(error) };
    }
}

/**
 * Logs out the current user.
 */
export async function logoutUser(): Promise<{ error?: string }> {
    try {
        await signOut(auth);
        return {};
    } catch (error: any) {
        console.error("Logout Error:", error.message);
        return { error: getFirebaseErrorMessage(error) };
    }
}

/**
 * Registers a new Employee user using a Secondary Firebase App so the current Admin/HR is not logged out.
 */
export async function registerEmployeeByAdmin(
    fullName: string,
    employeeId: string,
    email: string,
    role: string,
    password: string,
    designation: string,
    employmentType: string
): Promise<{ user?: User; error?: string }> {
    try {
        // Initialize a secondary app so we don't log out the current Admin
        const secondaryApp = getApps().find(a => a.name === 'SecondaryApp') || initializeApp(app.options, 'SecondaryApp');
        const secondaryAuth = getFirebaseAuth(secondaryApp);
        const secondaryDb = getFirestore(secondaryApp);

        // 1. Create user in Firebase Authentication using secondary app
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        const user = userCredential.user;

        // 2. Store additional user details in Firestore using secondary db (acts as the new user)
        await setDoc(doc(secondaryDb, "users", user.uid), {
            uid: user.uid,
            fullName: fullName.trim(),
            employeeId: employeeId.trim(),
            email: email.trim().toLowerCase(),
            role: role,
            designation: designation.trim(),
            employmentType: employmentType,
            createdAt: serverTimestamp(),
        });



        // Sign out immediately from secondary auth
        await signOut(secondaryAuth);

        return { user };
    } catch (error: any) {
        console.error("Employee Registration Error:", error.message);
        return { error: getFirebaseErrorMessage(error) };
    }
}
