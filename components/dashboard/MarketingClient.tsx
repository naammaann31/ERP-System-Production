"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Table as TableIcon, Trash2, Download, Upload, Search, Save, X } from "lucide-react";
import * as xlsx from "xlsx";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, deleteDoc, doc, addDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { useAuth } from "@/components/providers/AuthProvider";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

interface MarketingClientProps {
    restrictToUser?: boolean;
    filterByUid?: string;
}

export default function MarketingClient({ restrictToUser = false, filterByUid }: MarketingClientProps) {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    
    // Inline Add State
    const [isAddingNew, setIsAddingNew] = useState(false);
    
    const createEmptyRow = () => {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        
        return {
            id: Math.random().toString(36).substr(2, 9),
            CandidateName: "",
            Date: `${yyyy}-${mm}-${dd}`,
            CompanyName: "",
            Link: ""
        };
    };
    
    const [newRows, setNewRows] = useState([createEmptyRow()]);
    const [savingRow, setSavingRow] = useState(false);

    const [candidateToDelete, setCandidateToDelete] = useState<any | null>(null);
    const [importSummary, setImportSummary] = useState<string | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { profile } = useAuth();
    
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");
    const [searchQuery, setSearchQuery] = useState("");
    const [visibleCount, setVisibleCount] = useState(50);

    useEffect(() => {
        setVisibleCount(50);
    }, [searchQuery, startDate, endDate]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "marketing"));
            const snaps = await getDocs(q);
            const fetched = snaps.docs.map(d => ({
                id: d.id,
                ...d.data()
            })) as any[];

            let finalData = fetched;
            if (filterByUid) {
                finalData = fetched.filter(d => d["userId"] === filterByUid);
            } else if (restrictToUser && profile?.role !== "Admin") {
                const userName = profile?.fullName?.toLowerCase() || "";
                finalData = fetched.filter(d => 
                    d["Name"]?.toLowerCase() === userName ||
                    d["Name"]?.toLowerCase().includes(userName) ||
                    d["marketing"]?.toLowerCase() === userName ||
                    d["userId"] === profile?.uid
                );
            }

            setData(finalData);
        } catch (error) {
            console.error("Failed to fetch data from Firestore", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (row: any) => {
        setCandidateToDelete(row);
    };

    const executeDeleteCandidate = async () => {
        if (!candidateToDelete || !candidateToDelete.id) return;
        const row = candidateToDelete;
        
        setData(prev => prev.filter(r => r.id !== row.id));

        try {
            const docRef = doc(db, "marketing", row.id);
            await deleteDoc(docRef);
            toast.success("Record removed.");
        } catch (e) {
            console.error("Error deleting record", e);
            toast.error("Error deleting record.");
            fetchData();
        } finally {
            setCandidateToDelete(null);
        }
    };

    const updateNewRow = (id: string, field: string, value: string) => {
        setNewRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const handleSaveNewRows = async () => {
        const validRows = newRows.filter(r => r.CompanyName.trim() !== "");
        
        if (validRows.length === 0) {
            toast.error("Please enter at least one Company Name");
            return;
        }

        setSavingRow(true);
        try {
            const addedPayloads: any[] = [];
            
            for (const row of validRows) {
                const payload = {
                    "Name": row.CandidateName || "Unknown Candidate",
                    "marketing": profile?.fullName || "rohit",
                    "userId": profile?.uid || "",
                    "Date": row.Date,
                    "Company Name": row.CompanyName,
                    "Link": row.Link,
                    createdAt: serverTimestamp()
                };

                const docRef = await addDoc(collection(db, "marketing"), payload);
                addedPayloads.push({ id: docRef.id, ...payload, createdAt: { seconds: Date.now() / 1000 } });
            }
            
            // Optimistic Update
            setData(prev => [...addedPayloads, ...prev]);
            
            toast.success(`Successfully saved ${validRows.length} entries!`);
            
            // Reset state
            setNewRows([createEmptyRow()]);
            setIsAddingNew(false);
            
        } catch (error) {
            console.error("Error adding rows:", error);
            toast.error("Failed to save entries");
        } finally {
            setSavingRow(false);
        }
    };

    const formatDisplayDate = (dateStr: any) => {
        if (!dateStr) return "-";
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString("en-US", { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
    };

    const filteredData = data.filter((row) => {
        if (searchQuery) {
            const query = searchQuery.toLowerCase().replace(/[\s\-_]/g, '');
            const normalize = (val: any) => String(val || "").toLowerCase().replace(/[\s\-_]/g, '');

            const matchesName = normalize(row["Name"]).includes(query);
            const matchesCompany = normalize(row["Company Name"]).includes(query);
            
            if (!(matchesName || matchesCompany)) return false;
        }

        if (!startDate && !endDate) return true;
        const rowDateStr = row["Date"];
        if (!rowDateStr) return false;
        
        let rowDate = new Date(rowDateStr);
        if (isNaN(rowDate.getTime()) && typeof rowDateStr === 'string') {
            const parts = rowDateStr.split('/');
            if (parts.length === 3) {
                rowDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            }
        }
        
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

    const displayData = [...filteredData].sort((a, b) => {
        const createdA = a.createdAt?.seconds || 0;
        const createdB = b.createdAt?.seconds || 0;
        return createdB - createdA;
    });

    const handleExport = () => {
        const exportData = displayData.map(row => {
            return {
                "Name": row["Name"] || "",
                "date": row["Date"] || "",
                "company name": row["Company Name"] || "",
                "link": row["Link"] || ""
            };
        });

        const worksheet = xlsx.utils.json_to_sheet(exportData);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, "MarketingData");
        
        xlsx.writeFile(workbook, `marketing_data_${new Date().toISOString().split('T')[0]}.xlsx`);
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
                
                const rawData = xlsx.utils.sheet_to_json(ws, { defval: "", blankrows: true });

                let newCount = 0;
                let dupCount = 0;
                let invalidCount = 0;

                let batch = writeBatch(db);
                let batchCount = 0;

                for (const row of rawData as any[]) {
                    const originalName = row["__EMPTY"] || row["Name"] || row["name"] || "";
                    let date = row["date "] || row["date"] || row["Date"] || "";
                    const company = row["company name"] || row["Company Name"] || "";
                    const link = row["link"] || row["Link"] || "";

                    if (typeof date === 'number') {
                         date = new Date(Math.round((date - 25569)*86400*1000)).toISOString().split('T')[0];
                    }
                    
                    if (!date || String(date).trim() === "") {
                        date = new Date().toISOString().split('T')[0];
                    }

                    const payload = {
                        "Name": originalName || "Unknown Candidate",
                        "marketing": profile?.fullName || "rohit",
                        "Date": date,
                        "Company Name": company,
                        "Link": link,
                        "userId": profile?.uid || "",
                        createdAt: serverTimestamp()
                    };

                    const newDocRef = doc(collection(db, "marketing"));
                    batch.set(newDocRef, payload);
                    newCount++;
                    batchCount++;
                    
                    if (batchCount === 490) {
                        await batch.commit();
                        batch = writeBatch(db);
                        batchCount = 0;
                    }
                }
                
                if (batchCount > 0) {
                    await batch.commit();
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

    const [selectedRows, setSelectedRows] = useState<string[]>([]);
    const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState<string | null>(null);

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedRows(displayData.slice(0, visibleCount).map(r => r.id));
        } else {
            setSelectedRows([]);
        }
    };

    const handleSelectRow = (id: string) => {
        setSelectedRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
    };

    const handleBulkDelete = async () => {
        try {
            const promises = selectedRows.map(rowId => deleteDoc(doc(db, "marketing", rowId)));
            await Promise.all(promises);
            setData(prev => prev.filter(r => !selectedRows.includes(r.id)));
            setSelectedRows([]);
            setBulkDeleteModalOpen(false);
            toast.success("Selected records deleted successfully.");
        } catch (error) {
            console.error("Error deleting multiple records:", error);
            toast.error("Error deleting records.");
        }
    };

    const handleDeleteSingle = async () => {
        if (!recordToDelete) return;
        try {
            await deleteDoc(doc(db, "marketing", recordToDelete));
            setData(prev => prev.filter(r => r.id !== recordToDelete));
            setDeleteModalOpen(false);
            setRecordToDelete(null);
            toast.success("Record deleted successfully.");
        } catch (error) {
            console.error("Error deleting record:", error);
            toast.error("Error deleting record.");
        }
    };

    return (
        <>
            <Card className="border-0 shadow-sm ring-1 ring-slate-200/60 overflow-hidden bg-white">
                {/* Header Bar - Sales Style */}
                <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-blue-50/50">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            Marketing Leads Data
                            <span className="bg-blue-200 text-blue-800 text-xs py-0.5 px-2.5 rounded-full font-semibold">
                                {displayData.length}
                            </span>
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Real-time candidate data generated by the marketing team.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0 justify-end flex-1">
                        <div className="relative w-full sm:w-auto flex-1 sm:max-w-xs min-w-[200px]">
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
                            {profile?.role === "Admin" && selectedRows.length > 0 && (
                                <button
                                    onClick={() => setBulkDeleteModalOpen(true)}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 font-semibold text-sm rounded-xl transition-all border border-red-200 shadow-sm whitespace-nowrap"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete ({selectedRows.length})
                                </button>
                            )}
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

                {/* Table */}
                <div className="overflow-auto h-[600px] max-h-[calc(100vh-280px)] custom-scrollbar pb-6">
                    <table className="w-full text-sm text-left relative">
                        <thead className="text-xs text-slate-500 uppercase bg-white border-b border-slate-100 sticky top-0 z-10 shadow-sm">
                            <tr>
                                {profile?.role === "Admin" && (
                                    <th className="px-6 py-4 font-semibold whitespace-nowrap w-12">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                            checked={displayData.length > 0 && selectedRows.length === displayData.slice(0, visibleCount).length}
                                            onChange={handleSelectAll}
                                        />
                                    </th>
                                )}
                                <th className="px-6 py-4 font-semibold whitespace-nowrap">Candidate Name</th>
                                <th className="px-6 py-4 font-semibold whitespace-nowrap">Date</th>
                                <th className="px-6 py-4 font-semibold whitespace-nowrap">Company Name</th>
                                <th className="px-6 py-4 font-semibold whitespace-nowrap">Link</th>
                                <th className="px-6 py-4 font-semibold whitespace-nowrap">Added By</th>
                                {profile?.role === "Admin" && (
                                    <th className="px-6 py-4 font-semibold whitespace-nowrap text-right">Actions</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {/* Inline Add Rows */}
                            {isAddingNew && (
                                <>
                                    {newRows.map((row, index) => (
                                        <tr key={row.id} className="bg-slate-50/30 border-b border-slate-200/60 hover:bg-slate-50/80 transition-colors group">
                                            {profile?.role === "Admin" && <td className="px-6 py-4"></td>}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <input
                                                    type="text"
                                                    placeholder="Candidate Name..."
                                                    value={row.CandidateName || ""}
                                                    onChange={(e) => updateNewRow(row.id, "CandidateName", e.target.value)}
                                                    className="w-full text-sm px-4 py-2.5 border border-slate-200 shadow-sm rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 bg-white text-slate-900 placeholder:text-slate-400 transition-all hover:border-slate-300"
                                                    autoFocus={index === 0}
                                                />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <input
                                                    type="date"
                                                    value={row.Date}
                                                    onChange={(e) => updateNewRow(row.id, "Date", e.target.value)}
                                                    className="w-full text-sm px-4 py-2.5 border border-slate-200 shadow-sm rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 bg-white text-slate-900 transition-all hover:border-slate-300"
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <input
                                                    type="text"
                                                    placeholder="Enter company name..."
                                                    value={row.CompanyName}
                                                    onChange={(e) => updateNewRow(row.id, "CompanyName", e.target.value)}
                                                    className="w-full text-sm px-4 py-2.5 border border-slate-200 shadow-sm rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 bg-white text-slate-900 placeholder:text-slate-400 transition-all hover:border-slate-300"
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <input
                                                    type="url"
                                                    placeholder="https://example.com/job"
                                                    value={row.Link}
                                                    onChange={(e) => updateNewRow(row.id, "Link", e.target.value)}
                                                    className="w-full text-sm px-4 py-2.5 border border-slate-200 shadow-sm rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 bg-white text-slate-900 placeholder:text-slate-400 transition-all hover:border-slate-300"
                                                />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-slate-700">{profile?.fullName || "Unknown"}</span>
                                                    <span className="text-[10px] text-slate-400 mt-0.5 tracking-wide uppercase">(Auto-tagged)</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right whitespace-nowrap">
                                                {newRows.length > 1 && (
                                                    <button 
                                                        onClick={() => setNewRows(newRows.filter(r => r.id !== row.id))}
                                                        className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Remove row"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="bg-slate-50/50 border-b border-slate-200/60">
                                        <td colSpan={profile?.role === "Admin" ? 7 : 6} className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-between">
                                                <button 
                                                    onClick={() => setNewRows([...newRows, createEmptyRow()])}
                                                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-bold px-4 py-2.5 rounded-xl hover:bg-blue-50 transition-colors border border-transparent hover:border-blue-100"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                    Add another row
                                                </button>
                                                <div className="flex items-center gap-3">
                                                    <button 
                                                        onClick={() => setIsAddingNew(false)}
                                                        className="text-sm text-slate-500 hover:text-slate-700 font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-200/50 transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button 
                                                        onClick={handleSaveNewRows}
                                                        disabled={savingRow}
                                                        className="flex items-center gap-2 text-white bg-slate-900 hover:bg-black px-6 py-2.5 rounded-xl transition-all font-semibold text-sm shadow-md hover:shadow-lg disabled:opacity-70"
                                                    >
                                                        <Save className="w-4 h-4" />
                                                        {savingRow ? "Saving..." : "Save Entries"}
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                </>
                            )}

                            {!isAddingNew && (
                                loading ? (
                                    <tr>
                                        <td colSpan={profile?.role === "Admin" ? 7 : 5} className="px-6 py-12 text-center text-slate-500 font-medium">
                                            Loading data...
                                        </td>
                                    </tr>
                                ) : displayData.length === 0 ? (
                                    <tr>
                                        <td colSpan={profile?.role === "Admin" ? 7 : 5} className="px-6 py-12 text-center text-slate-500 font-medium">
                                            No data available
                                        </td>
                                    </tr>
                                ) : (
                                    displayData.slice(0, visibleCount).map((row, idx) => (
                                        <tr key={row.id || idx} className={`hover:bg-slate-100 transition-colors group ${selectedRows.includes(row.id) ? 'bg-blue-50/30' : idx % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                                            {profile?.role === "Admin" && (
                                                <td className="px-6 py-4">
                                                    <input 
                                                        type="checkbox" 
                                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                        checked={selectedRows.includes(row.id)}
                                                        onChange={() => handleSelectRow(row.id)}
                                                    />
                                                </td>
                                            )}
                                            <td className="px-6 py-4 font-semibold text-slate-900 whitespace-nowrap">
                                                {row["Name"] || "-"}
                                            </td>
                                            <td className="px-6 py-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                                                {formatDisplayDate(row["Date"])}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">
                                                {row["Company Name"] || "-"}
                                            </td>
                                            <td className="px-6 py-4 text-xs text-blue-600 hover:underline whitespace-nowrap">
                                                {row["Link"] ? (
                                                    <a href={row["Link"]} target="_blank" rel="noopener noreferrer">
                                                        {String(row["Link"]).substring(0, 40)}{String(row["Link"]).length > 40 ? '...' : ''}
                                                    </a>
                                                ) : "-"}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-slate-700 whitespace-nowrap">
                                                {row["marketing"] || "-"}
                                            </td>
                                            {profile?.role === "Admin" && (
                                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                                    <button 
                                                        onClick={() => {
                                                            setRecordToDelete(row.id);
                                                            setDeleteModalOpen(true);
                                                        }}
                                                        className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                                        title="Delete record"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )
                            )}
                        </tbody>
                    </table>
                    
                    {!loading && !isAddingNew && visibleCount < displayData.length && (
                        <div className="py-6 flex justify-center border-t border-slate-100">
                            <button
                                onClick={() => setVisibleCount(prev => prev + 100)}
                                className="px-6 py-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 font-semibold text-sm rounded-xl transition-all border border-blue-100 shadow-sm"
                            >
                                Load More Candidates ({displayData.length - visibleCount} remaining)
                            </button>
                        </div>
                    )}
                </div>

                {/* Add Data Toggle Button */}
                <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end">
                    <button
                        onClick={() => setIsAddingNew(!isAddingNew)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${isAddingNew ? 'bg-slate-200 text-slate-700' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm'}`}
                    >
                        <Plus className="w-4 h-4" />
                        {isAddingNew ? "Cancel Adding" : "Add Data"}
                    </button>
                </div>
            </Card>

            {/* Single Delete Modal */}
            {deleteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-6">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                                <Trash2 className="w-6 h-6 text-red-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Record</h3>
                            <p className="text-slate-500 text-sm">
                                Are you sure you want to delete this record? This action cannot be undone and will permanently remove this data.
                            </p>
                        </div>
                        <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-100">
                            <button 
                                onClick={() => {
                                    setDeleteModalOpen(false);
                                    setRecordToDelete(null);
                                }}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleDeleteSingle}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors"
                            >
                                Yes, delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Delete Modal */}
            {bulkDeleteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-6">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                                <Trash2 className="w-6 h-6 text-red-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Delete {selectedRows.length} Records</h3>
                            <p className="text-slate-500 text-sm">
                                Are you sure you want to delete {selectedRows.length} records? This action cannot be undone and will permanently remove this data.
                            </p>
                        </div>
                        <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-100">
                            <button 
                                onClick={() => setBulkDeleteModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleBulkDelete}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors"
                            >
                                Yes, delete all
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
        </>
    );
}
