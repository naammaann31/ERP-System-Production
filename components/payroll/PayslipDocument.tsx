"use client";

import { useRef, useState } from "react";
import { Download, Loader2, Eye, X } from "lucide-react";
import { PayrollRecord } from "@/lib/payroll";
import { useAuth } from "@/components/providers/AuthProvider";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function PayslipDocument({ payroll }: { payroll: PayrollRecord }) {
  const [isExporting, setIsExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const { profile } = useAuth();

  const handleExportPDF = async () => {
    if (!printRef.current) return;
    setIsExporting(true);

    try {
      const element = printRef.current;
      const originalParent = element.parentElement;
      const nextSibling = element.nextSibling;
      
      // Temporarily move to body to escape all CSS transforms and relative parents
      document.body.appendChild(element);
      element.style.position = 'absolute';
      element.style.top = '0px';
      element.style.left = '0px';
      element.style.zIndex = '-9999';

      const canvas = await html2canvas(element, { 
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 794,
        windowHeight: 1123,
        onclone: (clonedDoc) => {
          const stylesheets = clonedDoc.querySelectorAll('link[rel="stylesheet"], style');
          stylesheets.forEach((sheet) => {
            sheet.remove();
          });
        }
      });
      const data = canvas.toDataURL("image/png");

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(data, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Payslip_${payroll.employeeName}_${payroll.month}_${payroll.year}.pdf`);
      
      // Move it back
      if (originalParent) {
        element.style.position = '';
        element.style.top = '';
        element.style.left = '';
        element.style.zIndex = '';
        originalParent.insertBefore(element, nextSibling);
      }
    } catch (err) {
      console.error("Error generating PDF", err);
      alert("Failed to generate PDF");
    } finally {
      setIsExporting(false);
    }
  };

  const monthName = new Date(0, payroll.month - 1).toLocaleString('default', { month: 'long' }).toUpperCase();
  const daysWorked = payroll.daysWorked ?? 0;
  
  const renderPayslip = () => (
    <div 
      id="pdf-payslip-container"
      style={{ 
        width: '794px', 
        height: '1123px', 
        fontFamily: 'Arial, Helvetica, sans-serif', 
        position: 'relative', 
        backgroundColor: '#ffffff',
        color: '#000000',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box'
      }}
    >
      {/* Center Watermark */}
      <div style={{ 
        position: 'absolute', 
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)', 
        zIndex: 0,
        opacity: 0.08,
        pointerEvents: 'none'
      }}>
        <img src="/updated_logo.png" alt="Watermark" style={{ width: '600px', height: 'auto', display: 'block' }} crossOrigin="anonymous" />
      </div>

      {/* Main Content */}
      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Company Details Section */}
        <div style={{ padding: '40px 40px 0 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <img src="/updated_logo.png" alt="Vectra Group" style={{ width: '120px', height: 'auto', display: 'block' }} crossOrigin="anonymous" />
          </div>
          <div style={{ textAlign: 'right', fontSize: '13px', color: '#000000', lineHeight: '1.6' }}>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>Vectra Group</div>
            <div style={{ fontWeight: 700 }}>Operational Office: Ahmedabad, Gujarat</div>
            <div style={{ fontWeight: 700 }}>Email: damini@vectragroup.in</div>
            <div style={{ fontWeight: 700 }}>Website: www.vectragroup.in</div>
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '2px solid #333333', margin: '20px 40px 30px 40px' }} />

        {/* Payslip Title */}
        <div style={{ padding: '0 40px 20px 40px', textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, textDecoration: 'underline', color: '#000000', letterSpacing: '0.5px' }}>
            PAYSLIP FOR THE MONTH OF {monthName} {payroll.year}
          </div>
        </div>

        {/* Employee Details Table */}
        <div style={{ padding: '0 40px', marginBottom: '24px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'center' }}>
            <tbody>
              <tr>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, width: '25%', color: '#000000', verticalAlign: 'middle' }}>Employee Name</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', width: '25%', color: '#000000', verticalAlign: 'middle' }}>{payroll.employeeName}</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, width: '25%', color: '#000000', verticalAlign: 'middle' }}>Designation</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', width: '25%', color: '#000000', verticalAlign: 'middle' }}>{payroll.designation || ""}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000', verticalAlign: 'middle' }}>Employee ID</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000', verticalAlign: 'middle' }}>{payroll.employeeId || ""}</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000', verticalAlign: 'middle' }}>Department</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000', verticalAlign: 'middle' }}>{payroll.department || ""}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000', verticalAlign: 'middle' }}>Date of Joining</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000', verticalAlign: 'middle' }}>{payroll.dateOfJoining || ""}</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000', verticalAlign: 'middle' }}>Division</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000', verticalAlign: 'middle' }}>{payroll.division || "Vectra Staffing"}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000', verticalAlign: 'middle' }}>Bank Name</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000', verticalAlign: 'middle' }}>{payroll.bankName || ""}</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000', verticalAlign: 'middle' }}>Days Worked</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000', verticalAlign: 'middle' }}>{daysWorked}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Earnings & Deductions Table */}
        <div style={{ padding: '0 40px', marginBottom: '24px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'center' }}>
            <thead>
              <tr>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, backgroundColor: '#e0e0e0', width: '25%', color: '#000000', verticalAlign: 'middle' }}>Earnings</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, backgroundColor: '#e0e0e0', width: '25%', color: '#000000', verticalAlign: 'middle' }}>Amount (₹)</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, backgroundColor: '#e0e0e0', width: '25%', color: '#000000', verticalAlign: 'middle' }}>Deductions</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, backgroundColor: '#e0e0e0', width: '25%', color: '#000000', verticalAlign: 'middle' }}>Amount (₹)</td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000', verticalAlign: 'middle' }}>Basic Salary (Prorated)</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000', verticalAlign: 'middle' }}>{payroll.basic ? payroll.basic.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000', verticalAlign: 'middle' }}>Professional Tax</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000', verticalAlign: 'middle' }}>{payroll.taxDeduction ? payroll.taxDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000', verticalAlign: 'middle' }}>House Rent Allowance (Prorated)</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000', verticalAlign: 'middle' }}>{payroll.hra ? payroll.hra.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000', verticalAlign: 'middle' }}>Income Tax (TDS)</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000', verticalAlign: 'middle' }}>{payroll.incomeTax ? payroll.incomeTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000', verticalAlign: 'middle' }}>Special Allowance (Prorated)</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000', verticalAlign: 'middle' }}>{payroll.specialAllowance ? payroll.specialAllowance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000', verticalAlign: 'middle' }}>Provident Fund</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000', verticalAlign: 'middle' }}>{payroll.providentFund ? payroll.providentFund.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000', verticalAlign: 'middle' }}>Travel Allowance</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000', verticalAlign: 'middle' }}>{payroll.travelAllowance ? payroll.travelAllowance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000', verticalAlign: 'middle' }}>LOP (Loss of Pay)</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000', verticalAlign: 'middle' }}>{payroll.lopDeduction ? payroll.lopDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000', verticalAlign: 'middle' }}>Incentives</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000', verticalAlign: 'middle' }}>{payroll.incentives ? payroll.incentives.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000', verticalAlign: 'middle' }}></td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000', verticalAlign: 'middle' }}></td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000', verticalAlign: 'middle' }}>Total Earnings</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000', verticalAlign: 'middle' }}>{payroll.totalEarnings ? payroll.totalEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000', verticalAlign: 'middle' }}>Total Deductions</td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000', verticalAlign: 'middle' }}>{payroll.totalDeductions ? payroll.totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Net Salary Payable */}
        <div style={{ padding: '0 40px', marginBottom: '24px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'center' }}>
            <tbody>
              <tr>
                <td style={{ border: '1px solid #000000', padding: '8px 10px', fontWeight: 700, color: '#000000', backgroundColor: '#e5e5e5', verticalAlign: 'middle' }}>
                  Net Salary Payable: {payroll.netSalary ? payroll.netSalary.toLocaleString('en-IN') : ""} 
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Payment Disbursement Details */}
        <div style={{ padding: '0 40px', marginBottom: '40px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <tbody>
              <tr>
                <td style={{ border: '1px dashed #000000', padding: '10px', color: '#000000' }}>
                  <div style={{ fontWeight: 700, marginBottom: '6px' }}>Payment Disbursement Details:</div>
                  <div style={{ fontWeight: 700 }}>• Payment Date: <span style={{ fontWeight: 400 }}>{payroll.paymentDate || ""}</span></div>
                  <div style={{ fontWeight: 700 }}>• Mode of Payment: <span style={{ fontWeight: 400 }}>{payroll.modeOfPayment || "Bank Transfer"}</span></div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Authorized Signatory */}
        <div style={{ padding: '0 40px', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#000000', marginBottom: '40px' }}>Authorized Signatory</div>
          <div style={{ fontSize: '13px', lineHeight: '1.6', color: '#000000' }}>
            <div style={{ fontWeight: 700 }}>Damini Mallick</div>
            <div>Senior Executive Human Resources – Vectra Group</div>
          </div>
        </div>
      </div>

      {/* Bottom Footer Bar */}
      <div style={{ 
        marginTop: 'auto',
        background: '#2b2b2b', 
        padding: '12px 0', 
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%'
      }}>
        <div style={{ color: '#ffffff', fontSize: '12px', fontWeight: 400 }}>
          This is a system-generated document.
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="flex items-center gap-2 justify-end">
        <button 
          onClick={() => setShowPreview(true)}
          style={{
            color: '#0f172a',
            backgroundColor: '#f1f5f9',
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 700,
            border: '1px solid #e2e8f0',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s'
          }}
        >
          <Eye style={{ width: '14px', height: '14px' }} />
          Preview
        </button>
        <button 
          onClick={handleExportPDF}
          disabled={isExporting}
          style={{
            color: '#2563eb',
            backgroundColor: '#eff6ff',
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 700,
            border: '1px solid #bfdbfe',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            opacity: isExporting ? 0.5 : 1,
            transition: 'all 0.2s'
          }}
        >
          {isExporting ? <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} /> : <Download style={{ width: '14px', height: '14px' }} />}
          {isExporting ? "Exporting..." : "Download"}
        </button>
      </div>

      {showPreview && (
        <div className="fixed inset-0 z-[100] flex bg-black/60 backdrop-blur-sm transition-all" onClick={() => setShowPreview(false)}>
          <div className="w-1/2 h-full bg-slate-200 ml-auto overflow-y-auto relative shadow-2xl flex flex-col items-center py-10" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setShowPreview(false)}
              className="absolute top-6 right-6 bg-white/80 hover:bg-white text-slate-900 p-2 rounded-full shadow-lg backdrop-blur transition-all z-10"
            >
              <X style={{ width: '20px', height: '20px' }} />
            </button>
            <div style={{ transform: 'scale(0.8)', transformOrigin: 'top center', height: 'max-content', marginBottom: '-20%' }}>
              <div className="shadow-2xl">
                {renderPayslip()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Payslip for PDF Generation */}
      <div style={{ overflow: 'hidden', height: 0, width: 0 }}>
        <div ref={printRef}>
          {renderPayslip()}
        </div>
      </div>
    </>
  );
}
