"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Table as TableIcon, Trash2, Download, Upload, Search, Save, X } from "lucide-react";
import * as xlsx from "xlsx";
import { createClient } from "@/lib/supabase/client";
import { submitMarketingDailyReport } from "@/app/actions/marketing";
import { marketingRowToUi, marketingUiToRow } from "@/lib/salesMarketingMap";
import { useAuth } from "@/components/providers/AuthProvider";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

interface MarketingClientProps {
    restrictToUser?: boolean;
    filterByUid?: string;
    filterByName?: string;
}


function GenerateReportModal({ isOpen, onClose, profile, startDate, endDate, displayData }: { isOpen: boolean, onClose: () => void, profile: any, startDate: string, endDate: string, displayData: any[] }) {
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ candidates: 0, applications: 0, screenings: 0, interviews: 0, breakdown: [] as {name: string, applications: number}[] });
    const [rtr, setRtr] = useState("");

    useEffect(() => {
        if (!isOpen || !profile) return;
        const fetchStats = async () => {
            const supabase = createClient();
            
            // Applications (Leads in current UI view)
            const applicationsCount = displayData.length;
            
            // Interviews/Screenings based on same date filters
            let query = supabase
                .from("interview_screening")
                .select("stage")
                .eq("created_by", profile.uid);
                
            if (startDate) query = query.gte("date", startDate);
            if (endDate) query = query.lte("date", endDate);
            
            const { data: isData } = await query;
                
            let screenings = 0;
            let interviews = 0;
            if (isData) {
                isData.forEach(r => {
                    const stage = r.stage || "";
                    if (stage.toLowerCase().includes("screening") || stage.toLowerCase().includes("ai")) {
                        screenings++;
                    } else {
                        interviews++;
                    }
                });
            }
            
                        // Number of unique candidates from the leads table view
            const breakdownObj: Record<string, number> = {};
            displayData.forEach(d => {
                const name = d.Name || d.CandidateName || "Unknown";
                breakdownObj[name] = (breakdownObj[name] || 0) + 1;
            });
            const breakdownArray = Object.keys(breakdownObj).map(k => ({ name: k, applications: breakdownObj[k] }));

            setStats({
                candidates: breakdownArray.length, 
                applications: applicationsCount,
                screenings,
                interviews,
                breakdown: breakdownArray
            });
        };
        fetchStats();
    }, [isOpen, profile, startDate, endDate]);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        try {
            setLoading(true);
            const today = new Date().toISOString().split("T")[0];
            
            await submitMarketingDailyReport({
                user_id: profile.uid,
                user_name: profile.fullName || "Unknown",
                report_date: today,
                no_of_candidates: stats.candidates,
                applications: stats.applications,
                rtr_submissions: parseInt(rtr) || 0,
                screenings: stats.screenings,
                interviews: stats.interviews,
                candidate_breakdown: stats.breakdown
            });
            
            toast.success("Daily report sent to Team Lead successfully!");
            onClose();
        } catch (error: any) {
            toast.error(error.message || "Failed to submit report");
        } finally {
            setLoading(false);
        }
    };

return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
                <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/80">
                    <div>
                        <h3 className="font-black text-slate-900 text-lg">Generate Daily Report</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Fill in your daily marketing metrics</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Name</label>
                        <input type="text" value={profile?.fullName || ""} disabled className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 cursor-not-allowed" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">No of Candidates</label>
                            <input type="number" value={stats.candidates} disabled className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 cursor-not-allowed" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Applications</label>
                            <input type="number" value={stats.applications} disabled className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 cursor-not-allowed" />
                        </div>
                        <div className="space-y-1.5 col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">RTR Submissions</label>
                            <input type="number" value={rtr} onChange={e => setRtr(e.target.value)} placeholder="0" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Screenings</label>
                            <input type="number" value={stats.screenings} disabled className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 cursor-not-allowed" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Interviews</label>
                            <input type="number" value={stats.interviews} disabled className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 cursor-not-allowed" />
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-100 bg-slate-50/50">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">Cancel</button>
                    <button type="button" onClick={handleSubmit} disabled={loading} className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm disabled:opacity-50">{loading ? "Sending..." : "Submit to Team Lead"}</button>
                </div>
            </div>
        </div>
    );
}

