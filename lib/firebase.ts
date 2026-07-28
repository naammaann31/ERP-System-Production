import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyBsGZ6_av08UJ5fNFWPXnX_FcNqdvS76b0",
    authDomain: "vectra-crm-hr-2026.firebaseapp.com",
    projectId: "vectra-crm-hr-2026",
    storageBucket: "vectra-crm-hr-2026.firebasestorage.app",
    messagingSenderId: "900284396645",
    appId: "1:900284396645:web:0fef31c5084e59b42b428c",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;