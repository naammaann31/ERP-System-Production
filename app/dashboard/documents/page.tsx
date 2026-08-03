"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { FileText, Download, Upload, ShieldCheck, Clock, Trash2, X, Building2, User, ExternalLink } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  DocumentRecord,
  uploadDocument,
  deleteDocument,
  listenToDocuments,
} from "@/lib/documents";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const getDocIcon = (status: string) => {
  if (status === "Verified") return { icon: ShieldCheck, color: "text-green-500", bg: "bg-green-50" };
  if (status === "Available") return { icon: FileText, color: "text-blue-500", bg: "bg-blue-50" };
  return { icon: Clock, color: "text-orange-500", bg: "bg-orange-50" };
};

export default function DocumentsPage() {
  const { profile } = useAuth();
  const isAdminOrHR = profile?.role === "Admin" || profile?.role === "HR" || profile?.role === "OPS_HR";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadScope, setUploadScope] = useState<"personal" | "company">("personal");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Text fields for statutory details
  const [aadhar, setAadhar] = useState("");
  const [pan, setPan] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankDetails, setBankDetails] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);

  useEffect(() => {
    if (!profile?.uid) return;
    setLoading(true);

    const fetchUserDetails = async () => {
      try {
        let docSnap = await getDoc(doc(db, "users", profile.uid));
        if (!docSnap.exists()) {
          docSnap = await getDoc(doc(db, "Users", profile.uid));
        }
        if (docSnap.exists()) {
          const data = docSnap.data();
          setAadhar(data.aadhar || "");
          setPan(data.pan || "");
          setBankAccountName(data.bankAccountName || "");
          setBankDetails(data.bankDetails || "");
        }
      } catch (error) {
        console.error("Error fetching user details:", error);
      }
    };
    fetchUserDetails();

    const unsubscribe = listenToDocuments(profile.uid, isAdminOrHR, (docs) => {
      setDocuments(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile, isAdminOrHR]);

  const handleSaveDetails = async () => {
    if (!profile?.uid) return;
    setSavingDetails(true);
    try {
      let docRef = doc(db, "users", profile.uid);
      let docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        docRef = doc(db, "Users", profile.uid);
      }
      await updateDoc(docRef, {
        aadhar,
        pan,
        bankAccountName,
        bankDetails
      });
      alert("Details saved successfully!");
    } catch (error) {
      console.error("Error saving details:", error);
      alert("Failed to save details.");
    }
    setSavingDetails(false);
  };

  const handleUpload = async (files: FileList) => {
    if (!profile?.uid || !files.length) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      await uploadDocument(file, profile.uid, profile.fullName, uploadScope);
    }

    setUploading(false);
    setIsUploadModalOpen(false);
  };

  const handleDelete = async (doc: DocumentRecord) => {
    if (!window.confirm(`Delete "${doc.name}"? This cannot be undone.`)) return;
    await deleteDocument(doc.id!, doc.storagePath);
  };

  const formatDate = (ts: any) => {
    if (!ts) return "-";
    if (ts.toDate) return ts.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return "-";
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-4 pb-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Documents</h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">Access and manage your corporate documents securely.</p>
        </div>
      </div>

      {/* Statutory Details Section */}
      <Card className="border-slate-100 shadow-sm rounded-2xl overflow-hidden mb-6">
        <div className="bg-slate-50 border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-800">Statutory & Bank Details</h2>
          <p className="text-xs text-slate-500">Please provide your Aadhar, PAN, and Bank details for payroll purposes.</p>
        </div>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Aadhar Number</label>
              <input type="text" value={aadhar} onChange={(e) => setAadhar(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" placeholder="Enter Aadhar Number" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">PAN Number</label>
              <input type="text" value={pan} onChange={(e) => setPan(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" placeholder="Enter PAN Number" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Bank Account Name</label>
              <input type="text" value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" placeholder="Name as per bank" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Bank Details (A/c & IFSC)</label>
              <input type="text" value={bankDetails} onChange={(e) => setBankDetails(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" placeholder="Account Number, IFSC" />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleSaveDetails} disabled={savingDetails} className="bg-slate-900 hover:bg-slate-800 text-white">
              {savingDetails ? "Saving..." : "Save Details"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <svg className="animate-spin h-6 w-6 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <FileText className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <p className="font-semibold">No documents yet</p>
          <p className="text-sm mt-1">Upload your first document to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {documents.map((doc, i) => {
            const { icon: DocIcon, color, bg } = getDocIcon(doc.status);
            return (
              <motion.div key={doc.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
                <Card className="hover:shadow-md transition-shadow group rounded-2xl border-slate-100 shadow-sm overflow-hidden">
                  <CardContent className="p-4 flex flex-col items-center text-center">
                    <div className={`p-3 rounded-2xl mb-3 ${bg} group-hover:scale-110 transition-transform`}>
                      <DocIcon className={`h-6 w-6 ${color}`} />
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm line-clamp-1">{doc.name}</h3>
                    <p className="text-[11px] font-semibold text-slate-500 mt-0.5">{doc.type} &middot; {doc.size}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{formatDate(doc.uploadedAt)}</p>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={doc.status === "Verified" ? "success" : doc.status === "Available" ? "info" : "warning"} className="font-semibold text-[10px] py-0.5">
                        {doc.status}
                      </Badge>
                      <Badge variant="outline" className="font-medium text-[9px] py-0.5">
                        {doc.scope === "company" ? <><Building2 className="h-2.5 w-2.5 inline mr-0.5" />Company</> : <><User className="h-2.5 w-2.5 inline mr-0.5" />Personal</>}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-3 w-full">
                      <a href={doc.storageUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                        <Button variant="outline" className="w-full text-blue-600 border-blue-200 hover:bg-blue-50 h-8 text-xs font-semibold rounded-lg">
                          <Download className="h-3 w-3 mr-1.5" /> Download
                        </Button>
                      </a>
                      {(isAdminOrHR || doc.uploadedBy === profile?.uid) && (
                        <Button variant="outline" onClick={() => handleDelete(doc)} className="h-8 w-8 p-0 border-red-200 text-red-500 hover:bg-red-50 rounded-lg shrink-0">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100"
          >
            <div className="bg-slate-50/50 px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">Upload Document</h2>
                <p className="text-xs font-semibold text-slate-500 mt-1">Select files to upload</p>
              </div>
              <button onClick={() => setIsUploadModalOpen(false)} className="p-2 rounded-full hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {isAdminOrHR && (
                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-2">Document Scope</label>
                  <div className="flex gap-3">
                    <button onClick={() => setUploadScope("personal")} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${uploadScope === "personal" ? "bg-slate-900 text-white shadow-md" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                      <User className="h-4 w-4 inline mr-1.5" /> Personal
                    </button>
                    <button onClick={() => setUploadScope("company")} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${uploadScope === "company" ? "bg-slate-900 text-white shadow-md" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                      <Building2 className="h-4 w-4 inline mr-1.5" /> Company-wide
                    </button>
                  </div>
                </div>
              )}

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all"
              >
                <Upload className="h-8 w-8 mx-auto text-slate-400 mb-3" />
                <p className="text-sm font-bold text-slate-700">Click to select files</p>
                <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG, DOCX up to 10MB</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.docx,.doc,.xlsx,.xls"
                className="hidden"
                onChange={(e) => e.target.files && handleUpload(e.target.files)}
              />

              {uploading && (
                <div className="flex items-center justify-center gap-2 py-3">
                  <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-sm font-semibold text-blue-600">Uploading...</span>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
