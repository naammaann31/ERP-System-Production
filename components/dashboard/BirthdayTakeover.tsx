"use client";

import { useEffect, useState } from "react";
import Confetti from "react-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { X, Gift, Cake } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

export default function BirthdayTakeover() {
  const { profile } = useAuth();
  const [show, setShow] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    // Only run on client
    setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const dateOfBirth = profile?.dateOfBirth;
    if (!dateOfBirth) return;
    
    const checkBirthday = () => {
      const today = new Date();
      const dob = new Date(dateOfBirth);
      
      // If it's the exact month and day
      if (today.getMonth() === dob.getMonth() && today.getDate() === dob.getDate()) {
        // Check if we've already shown it today using localStorage
        const lastShown = localStorage.getItem(`birthday_shown_${profile.uid}`);
        const todayStr = today.toISOString().split('T')[0];
        
        if (lastShown !== todayStr) {
          setShow(true);
          localStorage.setItem(`birthday_shown_${profile.uid}`, todayStr);
        }
      }
    };
    
    checkBirthday();
  }, [profile]);

  if (!show) return null;

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <Confetti
            width={windowSize.width}
            height={windowSize.height}
            recycle={true}
            numberOfPieces={400}
            gravity={0.15}
          />
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setShow(false)}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className="relative bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center overflow-hidden border-2 border-white/20"
            style={{
              background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)"
            }}
          >
            <button 
              onClick={() => setShow(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <motion.div 
              initial={{ rotate: -10, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="mx-auto w-24 h-24 bg-gradient-to-tr from-rose-400 to-orange-400 rounded-full flex items-center justify-center shadow-lg shadow-rose-200 mb-6"
            >
              <Cake className="w-12 h-12 text-white" />
            </motion.div>

            <h2 className="text-3xl font-black text-slate-800 mb-2">
              Happy Birthday, <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-orange-500">
                {profile?.fullName?.split(" ")[0]}!
              </span>
            </h2>
            
            <p className="text-slate-600 font-medium mb-8">
              Wishing you a fantastic day filled with joy, success, and lots of cake! Enjoy your special day! 🎈
            </p>

            <button 
              onClick={() => setShow(false)}
              className="w-full bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-rose-200 hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Gift className="w-5 h-5" />
              Start My Day!
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
