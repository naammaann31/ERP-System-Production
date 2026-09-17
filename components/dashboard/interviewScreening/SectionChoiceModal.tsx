"use client";

import { motion } from "framer-motion";
import { Section, StagedSectionChoice } from "@/lib/interviewScreeningExcelImport";

/**
 * Shown only when an imported file is one bare table with no
 * Interview/Screening headers to route it by. `onChoose` receives the
 * staged rows with `section` already set to whichever button was clicked.
 */
export default function SectionChoiceModal({
    staged,
    onChoose,
    onCancel,
}: {
    staged: StagedSectionChoice;
    onChoose: (rows: any[]) => void;
    onCancel: () => void;
}) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100"
            >
                <div className="bg-slate-50/50 px-6 py-5 border-b border-slate-100">
                    <h2 className="text-xl font-black text-slate-800 tracking-tight">Which table?</h2>
                    <p className="text-xs font-semibold text-slate-500 mt-1">
                        <span className="font-mono">{staged.fileName}</span> has no
                        Interview/Screening headers, so it can&apos;t be routed automatically.
                    </p>
                </div>
                <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-600">
                        Put all <span className="font-bold">{staged.rows.length}</span> rows into:
                    </p>
                    <div className="flex gap-3">
                        {(["interview", "screening"] as Section[]).map((s) => (
                            <button
                                key={s}
                                onClick={() => onChoose(staged.rows.map((r) => ({ ...r, section: s })))}
                                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all capitalize ${
                                    staged.guess === s
                                        ? "bg-slate-900 text-white shadow-md hover:bg-slate-800"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={onCancel}
                        className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-wider"
                    >
                        Cancel
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
