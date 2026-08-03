"use client";

import { ReactNode, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { AlertTriangle, HelpCircle, Info, CheckCircle2, X } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string | ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info" | "success";
  isLoading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  isLoading = false,
}: ConfirmModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (variant) {
      case "danger":
        return <AlertTriangle className="w-6 h-6 text-red-600" />;
      case "warning":
        return <AlertTriangle className="w-6 h-6 text-amber-500" />;
      case "success":
        return <CheckCircle2 className="w-6 h-6 text-emerald-600" />;
      default:
        return <Info className="w-6 h-6 text-blue-600" />;
    }
  };

  const getBadgeStyle = () => {
    switch (variant) {
      case "danger":
        return "bg-red-50 border-red-100";
      case "warning":
        return "bg-amber-50 border-amber-100";
      case "success":
        return "bg-emerald-50 border-emerald-100";
      default:
        return "bg-blue-50 border-blue-100";
    }
  };

  const getButtonVariant = () => {
    switch (variant) {
      case "danger":
        return "bg-red-600 hover:bg-red-700 text-white";
      case "warning":
        return "bg-amber-600 hover:bg-amber-700 text-white";
      case "success":
        return "bg-emerald-600 hover:bg-emerald-700 text-white";
      default:
        return "bg-blue-600 hover:bg-blue-700 text-white";
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 text-left relative"
        >
          <button
            onClick={onClose}
            disabled={isLoading}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${getBadgeStyle()}`}>
                {getIcon()}
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <h3 className="text-lg font-bold text-slate-800 tracking-tight">
                  {title}
                </h3>
                {description && (
                  <div className="text-sm text-slate-500 font-medium mt-1.5 leading-relaxed">
                    {description}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-slate-50/70 px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-xl border-slate-200 font-bold hover:bg-white text-slate-600 px-5 text-xs h-10 shadow-sm"
            >
              {cancelText}
            </Button>
            <Button
              type="button"
              onClick={() => onConfirm()}
              disabled={isLoading}
              className={`rounded-xl font-bold px-5 text-xs h-10 shadow-sm transition-all active:scale-95 ${getButtonVariant()}`}
            >
              {isLoading ? "Processing..." : confirmText}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
