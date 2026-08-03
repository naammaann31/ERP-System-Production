"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { registerAdmin } from "@/lib/auth";
import { useAuth } from "@/components/providers/AuthProvider";
import { toast } from "sonner";
import { User as UserIcon, Mail, Lock, ArrowRight } from "lucide-react";
import Image from "next/image";

export default function RegisterPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!authLoading && user) {
            router.replace("/dashboard");
        }
    }, [user, authLoading, router]);

    const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
        if (user && !authLoading) return;
        e.preventDefault();
        setError("");

        if (!fullName || !email || !password || !confirmPassword) {
            setError("All fields are required.");
            return;
        }

        if (password.length < 8) {
            setError("Password must be at least 8 characters long.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);

        const { error: registerError } = await registerAdmin(fullName, email, password);

        if (registerError) {
            setError(registerError);
            setLoading(false);
            return;
        }

        toast.success("Admin account created successfully! Please log in.");
        router.push("/login");
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative z-10 w-full max-w-sm"
        >
            {/* Logo & Branding */}
            <div className="flex flex-col items-center mb-4">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="w-20 h-20 flex items-center justify-center mb-1 drop-shadow-[0_4px_30px_rgba(0,0,0,0.4)]"
                >
                    <Image
                        src="/updated_logo.png"
                        alt="Vectra Group Logo"
                        width={200}
                        height={200}
                        className="object-contain invert brightness-0 scale-[1.6]"
                        priority
                    />
                </motion.div>
                <p className="text-xs text-white/70 tracking-wide font-medium mt-1">
                    Create your admin workspace account
                </p>
            </div>

            {/* Form Card */}
            <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl">
                <form onSubmit={handleRegister} className="space-y-4">
                    {/* Full Name */}
                    <div>
                        <label className="block mb-1 text-[10px] font-bold text-white/80 tracking-[0.2em] uppercase">
                            Full Name
                        </label>
                        <div className="relative">
                            <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                            <input
                                type="text"
                                placeholder="John Doe"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 text-white placeholder-white/40 rounded-xl pl-11 pr-4 py-2.5 focus:outline-none focus:border-white/30 transition-all text-sm shadow-inner"
                                required
                            />
                        </div>
                    </div>

                    {/* Corporate Email */}
                    <div>
                        <label className="block mb-1 text-[10px] font-bold text-white/80 tracking-[0.2em] uppercase">
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
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div>
                        <label className="block mb-1 text-[10px] font-bold text-white/80 tracking-[0.2em] uppercase">
                            Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                            <input
                                type="password"
                                placeholder="Min. 8 characters"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 text-white placeholder-white/40 rounded-xl pl-11 pr-4 py-2.5 focus:outline-none focus:border-white/30 transition-all text-sm shadow-inner"
                                required
                            />
                        </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label className="block mb-1 text-[10px] font-bold text-white/80 tracking-[0.2em] uppercase">
                            Confirm Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                            <input
                                type="password"
                                placeholder="Re-enter password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 text-white placeholder-white/40 rounded-xl pl-11 pr-4 py-2.5 focus:outline-none focus:border-white/30 transition-all text-sm shadow-inner"
                                required
                            />
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
                                Creating Account...
                            </>
                        ) : (
                            <>
                                Register Admin Account
                                <ArrowRight className="h-4 w-4" />
                            </>
                        )}
                    </button>

                    <p className="text-center text-xs text-white/60 pt-2">
                        Already have an account?{" "}
                        <Link href="/login" className="text-blue-400 hover:underline font-medium">
                            Log in
                        </Link>
                    </p>
                </form>
            </div>

            {/* Footer */}
            <p className="text-center text-[11px] text-white/25 mt-4 tracking-wider uppercase">
                © {new Date().getFullYear()} Vectra Group CRM · Strictly Confidential
            </p>
        </motion.div>
    );
}
