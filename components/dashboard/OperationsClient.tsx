"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Table as TableIcon, Trash2, Download, Upload, Search } from "lucide-react";
import * as xlsx from "xlsx";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, getDocs, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { useAuth } from "@/components/providers/AuthProvider";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { toast } from "sonner";

export default function OperationsClient() {
    const [view, setView] = useState<"table" | "form">("table");
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [importing, setImporting] = useState(false);
    
    const [statusConfirmModal, setStatusConfirmModal] = useState<{isOpen: boolean, row: any, newStatus: string}>({ isOpen: false, row: null, newStatus: "" });
    const [candidateToDelete, setCandidateToDelete] = useState<any | null>(null);
    const [importSummary, setImportSummary] = useState<string | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { profile } = useAuth();
    
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");
    const [searchQuery, setSearchQuery] = useState("");

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
            const q = query(collection(db, "sales"));
            const snaps = await getDocs(q);
            const fetched = snaps.docs.map(d => ({
                id: d.id,
                ...d.data()
            }));
            setData(fetched);
        } catch (error) {
            console.error("Failed to fetch data from Firestore", error);
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
            await addDoc(collection(db, "sales"), {
                ...payload,
                createdAt: serverTimestamp()
            });

            toast.success("Entry saved successfully!");
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
        } catch (error) {
            console.error("Error saving entry:", error);
            toast.error("Error saving entry.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleStatusChange = async (row: any, newStatus: string) => {
        if (!newStatus) return;
        
        if (newStatus === "Success") {
            setStatusConfirmModal({ isOpen: true, row, newStatus });
        } else {
            // Optimistic update for non-Success statuses
            setData(prev => prev.map(r => r.id === row.id ? { ...r, Status: newStatus } : r));

            if (!row.id) return;
            try {
                const docRef = doc(db, "sales", row.id);
                await updateDoc(docRef, { Status: newStatus });
            } catch (e) {
                console.error("Error updating status", e);
                // Need to reload data to revert if it failed
                const querySnapshot = await getDocs(collection(db, "sales"));
                const fetchedData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setData(fetchedData);
            }
        }
    };

    const handleFeedbackChange = async (row: any, newFeedback: string) => {
        if (row["Feedback"] === newFeedback) return; // No change
        
        // Optimistic update
        setData(prev => prev.map(r => r.id === row.id ? { ...r, Feedback: newFeedback } : r));

        if (!row.id) return;
        try {
            const docRef = doc(db, "sales", row.id);
            await updateDoc(docRef, { Feedback: newFeedback });
        } catch (e) {
            console.error("Error updating feedback", e);
            // Need to reload data to revert if it failed
            const querySnapshot = await getDocs(collection(db, "sales"));
            const fetchedData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setData(fetchedData);
        }
    };

    const confirmStatusChange = async () => {
        const { row, newStatus } = statusConfirmModal;
        if (!row || !newStatus) return;

        setStatusConfirmModal({ isOpen: false, row: null, newStatus: "" });

        // Optimistic update
        setData(prev => prev.map(r => r.id === row.id ? { ...r, Status: newStatus } : r));

        if (!row.id) return;

        try {
            const docRef = doc(db, "sales", row.id);
            await updateDoc(docRef, { Status: newStatus });
        } catch (e) {
            console.error("Error updating status", e);
            fetchData(); // revert on fail
        }
    };

    const handleDelete = (row: any) => {
        setCandidateToDelete(row);
    };

    const executeDeleteCandidate = async () => {
        if (!candidateToDelete || !candidateToDelete.id) return;
        const row = candidateToDelete;
        
        // Optimistic update
        setData(prev => prev.filter(r => r.id !== row.id));

        try {
            const docRef = doc(db, "sales", row.id);
            await deleteDoc(docRef);
            toast.success("Candidate entry removed.");
        } catch (e) {
            console.error("Error deleting candidate", e);
            toast.error("Error deleting candidate.");
            fetchData(); // Revert on failure
        } finally {
            setCandidateToDelete(null);
        }
    };

    const formatDisplayDate = (dateStr: any) => {
        if (!dateStr) return "-";
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString("en-US", { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
    };

    // Filter and sort data
    const filteredData = data.filter((row) => {
        // Search Filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase().replace(/[\s\-_]/g, '');
            const normalize = (val: any) => String(val || "").toLowerCase().replace(/[\s\-_]/g, '');

            const matchesName = normalize(row["Candidate Name "]).includes(query);
            const matchesEmail = normalize(row["Email"]).includes(query);
            const matchesContact = normalize(row["Contact Number"]).includes(query);
            const matchesRole = normalize(row["Job Role"]).includes(query);
            const matchesInternal = normalize(row["Internal Name"]).includes(query);
            const matchesVisa = normalize(row["Visa Status"]).includes(query);
            const matchesLocation = normalize(row["Location"]).includes(query);
            const matchesStatus = normalize(row["Status"]).includes(query);
            const matchesExp = normalize(row["Exp"]).includes(query);
            
            if (!(matchesName || matchesEmail || matchesContact || matchesRole || matchesInternal || matchesVisa || matchesLocation || matchesStatus || matchesExp)) return false;
        }

        if (!startDate && !endDate) return true;
        const rowDateStr = row["Date"];
        if (!rowDateStr) return false;
        
        const rowDate = new Date(rowDateStr);
        if (isNaN(rowDate.getTime())) return false;
        
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

    // Sort data by Date (newest first), then by createdAt (newest first) if dates are equal
    const displayData = [...filteredData].sort((a, b) => {
        const dateA = new Date(a["Date"] || 0).getTime();
        const dateB = new Date(b["Date"] || 0).getTime();
        
        if (dateB !== dateA) {
            return dateB - dateA;
        }

        // Secondary sort by createdAt timestamp
        const createdA = a.createdAt?.seconds || 0;
        const createdB = b.createdAt?.seconds || 0;
        return createdB - createdA;
    });

    // Helper colors
    const getStatusColor = (status: string) => {
        switch (status) {
            case "Interested": return "bg-purple-50 text-purple-700 border-purple-200 focus:ring-purple-500 hover:bg-purple-100";
            case "Not interested": return "bg-rose-50 text-rose-700 border-rose-200 focus:ring-rose-500 hover:bg-rose-100";
            case "Ringing": return "bg-amber-50 text-amber-700 border-amber-200 focus:ring-amber-500 hover:bg-amber-100";
            case "Success": return "bg-emerald-50 text-emerald-700 border-emerald-200 focus:ring-emerald-500 hover:bg-emerald-100";
            default: return "bg-slate-50 text-slate-600 border-slate-200 focus:ring-slate-500 hover:bg-slate-100";
        }
    };

    const getRowBgColor = (status: string, idx: number) => {
        return idx % 2 === 0 ? "bg-white hover:bg-slate-50" : "bg-slate-50 hover:bg-slate-100";
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
            const { id, createdAt, ...rest } = row;
            // Format the date to be readable in Excel
            if (rest["Date"]) {
                const dateObj = new Date(rest["Date"]);
                if (!isNaN(dateObj.getTime())) {
                    rest["Date"] = dateObj.toLocaleDateString("en-US", { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
                }
            }
            return rest;
        });

        const worksheet = xlsx.utils.json_to_sheet(exportData);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, "OperationsData");
        
        // Generate buffer and trigger download
        xlsx.writeFile(workbook, `operations_data_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const workbook = xlsx.read(bstr, { type: "binary" });
                const wsname = workbook.SheetNames[0];
                const ws = workbook.Sheets[wsname];
                const rawData = xlsx.utils.sheet_to_json(ws);

                let newCount = 0;
                let dupCount = 0;
                let invalidCount = 0;

                for (const row of rawData as any[]) {
                    // Check invalid (Must have Candidate Name at least)
                    if (!row["Candidate Name "]) {
                        invalidCount++;
                        continue;
                    }

                    // Check duplicate in `data`
                    const isDuplicate = data.some(d => {
                        const emailMatch = row["Email"] && d["Email"] && d["Email"].toLowerCase() === row["Email"].toLowerCase();
                        const contactMatch = row["Contact Number"] && d["Contact Number"] && String(d["Contact Number"]) === String(row["Contact Number"]);
                        
                        if (emailMatch || contactMatch) return true;
                        
                        if (!row["Email"] && !row["Contact Number"]) {
                             return d["Candidate Name "]?.toLowerCase() === row["Candidate Name "]?.toLowerCase();
                        }
                        return false;
                    });

                    if (isDuplicate) {
                        dupCount++;
                        continue;
                    }

                    // Format date correctly if it's an excel serial number
                    let formattedDate = row["Date"];
                    if (typeof formattedDate === 'number') {
                         formattedDate = new Date(Math.round((formattedDate - 25569)*86400*1000)).toISOString().split('T')[0];
                    }
                    
                    // Default to today if date is blank
                    if (!formattedDate || String(formattedDate).trim() === "") {
                        formattedDate = new Date().toISOString().split('T')[0];
                    }

                    // Insert
                    const payload = {
                        "Date": formattedDate,
                        "Candidate Name ": row["Candidate Name "] || "",
                        "Contact Number": row["Contact Number"] ? String(row["Contact Number"]) : "",
                        "Email": row["Email"] || "",
                        "Visa Status": row["Visa Status"] || "",
                        "Job Role": row["Job Role"] || "",
                        "Exp": row["Exp"] ? String(row["Exp"]) : "",
                        "Location": row["Location"] || "",
                        "Internal Name": row["Internal Name"] || profile?.fullName || profile?.email || "",
                        "Linkedln Profile URL": row["Linkedln Profile URL"] || row["LinkedIn Profile URL"] || "",
                        "Feedback": row["Feedback"] || "",
                        "Status": row["Status"] || row["Feedback"] || "New",
                        createdAt: serverTimestamp()
                    };

                    await addDoc(collection(db, "sales"), payload);
                    newCount++;
                }

                setImportSummary(`Import Complete!\n\nTotal Rows Found: ${rawData.length}\nNew Records Imported: ${newCount}\nDuplicates Skipped: ${dupCount}\nInvalid Rows Skipped: ${invalidCount}`);
                toast.success("Import processing completed!");
                fetchData();
            } catch (error) {
                console.error("Error during import:", error);
                toast.error("Failed to import file. Please check the format.");
            } finally {
                setImporting(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
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
                    <div className="flex flex-wrap items-center gap-3 lg:justify-end flex-1 max-w-full">
                        <div className="relative w-full sm:w-auto flex-1 sm:max-w-[240px]">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-slate-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search candidates..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 py-2 w-full bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
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
                        <div className="flex items-center gap-3">
                            <input 
                                type="file" 
                                accept=".xlsx, .xls" 
                                className="hidden" 
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                            />
                            <button
                                onClick={handleImportClick}
                                disabled={importing}
                                className={`flex items-center gap-2 px-4 py-2.5 ${importing ? 'bg-blue-50 text-blue-400' : 'bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700'} font-semibold text-sm rounded-xl transition-all border border-blue-200 shadow-sm whitespace-nowrap`}
                                title="Import from Excel"
                            >
                                <Download className={`w-4 h-4 ${importing ? 'animate-bounce' : ''}`} />
                                {importing ? "Importing..." : "Import XL"}
                            </button>
                            <button
                                onClick={handleExport}
                                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 font-semibold text-sm rounded-xl transition-all border border-emerald-200 shadow-sm whitespace-nowrap"
                                title="Export as Excel"
                            >
                                <Upload className="w-4 h-4" />
                                Export XL
                            </button>
                        </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Content Area */}
            {view === "table" ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-auto h-[600px] max-h-[calc(100vh-280px)] custom-scrollbar pb-6">
                        <table className="w-full text-sm text-left whitespace-nowrap relative">
                            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase text-slate-500 font-bold tracking-wider sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4">Candidate Name</th>
                                    <th className="px-6 py-4">Contact Number</th>
                                    <th className="px-6 py-4">Email</th>
                                    <th className="px-6 py-4">Visa Status</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Feedback</th>
                                    <th className="px-6 py-4">Job Role</th>
                                    <th className="px-6 py-4">Exp</th>
                                    <th className="px-6 py-4">Location</th>
                                    <th className="px-6 py-4">Internal Name</th>
                                    <th className="px-6 py-4">LinkedIn Profile URL</th>
                                    {profile?.role === "Admin" && (
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    )}
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
                                        <tr key={idx} className={`transition-colors group ${getRowBgColor(row["Status"], idx)}`}>
                                            <td className="px-6 py-4 text-sm text-slate-600 font-medium whitespace-nowrap">
                                                {formatDisplayDate(row["Date"])}
                                            </td>
                                            <td className="px-6 py-4 font-semibold text-slate-900 whitespace-nowrap">
                                                {row["Candidate Name "] || "-"}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">
                                                {row["Contact Number"] || "-"}
                                            </td>
                                            <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                                                {row["Email"] || "-"}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide border ${getVisaColor(row["Visa Status"])}`}>
                                                    {row["Visa Status"] || "-"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="relative w-full min-w-[140px]">
                                                    <select 
                                                        value={row["Status"] || ""} 
                                                        onChange={(e) => {
                                                            if (row["Status"] === "Success") return;
                                                            handleStatusChange(row, e.target.value);
                                                        }}
                                                        disabled={row["Status"] === "Success"}
                                                        className={`appearance-none text-xs font-semibold rounded-lg border px-3 py-1.5 pr-8 transition-all outline-none w-full shadow-sm ${getStatusColor(row["Status"])} ${row["Status"] === "Success" ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                                                    >
                                                        <option value="" className="text-slate-700 bg-white font-medium">Select Status</option>
                                                        <option value="Interested" className="text-slate-700 bg-white font-medium">Interested</option>
                                                        <option value="Not interested" className="text-slate-700 bg-white font-medium">Not interested</option>
                                                        <option value="Ringing" className="text-slate-700 bg-white font-medium">Ringing</option>
                                                        <option value="Success" className="text-slate-700 bg-white font-medium">Success</option>
                                                    </select>
                                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-current opacity-60">
                                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4"></path></svg>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 align-top">
                                                <textarea 
                                                    defaultValue={row["Feedback"] || ""}
                                                    onBlur={(e) => handleFeedbackChange(row, e.target.value)}
                                                    className="text-sm text-slate-700 bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 rounded-md p-2 min-w-[200px] max-w-[350px] resize-y transition-all outline-none w-full shadow-sm"
                                                    rows={2}
                                                    placeholder="Click to add feedback..."
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-slate-700 whitespace-normal min-w-[150px] max-w-[250px] break-words">
                                                    {row["Job Role"] || "-"}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                                                {row["Exp"] || "-"}
                                            </td>
                                            <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                                                {row["Location"] || "-"}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-slate-700 whitespace-nowrap">
                                                {row["Internal Name"] || "-"}
                                            </td>
                                            <td className="px-6 py-4 text-xs text-blue-600 hover:underline whitespace-nowrap">
                                                {row["Linkedln Profile URL"] ? (
                                                    <a href={row["Linkedln Profile URL"]} target="_blank" rel="noopener noreferrer">
                                                        {String(row["Linkedln Profile URL"]).substring(0, 30)}...
                                                    </a>
                                                ) : "-"}
                                            </td>
                                            {profile?.role === "Admin" && (
                                                <td className="px-6 py-4 text-right">
                                                    <button 
                                                        onClick={() => handleDelete(row)}
                                                        className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                                        title="Delete candidate"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 hover:border-black transition-colors p-6 md:p-8 max-w-5xl mx-auto">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5">
                            {/* Row 1 */}
                            <div className="space-y-2">
                                <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Date</label>
                                <input 
                                    type="date" 
                                    name="Date"
                                    value={formData["Date"]}
                                    onChange={handleInputChange}
                                    className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm" 
                                    required 
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Candidate name <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" 
                                    name="Candidate Name "
                                    value={formData["Candidate Name "]}
                                    onChange={handleInputChange}
                                    placeholder="e.g. John Doe"
                                    className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm" 
                                    required 
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Contact number</label>
                                <input 
                                    type="text" 
                                    name="Contact Number"
                                    value={formData["Contact Number"]}
                                    onChange={handleInputChange}
                                    placeholder="e.g. +1 234 567 890"
                                    className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm" 
                                />
                            </div>

                            {/* Row 2 */}
                            <div className="space-y-2">
                                <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Email address</label>
                                <input 
                                    type="email" 
                                    name="Email"
                                    value={formData["Email"]}
                                    onChange={handleInputChange}
                                    placeholder="john@example.com"
                                    className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm" 
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Visa status</label>
                                <div className="relative w-full">
                                    <select 
                                        name="Visa Status"
                                        value={formData["Visa Status"]}
                                        onChange={handleInputChange}
                                        className="appearance-none w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-2.5 pr-10 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm cursor-pointer"
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
                                <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Job role</label>
                                <input 
                                    type="text" 
                                    name="Job Role"
                                    value={formData["Job Role"]}
                                    onChange={handleInputChange}
                                    placeholder="e.g. Software Engineer"
                                    className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm" 
                                />
                            </div>

                            {/* Row 3 */}
                            <div className="space-y-2">
                                <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Experience (years)</label>
                                <input 
                                    type="text" 
                                    name="Exp"
                                    value={formData["Exp"]}
                                    onChange={handleInputChange}
                                    placeholder="e.g. 5"
                                    className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm" 
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Location</label>
                                <input 
                                    type="text" 
                                    name="Location"
                                    value={formData["Location"]}
                                    onChange={handleInputChange}
                                    placeholder="e.g. New York, NY"
                                    className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm" 
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">LinkedIn URL</label>
                                <input 
                                    type="url" 
                                    name="Linkedln Profile URL"
                                    value={formData["Linkedln Profile URL"]}
                                    onChange={handleInputChange}
                                    placeholder="https://linkedin.com/in/..."
                                    className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm" 
                                />
                            </div>

                            {/* Full Width Row */}
                            <div className="space-y-2 md:col-span-3">
                                <label className="block mb-1.5 text-[10px] font-bold text-slate-600 tracking-[0.2em] uppercase">Feedback</label>
                                <textarea 
                                    name="Feedback"
                                    value={formData["Feedback"]}
                                    onChange={handleInputChange}
                                    rows={2}
                                    placeholder="Any additional feedback or notes..."
                                    className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm shadow-sm resize-none" 
                                ></textarea>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 pt-6 border-t border-slate-100 mt-6">
                            <button 
                                type="submit" 
                                disabled={submitting}
                                className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors disabled:opacity-70 flex items-center gap-2 shadow-md hover:shadow-lg"
                            >
                                {submitting ? "Saving..." : "Save entry"}
                            </button>
                            <button 
                                type="button" 
                                onClick={() => setView("table")}
                                className="px-6 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm hover:shadow-md"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}
            {statusConfirmModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Confirm Status Change</h3>
                            <p className="text-slate-500 text-sm">
                                Are you sure you want to change the status to <span className="font-bold text-slate-800">"{statusConfirmModal.newStatus}"</span>? This action cannot be undone.
                            </p>
                        </div>
                        <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-100">
                            <button 
                                onClick={() => setStatusConfirmModal({ isOpen: false, row: null, newStatus: "" })}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmStatusChange}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={!!candidateToDelete}
                onClose={() => setCandidateToDelete(null)}
                onConfirm={executeDeleteCandidate}
                title="Delete Candidate Record"
                description={`Are you sure you want to delete "${candidateToDelete?.["Candidate Name "] || candidateToDelete?.["Internal Name"] || "this record"}"? This action cannot be undone.`}
                confirmText="Delete"
                variant="danger"
            />

            <ConfirmModal
                isOpen={!!importSummary}
                onClose={() => setImportSummary(null)}
                onConfirm={() => setImportSummary(null)}
                title="Import Summary"
                description={
                  <div className="whitespace-pre-line font-mono text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    {importSummary}
                  </div>
                }
                confirmText="OK"
                cancelText="Close"
                variant="success"
            />
        </div>
    );
}
