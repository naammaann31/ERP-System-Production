"use client";

import { useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { PayrollRecord } from "@/lib/payroll";
import { useAuth } from "@/components/providers/AuthProvider";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

function numberToWords(num: number): string {
  if (num === 0) return "Zero";
  
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  
  const convert = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " and " + convert(n % 100) : "");
    if (n < 100000) return convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + convert(n % 1000) : "");
    if (n < 10000000) return convert(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + convert(n % 100000) : "");
    return convert(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + convert(n % 10000000) : "");
  };
  
  const intPart = Math.floor(Math.abs(num));
  const decPart = Math.round((Math.abs(num) - intPart) * 100);
  
  let result = convert(intPart);
  if (decPart > 0) {
    result += " and " + convert(decPart) + " Paise";
  }
  result += " only";
  return result;
}

// SVG watermark logo (V triangle design)
const WatermarkLogo = () => (
  <svg viewBox="0 0 300 350" style={{ width: '360px', height: '420px' }}>
    {/* Outer V / Triangle */}
    <polygon points="150,20 280,280 20,280" fill="none" stroke="#e0e0e0" strokeWidth="18" />
    {/* Inner V tick */}
    <polyline points="90,140 140,240 210,100" fill="none" stroke="#d5d5d5" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
    {/* VECTRA text */}
    <text x="150" y="320" textAnchor="middle" style={{ fontSize: '52px', fontWeight: 900, fill: '#e0e0e0', letterSpacing: '8px', fontFamily: 'Arial, sans-serif' }}>VECTRA</text>
    {/* GROUP text */}
    <text x="150" y="355" textAnchor="middle" style={{ fontSize: '32px', fontWeight: 700, fill: '#e0e0e0', letterSpacing: '14px', fontFamily: 'Arial, sans-serif' }}>GROUP</text>
  </svg>
);

export default function PayslipDocument({ payroll }: { payroll: PayrollRecord }) {
  const [isExporting, setIsExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const { profile } = useAuth();

  const handleExportPDF = async () => {
    if (!printRef.current) return;
    setIsExporting(true);

    try {
      const element = printRef.current;
      const canvas = await html2canvas(element, { 
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        // Strip external stylesheets to avoid lab() color parsing errors
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
    } catch (err) {
      console.error("Error generating PDF", err);
      alert("Failed to generate PDF");
    } finally {
      setIsExporting(false);
    }
  };

  const monthName = new Date(0, payroll.month - 1).toLocaleString('default', { month: 'long' }).toUpperCase();
  const daysWorked = payroll.daysWorked ?? 0;
  const paymentDate = `${String(new Date(payroll.year, payroll.month, 0).getDate()).padStart(2, '0')}-${String(payroll.month).padStart(2, '0')}-${payroll.year}`;

  // Signatory name from logged-in HR/Admin
  const signatoryName = profile?.fullName || "HR Department";

  return (
    <>
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
        {isExporting ? "Exporting..." : "Download PDF"}
      </button>

      {/* Hidden Payslip for PDF Generation */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', zIndex: -100 }}>
        <div 
          ref={printRef} 
          style={{ 
            width: '794px', 
            height: '1123px', 
            fontFamily: 'Arial, Helvetica, sans-serif', 
            position: 'relative', 
            backgroundColor: '#ffffff',
            color: '#000000',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Black Header Bar */}
          <div style={{ 
            width: '100%', 
            padding: '16px 0', 
            background: 'linear-gradient(to bottom, #000000, #3a3a3a)', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center' 
          }}>
             <img src="/updated_logo.png" alt="Vectra Group" style={{ width: 'auto', height: '40px', filter: 'invert(1) brightness(2)' }} crossOrigin="anonymous" />
          </div>

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
            <img src="/updated_logo.png" alt="Watermark" style={{ width: '360px', height: 'auto', display: 'block' }} crossOrigin="anonymous" />
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
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, width: '25%', color: '#000000', backgroundColor: '#f2f2f2' }}>Employee Name</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', width: '25%', color: '#000000' }}>{payroll.employeeName}</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, width: '25%', color: '#000000', backgroundColor: '#f2f2f2' }}>Job Role</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', width: '25%', color: '#000000' }}>{payroll.jobRole || ""}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000', backgroundColor: '#f2f2f2' }}>Employee ID</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000' }}>{payroll.employeeId || ""}</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000', backgroundColor: '#f2f2f2' }}>Department</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000' }}>{payroll.department || ""}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000', backgroundColor: '#f2f2f2' }}>Date of Joining</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000' }}>{payroll.dateOfJoining || ""}</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000', backgroundColor: '#f2f2f2' }}>Division</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000' }}>{payroll.division || "Vectra Staffing"}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000', backgroundColor: '#f2f2f2' }}>Bank Name</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000' }}>{payroll.bankName || ""}</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000', backgroundColor: '#f2f2f2' }}>Days Worked</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000' }}>{daysWorked}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Earnings & Deductions Table */}
            <div style={{ padding: '0 40px', marginBottom: '24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, backgroundColor: '#e0e0e0', width: '25%', color: '#000000' }}>Earnings</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, backgroundColor: '#e0e0e0', width: '25%', color: '#000000' }}>Amount (₹)</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, backgroundColor: '#e0e0e0', width: '25%', color: '#000000' }}>Deductions</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, backgroundColor: '#e0e0e0', width: '25%', color: '#000000' }}>Amount (₹)</td>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000' }}>Basic Salary (Prorated)</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000' }}>{payroll.basic ? payroll.basic.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000' }}>Professional Tax</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000' }}>{payroll.taxDeduction ? payroll.taxDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000' }}>House Rent Allowance (Prorated)</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000' }}>{payroll.hra ? payroll.hra.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000' }}>Income Tax (TDS)</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000' }}>{payroll.incomeTax ? payroll.incomeTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000' }}>Special Allowance (Prorated)</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000' }}>{payroll.specialAllowance ? payroll.specialAllowance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000' }}>Provident Fund</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000' }}>{payroll.providentFund ? payroll.providentFund.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000' }}>Travel Allowance</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000' }}>{payroll.travelAllowance ? payroll.travelAllowance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000' }}>LOP (Loss of Pay)</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000' }}>{payroll.lopDeduction ? payroll.lopDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000' }}>Incentives</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000' }}>{payroll.incentives ? payroll.incentives.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000' }}></td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', color: '#000000' }}></td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000' }}>Total Earnings</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000' }}>{payroll.totalEarnings ? payroll.totalEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000' }}>Total Deductions</td>
                    <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 700, color: '#000000' }}>{payroll.totalDeductions ? payroll.totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Net Salary Payable */}
            <div style={{ padding: '0 40px', marginBottom: '24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #000000', padding: '8px 10px', fontWeight: 700, color: '#000000', backgroundColor: '#e5e5e5' }}>
                      Net Salary Payable: {payroll.netSalary ? payroll.netSalary.toLocaleString('en-IN') : ""} 
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Payment Disbursement Details */}
            <div style={{ padding: '0 40px', marginBottom: '40px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
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
      </div>
    </>
  );
}
