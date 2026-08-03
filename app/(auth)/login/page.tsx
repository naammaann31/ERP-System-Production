"use client";

import { useState } from "react";
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getFirebaseErrorMessage } from "@/lib/auth";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setSuccess("");

        try {
            await signInWithEmailAndPassword(auth, email, password);

            toast.success("Login Successful!");

            // Redirect after login
            router.push("/dashboard");
        } catch (err: any) {
            setError(getFirebaseErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!email) {
            setError("Please enter your corporate email to reset your password.");
            setSuccess("");
            return;
        }

        setResetLoading(true);
        setError("");
        setSuccess("");

        try {
            await sendPasswordResetEmail(auth, email);
            setSuccess("Password reset email sent! Please check your inbox.");
        } catch (err: any) {
            setError(getFirebaseErrorMessage(err));
        } finally {
            setResetLoading(false);
        }
    };

    return (
        <>

            {/* Login card */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="relative z-10 w-full max-w-sm"
            >
                {/* Logo & Branding */}
                <div className="flex flex-col items-center mb-5">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="w-24 h-24 flex items-center justify-center mb-1 drop-shadow-[0_4px_30px_rgba(0,0,0,0.4)]"
                    >
                        <Image
                            src="/updated_logo.png"
                            alt="Vectra Group Logo"
                            width={240}
                            height={240}
                            className="object-contain invert brightness-0 scale-[1.7]"
                            priority
                        />
                    </motion.div>

                </div>

                {/* Form Card */}
                <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl">
                    <form onSubmit={handleLogin} className="space-y-5">

                        {/* Corporate Email */}
                        <div>
                            <label className="block mb-1.5 text-[10px] font-bold text-white/80 tracking-[0.2em] uppercase">
                                Corporate Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                                <input
                                    type="email"
                                    placeholder="name@vectragroup.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 text-white placeholder-white/40 rounded-xl pl-11 pr-4 py-2.5 focus:outline-none focus:border-white/30 transition-all text-sm shadow-inner"
                                    required
                                    suppressHydrationWarning
                                />
                            </div>
                        </div>

                        {/* Authentication Key */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[10px] font-bold text-white/80 tracking-[0.2em] uppercase">
                                    Authentication Key
                                </label>
                                <button 
                                    type="button" 
                                    onClick={handleForgotPassword}
                                    disabled={resetLoading}
                                    className="text-[10px] font-bold text-white/80 tracking-wider uppercase hover:text-white transition-colors disabled:opacity-50"
                                >
                                    {resetLoading ? "Sending..." : "Forgot?"}
                                </button>
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 text-white placeholder-white/40 rounded-xl pl-11 pr-10 py-2.5 focus:outline-none focus:border-white/30 transition-all text-sm shadow-inner"
                                    required
                                    suppressHydrationWarning
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-red-500/20 border border-red-400/30 text-red-300 px-4 py-2.5 rounded-xl text-sm"
                            >
                                {error}
                            </motion.div>
                        )}

                        {/* Success Message */}
                        {success && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-green-500/20 border border-green-400/30 text-green-300 px-4 py-2.5 rounded-xl text-sm"
                            >
                                {success}
                            </motion.div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#1e5bfa] hover:bg-blue-600 text-white font-bold py-3 rounded-xl transition-all disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2 tracking-wider uppercase text-xs mt-2 shadow-lg shadow-blue-600/20"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Authenticating...
                                </>
                            ) : (
                                <>
                                    Login to Workspace
                                    <ArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </button>

                    </form>
                </div>

                {/* Footer */}
                <p className="text-center text-[11px] text-white/25 mt-4 tracking-wider uppercase">
                    © {new Date().getFullYear()} Vectra Group CRM · Strictly Confidential
                </p>
            </motion.div>
        </>
    );
}