export default function MarketingClient({ restrictToUser = false, filterByUid, filterByName }: MarketingClientProps) {
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
    const [reportModalOpen, setReportModalOpen] = useState(false);

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
        let isMounted = true;

        fetchData();

        // Live-sync: refetch whenever anyone inserts/updates/deletes a lead.
        // We use a debounce timeout to prevent network flooding (TypeError: Failed to fetch)
        // if thousands of bulk delete/update events arrive at once from Supabase.
        const supabase = createClient();
        let timeoutId: NodeJS.Timeout;
        
        const channel = supabase
            .channel(`marketing_live_${Math.random().toString(36).slice(2)}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "marketing" }, () => {
                if (isMounted) {
                    clearTimeout(timeoutId);
                    timeoutId = setTimeout(() => {
                        if (isMounted) fetchData();
                    }, 500);
                }
            })
            .subscribe();

        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
            supabase.removeChannel(channel);
        };
        // Re-runs once the profile loads, since fetchData filters on it.
    }, [profile?.uid, profile?.role, filterByUid, filterByName]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const supabase = createClient();
            const { data: rows, error } = await supabase
                .from("marketing")
                .select("*")
                .order("date", { ascending: false })
                .order("created_at", { ascending: true });

            if (error) throw error;
            const fetched = (rows || []).map(marketingRowToUi);

            let finalData = fetched;
            if (filterByUid || filterByName) {
                const targetName = filterByName?.toLowerCase() || "";
                finalData = fetched.filter(d =>
                    d["userId"] === filterByUid ||
                    (targetName && (
                        d["Name"]?.toLowerCase() === targetName ||
                        d["marketing"]?.toLowerCase() === targetName
                    ))
                );
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
        } catch (error: any) {
            // Ignore abort errors on navigation
            if (error?.name !== "AbortError") {
                console.error("Failed to fetch marketing data:", error);
            }
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
            const supabase = createClient();
            const { error } = await supabase.from("marketing").delete().eq("id", row.id);
            if (error) throw error;
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
            const supabase = createClient();
            const rowsToInsert = validRows.map(row => marketingUiToRow(
                {
                    "Name": row.CandidateName || "Unknown Candidate",
                    "Date": row.Date,
                    "Company Name": row.CompanyName,
                    "Link": row.Link,
                },
                profile?.uid || null,
                profile?.fullName || "rohit"
            ));

            const { data: inserted, error } = await supabase.from("marketing").insert(rowsToInsert).select();
            if (error) throw error;

            const addedPayloads = (inserted || []).map(marketingRowToUi);

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
        const s = String(dateStr).trim();
        
        let year: number, month: number, day: number;
        
        // Handle DD/MM/YYYY format (from Excel)
        const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (slashMatch) {
            day = parseInt(slashMatch[1]);
            month = parseInt(slashMatch[2]) - 1;
            year = parseInt(slashMatch[3]);
        }
        // Handle YYYY-MM-DD format (from database)
        else if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
            const parts = s.split('-');
            year = parseInt(parts[0]);
            month = parseInt(parts[1]) - 1;
            day = parseInt(parts[2]);
        }
        else {
            return s; // Return as-is if format is unrecognized
        }
        
        const d = new Date(year!, month!, day!);
        if (isNaN(d.getTime())) return s;
        return d.toLocaleDateString("en-US", { year: 'numeric', month: 'short', day: 'numeric' });
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
        const dateA = new Date(a.Date || 0).getTime();
        const dateB = new Date(b.Date || 0).getTime();
        if (dateA !== dateB) {
            return dateB - dateA; // Date DESC (newest at top)
        }
        const createdA = a.createdAt?.seconds || 0;
        const createdB = b.createdAt?.seconds || 0;
        return createdA - createdB; // CreatedAt ASC (Excel top-to-bottom order for identical dates)
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
                const workbook = xlsx.read(bstr, { type: "binary", cellDates: true });
                const wsname = workbook.SheetNames[0];
                const ws = workbook.Sheets[wsname];
                
                const rawData = xlsx.utils.sheet_to_json(ws, { defval: "", blankrows: false, raw: true });

                let newCount = 0;
                let dupCount = 0;
                let invalidCount = 0;

                const supabase = createClient();
                const BATCH_SIZE = 490;
                let pending: any[] = [];

                const flush = async () => {
                    if (pending.length === 0) return;
                    const { error } = await supabase.from("marketing").insert(pending);
                    if (error) throw error;
                    pending = [];
                };

                // Helper to parse various date formats into YYYY-MM-DD
                const parseDate = (raw: any): string => {
                    if (!raw || String(raw).trim() === "") {
                        const today = new Date();
                        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                    }

                    // If it's a Date object (from cellDates: true)
                    if (raw instanceof Date && !isNaN(raw.getTime())) {
                        // Excel parsed DD/MM as MM/DD for ambiguous dates (e.g. 12/08 became Dec 8 instead of Aug 12).
                        // So we swap them back: getMonth() + 1 is the intended day, getDate() is the intended month.
                        const intendedDay = raw.getMonth() + 1;
                        const intendedMonth = raw.getDate();
                        return `${raw.getFullYear()}-${String(intendedMonth).padStart(2, '0')}-${String(intendedDay).padStart(2, '0')}`;
                    }

                    const str = String(raw).trim();

                    // Handle DD/MM/YYYY format (e.g., 21/07/2026 or 03/08/2026)
                    const slashParts = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                    if (slashParts) {
                        const day = slashParts[1].padStart(2, '0');
                        const month = slashParts[2].padStart(2, '0');
                        const year = slashParts[3];
                        return `${year}-${month}-${day}`;
                    }

                    // Handle YYYY-MM-DD (already correct)
                    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
                        return str;
                    }

                    // Fallback: try to parse with Date constructor
                    const d = new Date(str);
                    if (!isNaN(d.getTime())) {
                        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    }

                    // Last resort: return today's date
                    const today = new Date();
                    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                };

                let lastCandidateName = "";
                let lastDate = "";

                for (const row of rawData as any[]) {
                    const rawName = String(row["__EMPTY"] || row["Name"] || row["name"] || row["Candidate Name"] || "").trim();
                    const rawDate = String(row["date "] || row["date"] || row["Date"] || "").trim();
                    const company = String(row["company name"] || row["Company Name"] || "").trim();
                    const link = String(row["link"] || row["Link"] || "").trim();

                    // Skip header row if it got caught in rawData
                    if (company.toLowerCase() === "company name" && link.toLowerCase() === "link") {
                        continue;
                    }

                    // Skip completely empty rows
                    if (!rawName && !company && !link) {
                        invalidCount++;
                        continue;
                    }

                    // If company and link are both empty, skip (no lead info)
                    if (!company && !link) {
                        invalidCount++;
                        continue;
                    }

                    if (rawName) {
                        lastCandidateName = rawName;
                    }

                    const candidateName = rawName || lastCandidateName || "Unknown Candidate";
                    const dateStr = parseDate(rawDate);

                    const row_ = marketingUiToRow(
                        {
                            "Name": candidateName,
                            "Date": dateStr,
                            "Company Name": company,
                            "Link": link,
                        },
                        profile?.uid || null,
                        profile?.fullName || "rohit"
                    );

                    pending.push(row_);
                    newCount++;

                    if (pending.length === BATCH_SIZE) {
                        await flush();
                    }
                }

                await flush();

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
            const supabase = createClient();
            const { error } = await supabase.from("marketing").delete().in("id", selectedRows);
            if (error) throw error;
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
            const supabase = createClient();
            const { error } = await supabase.from("marketing").delete().eq("id", recordToDelete);
            if (error) throw error;
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
            <div className="space-y-6">
                {/* Toolbar â€” sits outside the table card, matching the
                    Interview & Screening layout. */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative w-full sm:w-auto sm:min-w-[200px]">
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
                            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">From</span>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="text-sm px-2 py-1 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400 text-slate-700 bg-slate-50 transition-colors"
                                />
                                <div className="h-5 w-px bg-slate-200" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">To</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="text-sm px-2 py-1 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400 text-slate-700 bg-slate-50 transition-colors"
                                />
                                {(startDate || endDate) && (
                                    <button
                                        onClick={() => { setStartDate(""); setEndDate(""); }}
                                        className="px-2 py-1 text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap"
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
                                onClick={() => setIsAddingNew(!isAddingNew)}
                                className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm rounded-xl transition-all shadow-sm whitespace-nowrap shrink-0 ${
                                    isAddingNew
                                        ? "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                        : "bg-slate-900 text-white hover:bg-slate-800"
                                }`}
                            >
                                <Plus className="w-4 h-4" />
                                {isAddingNew ? "Cancel Adding" : "Add Data"}
                            </button>
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
                                className={`flex items-center gap-2 px-4 py-2.5 ${importing ? 'bg-blue-50 text-blue-400' : 'bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700'} font-semibold text-sm rounded-xl transition-all border border-blue-200 shadow-sm whitespace-nowrap shrink-0`}
                                title="Import from Excel"
                            >
                                <Download className={`w-4 h-4 ${importing ? 'animate-bounce' : ''}`} />
                                {importing ? "Importing..." : "Import XL"}
                            </button>
                                                        <button
                                onClick={() => setReportModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:text-purple-800 font-semibold text-sm rounded-xl transition-all border border-purple-200 shadow-sm whitespace-nowrap"
                                title="Generate Daily Report"
                            >
                                <TableIcon className="w-4 h-4" />
                                Generate Report
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

                <Card className="border-0 shadow-sm ring-1 ring-slate-200/60 overflow-hidden bg-white">
                {/* Table */}
                <div className="overflow-auto h-[600px] max-h-[calc(100vh-280px)] custom-scrollbar pb-6">
                    <div className="overflow-x-auto w-full max-w-full">
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
</div>
                    
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

                </Card>
            </div>

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
        <GenerateReportModal isOpen={reportModalOpen} onClose={() => setReportModalOpen(false)} profile={profile} startDate={startDate} endDate={endDate} displayData={displayData} />
        </>
    );
}





