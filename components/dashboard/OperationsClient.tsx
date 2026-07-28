"use client";

import { useState, useEffect } from "react";
import { Plus, Table as TableIcon, Trash2, Download } from "lucide-react";
import * as xlsx from "xlsx-js-style";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/components/providers/AuthProvider";

export default function OperationsClient() {
    const [view, setView] = useState<"table" | "form">("table");
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const { profile } = useAuth();
    
    // Filter states
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");

    const [formData, setFormData] = useState({
        "Date": "",
        "Candidate Name ": "",
        "Contact Number": "",
        "Email": "",
        "Visa Status": "",
        "Job Role": "",
        "Exp": "",
        "Location": "",
        "Internal Name": "",
        "Linkedln Profile URL": "",
        "Feedback": "",
    });


    useEffect(() => {
        if (view === "table") {
            fetchData();
        }
    }, [view]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/operations");
            if (res.ok) {
                const json = await res.json();
                setData(json.map((r: any, idx: number) => ({ ...r, _originalIndex: idx })));
            }
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        
        const payload = {
            ...formData,
            "Internal Name": profile?.fullName || profile?.email || "",
            "Status": "New"
        };

        try {
            const res = await fetch("/api/operations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            
            if (res.ok) {
                // Save to Firestore as well
                try {
                    await addDoc(collection(db, "sales"), {
                        ...payload,
                        createdAt: serverTimestamp()
                    });
                } catch (fsError) {
                    console.error("Firestore save error:", fsError);
                    alert("Entry saved to Excel but failed to save to Firestore.");
                    return;
                }

                alert("Entry saved successfully to both Excel and Firestore!");
                // Reset form
                setFormData({
                    "Date": "",
                    "Candidate Name ": "",
                    "Contact Number": "",
                    "Email": "",
                    "Visa Status": "",
                    "Job Role": "",
                    "Exp": "",
                    "Location": "",
                    "Internal Name": "",
                    "Linkedln Profile URL": "",
                    "Feedback": "",
                });
                setView("table");
            } else {
                alert("Failed to save entry.");
            }
        } catch (error) {
            console.error("Error saving entry:", error);
            alert("Error saving entry.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleStatusChange = async (row: any, newStatus: string) => {
        // Optimistic update
        setData(prev => prev.map(r => {
            if (row._originalIndex !== undefined) {
                return r._originalIndex === row._originalIndex ? { ...r, Status: newStatus } : r;
            }
            // Fallback for hot-reloads where state was preserved
            return (r["Candidate Name "] === row["Candidate Name "] && r["Contact Number"] === row["Contact Number"]) 
                ? { ...r, Status: newStatus } 
                : r;
        }));

        try {
            await fetch("/api/operations", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    rowIndex: row._originalIndex,
                    candidateName: row["Candidate Name "],
                    contactNumber: row["Contact Number"],
                    status: newStatus
                })
            });
            
            const q = query(
                collection(db, "sales"),
                where("Candidate Name ", "==", row["Candidate Name "]),
                where("Contact Number", "==", row["Contact Number"])
            );
            const snaps = await getDocs(q);
            snaps.forEach(async (docSnap) => {
                await updateDoc(docSnap.ref, { Status: newStatus });
            });
        } catch (e) {
            console.error("Error updating status", e);
        }
    };

    const handleDelete = async (row: any) => {
        if (!confirm("Are you sure you want to delete this candidate? This action cannot be undone.")) return;

        // Optimistic update
        setData(prev => prev.filter(r => r._originalIndex !== row._originalIndex));

        try {
            await fetch("/api/operations", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    rowIndex: row._originalIndex,
                    candidateName: row["Candidate Name "],
                    contactNumber: row["Contact Number"]
                })
            });
            
            const q = query(
                collection(db, "sales"),
                where("Candidate Name ", "==", row["Candidate Name "]),
                where("Contact Number", "==", row["Contact Number"])
            );
            const snaps = await getDocs(q);
            snaps.forEach(async (docSnap) => {
                await deleteDoc(docSnap.ref);
            });
        } catch (e) {
            console.error("Error deleting candidate", e);
            alert("Error deleting candidate.");
            fetchData(); // Revert on failure
        }
    };

    // Helper to parse Excel serial date (days since Dec 30, 1899)
    const parseExcelDate = (excelDate: any) => {
        if (!excelDate) return null;
        const num = Number(excelDate);
        if (isNaN(num)) {
            const d = new Date(excelDate);
            return isNaN(d.getTime()) ? null : d;
        }
        // 25569 is Jan 1, 1970
        return new Date((num - 25569) * 86400 * 1000);
    };

    const formatDisplayDate = (excelDate: any) => {
        const d = parseExcelDate(excelDate);
        if (!d) return "-";
        return d.toLocaleDateString("en-US", { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
    };

    // Filter and sort data
    const filteredData = data.filter((row) => {
        if (!startDate && !endDate) return true;
        const rowDate = parseExcelDate(row["Date"]);
        if (!rowDate) return false;
        
        if (startDate) {
            const sDate = new Date(startDate);
            if (rowDate < sDate) return false;
        }
        if (endDate) {
            const eDate = new Date(endDate);
            eDate.setHours(23, 59, 59, 999);
            if (rowDate > eDate) return false;
        }
        return true;
    });

    // Recently added at the top
    const displayData = [...filteredData].reverse();

    // Helper colors
    const getStatusColor = (status: string) => {
        switch (status) {
            case "Interested": return "bg-blue-50 text-blue-700 border-blue-200 focus:ring-blue-500 hover:bg-blue-100";
            case "Not interested": return "bg-rose-50 text-rose-700 border-rose-200 focus:ring-rose-500 hover:bg-rose-100";
            case "Unable to connect": return "bg-amber-50 text-amber-700 border-amber-200 focus:ring-amber-500 hover:bg-amber-100";
            case "Success": return "bg-emerald-50 text-emerald-700 border-emerald-200 focus:ring-emerald-500 hover:bg-emerald-100";
            default: return "bg-slate-50 text-slate-600 border-slate-200 focus:ring-slate-500 hover:bg-slate-100";
        }
    };
    
    const getVisaColor = (visa: string) => {
        if (!visa) return "bg-slate-100 text-slate-600 border-slate-200";
        if (visa.includes("USC") || visa.includes("GC")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
        if (visa.includes("H1B")) return "bg-blue-50 text-blue-700 border-blue-200";
        if (visa.includes("F1")) return "bg-purple-50 text-purple-700 border-purple-200";
        return "bg-slate-50 text-slate-600 border-slate-200";
    };

    const handleExport = () => {
        const exportData = displayData.map(row => {
            const { _originalIndex, ...rest } = row;
            // Format the date to be readable in Excel
            if (rest["Date"]) {
                const dateObj = parseExcelDate(rest["Date"]);
                if (dateObj) {
                    rest["Date"] = dateObj.toLocaleDateString("en-US", { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
                }
            }
            return rest;
        });

        const worksheet = xlsx.utils.json_to_sheet(exportData);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, "Operations");
        
        const filename = (startDate || endDate) 
            ? `Operations_Export_${startDate || 'Start'}_to_${endDate || 'End'}.xlsx`
            : `Operations_Export_All.xlsx`;
            
        xlsx.writeFile(workbook, filename);
    };

    return (
        <div>
            {/* View Toggle and Filters */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
                <div className="flex items-center space-x-2 bg-white p-1 rounded-xl w-fit border border-slate-200">
                    <button
                        onClick={() => setView("table")}
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                            view === "table"
                                ? "bg-slate-900 text-white shadow"
                                : "text-slate-500 hover:text-slate-900"
                        }`}
                    >
                        <TableIcon className="w-4 h-4" />
                        Data ({displayData.length})
                    </button>
                    <button
                        onClick={() => setView("form")}
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                            view === "form"
                                ? "bg-slate-900 text-white shadow"
                                : "text-slate-500 hover:text-slate-900"
                        }`}
                    >
                        <Plus className="w-4 h-4" />
                        Add data
                    </button>
                </div>

                {view === "table" && (
                    <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm overflow-x-auto w-fit">
                            <div className="flex items-center space-x-2 px-2">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">From</span>
                                <input 
                                    type="date" 
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400 text-slate-700 bg-slate-50 transition-colors"
                                />
                            </div>
                            <div className="h-5 w-px bg-slate-200"></div>
                            <div className="flex items-center space-x-2 px-2">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">To</span>
                                <input 
                                    type="date" 
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400 text-slate-700 bg-slate-50 transition-colors"
                                />
                            </div>
                            {(startDate || endDate) && (
                                <button 
                                    onClick={() => { setStartDate(""); setEndDate(""); }}
                                    className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 font-semibold text-sm rounded-xl transition-all border border-emerald-200 shadow-sm whitespace-nowrap"
                            title="Export as Excel"
                        >
                            <Download className="w-4 h-4" />
                            Export XL
                        </button>
                    </div>
                )}
            </div>

            {/* Content Area */}
            {view === "table" ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left whitespace-nowrap">
                            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase text-slate-500 font-bold tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Candidate Details</th>
                                    <th className="px-6 py-4">Date Added</th>
                                    <th className="px-6 py-4">Contact Info</th>
                                    <th className="px-6 py-4">Role & Exp</th>
                                    <th className="px-6 py-4">Visa Status</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Feedback</th>
                                    <th className="px-6 py-4">Recruiter</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-12 text-center text-slate-500 font-medium">
                                            Loading data...
                                        </td>
                                    </tr>
                                ) : displayData.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-12 text-center text-slate-500 font-medium">
                                            No data available
                                        </td>
                                    </tr>
                                ) : (
                                    displayData.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{row["Candidate Name "] || "-"}</span>
                                                    <span className="text-xs text-slate-500 mt-0.5">{row["Email"] || "-"}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                                                {formatDisplayDate(row["Date"])}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-slate-700">{row["Contact Number"] || "-"}</span>
                                                    <span className="text-xs text-slate-500 mt-0.5">{row["Location"] || "-"}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-slate-700 whitespace-normal max-w-[250px]">{row["Job Role"] || "-"}</span>
                                                    <span className="text-xs text-slate-500 mt-0.5">{row["Exp"] ? `${row["Exp"]} years exp` : "-"}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide border ${getVisaColor(row["Visa Status"])}`}>
                                                    {row["Visa Status"] || "-"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="relative w-full min-w-[140px]">
                                                    <select 
                                                        value={row["Status"] || ""} 
                                                        onChange={(e) => handleStatusChange(row, e.target.value)}
                                                        className={`appearance-none cursor-pointer text-xs font-semibold rounded-lg border px-3 py-1.5 pr-8 transition-all outline-none w-full shadow-sm ${getStatusColor(row["Status"])}`}
                                                    >
                                                        <option value="" className="text-slate-700 bg-white font-medium">Select Status</option>
                                                        <option value="Interested" className="text-slate-700 bg-white font-medium">Interested</option>
                                                        <option value="Not interested" className="text-slate-700 bg-white font-medium">Not interested</option>
                                                        <option value="Unable to connect" className="text-slate-700 bg-white font-medium">Unable to connect</option>
                                                        <option value="Success" className="text-slate-700 bg-white font-medium">Success</option>
                                                    </select>
                                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-current opacity-60">
                                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4"></path></svg>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-slate-600 truncate max-w-[150px]" title={row["Feedback"]}>
                                                    {row["Feedback"] || "-"}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-medium text-slate-700 whitespace-nowrap">
                                                    {row["Internal Name"] || "-"}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button 
                                                    onClick={() => handleDelete(row)}
                                                    className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                                    title="Delete candidate"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 max-w-5xl mx-auto">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5">
                            {/* Row 1 */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Date</label>
                                <input 
                                    type="date" 
                                    name="Date"
                                    value={formData["Date"]}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                                    required 
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Candidate name <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" 
                                    name="Candidate Name "
                                    value={formData["Candidate Name "]}
                                    onChange={handleInputChange}
                                    placeholder="e.g. John Doe"
                                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white placeholder:text-slate-400 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                                    required 
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Contact number</label>
                                <input 
                                    type="text" 
                                    name="Contact Number"
                                    value={formData["Contact Number"]}
                                    onChange={handleInputChange}
                                    placeholder="e.g. +1 234 567 890"
                                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white placeholder:text-slate-400 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                                />
                            </div>

                            {/* Row 2 */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Email address</label>
                                <input 
                                    type="email" 
                                    name="Email"
                                    value={formData["Email"]}
                                    onChange={handleInputChange}
                                    placeholder="john@example.com"
                                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white placeholder:text-slate-400 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Visa status</label>
                                <div className="relative w-full">
                                    <select 
                                        name="Visa Status"
                                        value={formData["Visa Status"]}
                                        onChange={handleInputChange}
                                        className="appearance-none w-full px-3 py-2 pr-8 text-sm text-slate-900 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer shadow-sm"
                                    >
                                        <option value="" className="text-slate-400">-- Select Status --</option>
                                        <option value="H1B">H1B</option>
                                        <option value="F1">F1</option>
                                        <option value="F1 STEM OPT">F1 STEM OPT</option>
                                        <option value="GC">GC</option>
                                        <option value="USC">USC</option>
                                        <option value="WP">WP</option>
                                        <option value="Other">Other</option>
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4"></path>
                                        </svg>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Job role</label>
                                <input 
                                    type="text" 
                                    name="Job Role"
                                    value={formData["Job Role"]}
                                    onChange={handleInputChange}
                                    placeholder="e.g. Software Engineer"
                                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white placeholder:text-slate-400 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                                />
                            </div>

                            {/* Row 3 */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Experience (years)</label>
                                <input 
                                    type="text" 
                                    name="Exp"
                                    value={formData["Exp"]}
                                    onChange={handleInputChange}
                                    placeholder="e.g. 5"
                                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white placeholder:text-slate-400 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Location</label>
                                <input 
                                    type="text" 
                                    name="Location"
                                    value={formData["Location"]}
                                    onChange={handleInputChange}
                                    placeholder="e.g. New York, NY"
                                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white placeholder:text-slate-400 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">LinkedIn URL</label>
                                <input 
                                    type="url" 
                                    name="Linkedln Profile URL"
                                    value={formData["Linkedln Profile URL"]}
                                    onChange={handleInputChange}
                                    placeholder="https://linkedin.com/in/..."
                                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white placeholder:text-slate-400 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                                />
                            </div>

                            {/* Full Width Row */}
                            <div className="space-y-2 md:col-span-3">
                                <label className="text-sm font-semibold text-slate-700">Feedback</label>
                                <textarea 
                                    name="Feedback"
                                    value={formData["Feedback"]}
                                    onChange={handleInputChange}
                                    rows={2}
                                    placeholder="Any additional feedback or notes..."
                                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white placeholder:text-slate-400 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none" 
                                ></textarea>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 pt-5 border-t border-slate-100">
                            <button 
                                type="submit" 
                                disabled={submitting}
                                className="px-5 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-70 flex items-center gap-2 shadow-sm"
                            >
                                {submitting ? "Saving..." : "Save entry"}
                            </button>
                            <button 
                                type="button" 
                                onClick={() => setView("table")}
                                className="px-5 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
