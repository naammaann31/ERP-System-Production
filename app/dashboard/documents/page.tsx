"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { FileText, Download, Upload, ShieldCheck, Clock } from "lucide-react";

const documents = [
  { id: 1, name: "Employment Contract", type: "PDF", size: "2.4 MB", date: "Jan 10, 2024", status: "Verified", icon: ShieldCheck, color: "text-green-500", bg: "bg-green-50" },
  { id: 2, name: "ID Card Scan", type: "JPG", size: "1.1 MB", date: "Jan 12, 2024", status: "Verified", icon: ShieldCheck, color: "text-green-500", bg: "bg-green-50" },
  { id: 3, name: "July 2026 Payslip", type: "PDF", size: "0.8 MB", date: "Jul 01, 2026", status: "Available", icon: FileText, color: "text-blue-500", bg: "bg-blue-50" },
  { id: 4, name: "Updated Tax Form", type: "PDF", size: "1.5 MB", date: "Jul 10, 2026", status: "Pending Review", icon: Clock, color: "text-orange-500", bg: "bg-orange-50" },
  { id: 5, name: "Non-Disclosure Agreement (NDA)", type: "PDF", size: "1.2 MB", date: "Jan 10, 2024", status: "Verified", icon: ShieldCheck, color: "text-green-500", bg: "bg-green-50" },
  { id: 6, name: "Employee Handbook Ack.", type: "PDF", size: "3.5 MB", date: "Jan 15, 2024", status: "Verified", icon: ShieldCheck, color: "text-green-500", bg: "bg-green-50" },
  { id: 7, name: "Direct Deposit / Bank Details", type: "PDF", size: "0.5 MB", date: "Feb 01, 2024", status: "Verified", icon: ShieldCheck, color: "text-green-500", bg: "bg-green-50" },
  { id: 8, name: "Health Insurance Enrollment", type: "PDF", size: "2.1 MB", date: "Feb 10, 2024", status: "Available", icon: FileText, color: "text-blue-500", bg: "bg-blue-50" },
];

export default function DocumentsPage() {
  return (
    <div className="max-w-[1400px] mx-auto space-y-4 pb-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Documents</h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">Access and manage your corporate documents securely.</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 h-9 px-4 shadow-sm text-sm">
          <Upload className="h-4 w-4 mr-1.5" /> Upload Document
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {documents.map((doc, i) => (
          <motion.div key={doc.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}>
            <Card className="hover:shadow-md transition-shadow group rounded-2xl border-slate-100 shadow-sm overflow-hidden">
              <CardContent className="p-4 flex flex-col items-center text-center">
                <div className={`p-3 rounded-2xl mb-3 ${doc.bg} group-hover:scale-110 transition-transform`}>
                  <doc.icon className={`h-6 w-6 ${doc.color}`} />
                </div>
                <h3 className="font-bold text-slate-800 text-sm line-clamp-1">{doc.name}</h3>
                <p className="text-[11px] font-semibold text-slate-500 mt-0.5">{doc.type} &middot; {doc.size}</p>
                
                <div className="mt-3 mb-4">
                  <Badge variant={doc.status === "Verified" ? "success" : doc.status === "Available" ? "info" : "warning"} className="font-semibold text-[10px] py-0.5">
                    {doc.status}
                  </Badge>
                </div>
                
                <Button variant="outline" className="w-full text-blue-600 border-blue-200 hover:bg-blue-50 h-8 text-xs font-semibold rounded-lg">
                  <Download className="h-3 w-3 mr-1.5" /> Download
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
