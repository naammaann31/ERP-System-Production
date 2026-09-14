import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { PayrollRecord } from "@/lib/payroll";
import PayslipDocument from "@/components/payroll/PayslipDocument";

interface RecentPayrollsGridProps {
  displayedPayrolls: PayrollRecord[];
  setPayrollToDelete: (pr: PayrollRecord) => void;
}

export default function RecentPayrollsGrid({
  displayedPayrolls,
  setPayrollToDelete
}: RecentPayrollsGridProps) {
  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h3 className="font-bold text-lg text-slate-800">Recent Payrolls Generated</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {displayedPayrolls.length === 0 && (
          <div className="col-span-full py-12 text-center bg-white border border-slate-200 border-dashed rounded-2xl">
            <p className="text-slate-500 font-medium">No payrolls generated for this month yet.</p>
          </div>
        )}
        {displayedPayrolls.map(pr => (
          <Card key={pr.id} className="border border-slate-200 shadow-sm p-4 relative group">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="font-bold text-slate-900">{pr.employeeName}</h4>
                <p className="text-xs text-slate-500">{pr.month}/{pr.year}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">Paid</Badge>
                <button
                  onClick={() => setPayrollToDelete(pr)}
                  className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                  title="Delete Payroll"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="flex justify-between items-end mt-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Net Salary</p>
                <p className="font-black text-xl text-slate-800">
                  <span className="text-sm font-bold text-slate-400 mr-1">₹</span>
                  {pr.netSalary.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </p>
              </div>
              <PayslipDocument payroll={pr} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
