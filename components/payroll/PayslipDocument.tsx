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
            overflow: 'hidden'
          }}
        >
          {/* Top Header Bar */}
          <div style={{ 
            background: 'linear-gradient(to right, #888888, #aaaaaa, #888888)', 
            padding: '14px 40px', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center' 
          }}>
            <div style={{ textAlign: 'center', color: '#ffffff' }}>
              {/* Small V icon */}
              <svg viewBox="0 0 60 60" style={{ width: '28px', height: '28px', display: 'block', margin: '0 auto 2px auto' }}>
                <polygon points="30,5 55,50 5,50" fill="none" stroke="#ffffff" strokeWidth="4" />
                <polyline points="18,28 28,45 42,18" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '3px', color: '#ffffff' }}>VECTRA</div>
              <div style={{ fontSize: '7px', fontWeight: 600, letterSpacing: '2px', color: '#eeeeee' }}>GROUP</div>
            </div>
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
            <WatermarkLogo />
          </div>

          {/* Main Content */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Company Details Section */}
            <div style={{ padding: '28px 40px 0 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                {/* Logo V */}
                <svg viewBox="0 0 80 80" style={{ width: '60px', height: '60px', display: 'block', marginBottom: '4px' }}>
                  <polygon points="40,8 72,65 8,65" fill="none" stroke="#1a1a2e" strokeWidth="5" />
                  <polyline points="22,35 36,58 56,22" fill="none" stroke="#1a1a2e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#1a1a2e', letterSpacing: '2px' }}>VECTRA</div>
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#666666', letterSpacing: '4px' }}>GROUP</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '12px', color: '#333333', lineHeight: '1.8' }}>
                <div style={{ fontWeight: 700, color: '#000000' }}>Vectra Group</div>
                <div>Operational Office: Ahmedabad, Gujarat</div>
                <div>Email: info@vectragroup.in</div>
                <div>Website: www.vectragroup.in</div>
              </div>
            </div>

            {/* Payslip Title */}
            <div style={{ padding: '28px 40px 18px 40px', textAlign: 'center' }}>
              <div style={{ fontSize: '15px', fontWeight: 800, textDecoration: 'underline', color: '#000000', letterSpacing: '0.5px' }}>
                PAYSLIP FOR THE MONTH OF {monthName} {payroll.year}
              </div>
            </div>

            {/* Employee Details Table */}
            <div style={{ padding: '0 40px', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', fontWeight: 700, width: '25%', backgroundColor: '#f5f5f5', color: '#000000' }}>Employee Name</td>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', width: '25%', color: '#000000' }}>{payroll.employeeName}</td>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', fontWeight: 700, width: '25%', backgroundColor: '#f5f5f5', color: '#000000' }}>Designation</td>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', width: '25%', color: '#000000' }}>{payroll.designation || "N/A"}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', fontWeight: 700, backgroundColor: '#f5f5f5', color: '#000000' }}>Employee ID</td>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', color: '#000000' }}>{payroll.employeeId || "N/A"}</td>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', fontWeight: 700, backgroundColor: '#f5f5f5', color: '#000000' }}>Department</td>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', color: '#000000' }}>{payroll.department || "N/A"}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', fontWeight: 700, backgroundColor: '#f5f5f5', color: '#000000' }}>Date of Joining</td>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', color: '#000000' }}>{new Date(0, payroll.month - 1).toLocaleString('default', { month: 'long' })} {payroll.year}</td>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', fontWeight: 700, backgroundColor: '#f5f5f5', color: '#000000' }}>Location</td>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', color: '#000000' }}>India</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', fontWeight: 700, backgroundColor: '#f5f5f5', color: '#000000' }}>Bank Name</td>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', color: '#000000' }}>Bank of Baroda</td>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', fontWeight: 700, backgroundColor: '#f5f5f5', color: '#000000' }}>Days Worked</td>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', color: '#000000' }}>{daysWorked}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Spacer */}
            <div style={{ height: '8px' }}></div>

            {/* Earnings & Deductions Table */}
            <div style={{ padding: '0 40px', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', fontWeight: 700, backgroundColor: '#f5f5f5', width: '25%', textDecoration: 'underline', color: '#000000' }}>Earnings</td>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', fontWeight: 700, backgroundColor: '#f5f5f5', width: '25%', textDecoration: 'underline', color: '#000000' }}>Amount (₹)</td>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', fontWeight: 700, backgroundColor: '#f5f5f5', width: '25%', textDecoration: 'underline', color: '#000000' }}>Deductions</td>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', fontWeight: 700, backgroundColor: '#f5f5f5', width: '25%', textDecoration: 'underline', color: '#000000' }}>Amount (₹)</td>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', fontWeight: 700, color: '#000000' }}>Basic Salary (Prorated)</td>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', color: '#000000' }}>{payroll.basic.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', fontWeight: 700, color: '#000000' }}>Professional Tax</td>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', color: '#000000' }}>{payroll.taxDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', fontWeight: 700, color: '#000000' }}>House Rent Allowance (Prorated)</td>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', color: '#000000' }}>{payroll.hra.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', fontWeight: 700, color: '#000000' }}>Income Tax (TDS)</td>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', color: '#000000' }}>0.00</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', fontWeight: 700, color: '#000000' }}>Special Allowance (Prorated)</td>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', color: '#000000' }}>{payroll.specialAllowance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', fontWeight: 700, color: '#000000' }}>Provident Fund</td>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', color: '#000000' }}>0.00</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', fontWeight: 700, color: '#000000' }}>Travel Allowance (Prorated)</td>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', color: '#000000' }}>{payroll.travelAllowance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', fontWeight: 700, color: '#000000' }}>LOP</td>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', color: '#000000' }}>{payroll.lopDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', fontWeight: 700, textDecoration: 'underline', color: '#000000' }}>Total Earnings</td>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', fontWeight: 700, textDecoration: 'underline', color: '#000000' }}>{payroll.totalEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', fontWeight: 700, textDecoration: 'underline', color: '#000000' }}>Total Deductions</td>
                    <td style={{ border: '1px solid #333333', padding: '7px 10px', fontWeight: 700, textDecoration: 'underline', color: '#000000' }}>{payroll.totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Spacer */}
            <div style={{ height: '8px' }}></div>

            {/* Net Salary Payable */}
            <div style={{ padding: '0 40px', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #333333', padding: '9px 10px', fontWeight: 700, color: '#000000' }}>
                      Net Salary Payable: {payroll.netSalary.toLocaleString('en-IN')} ({numberToWords(payroll.netSalary)})
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Spacer */}
            <div style={{ height: '8px' }}></div>

            {/* Payment Disbursement Details */}
            <div style={{ padding: '0 40px', marginBottom: '36px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <tbody>
                  <tr>
                    <td style={{ border: '1px dashed #555555', padding: '9px 10px', color: '#000000' }}>
                      <div style={{ fontWeight: 700, marginBottom: '4px' }}>Payment Disbursement Details:</div>
                      <div>• Payment Date: {paymentDate}</div>
                      <div>• Mode of Payment: Bank Transfer</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Authorized Signatory */}
            <div style={{ padding: '0 40px', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#000000', marginBottom: '36px' }}>Authorized Signatory</div>
              <div style={{ fontSize: '11px', lineHeight: '1.8', color: '#000000' }}>
                <div>{signatoryName}</div>
                <div>Global HR, Vectra Group</div>
              </div>
            </div>
          </div>

          {/* Bottom Footer Bar */}
          <div style={{ 
            position: 'absolute', 
            bottom: 0, 
            left: 0, 
            right: 0, 
            background: 'linear-gradient(to right, #555555, #888888, #555555)', 
            padding: '14px 40px', 
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            {/* Small footer logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg viewBox="0 0 60 60" style={{ width: '30px', height: '30px' }}>
                <polygon points="30,5 55,50 5,50" fill="none" stroke="#ffffff" strokeWidth="4" />
                <polyline points="18,28 28,45 42,18" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '2px', color: '#ffffff' }}>VECTRA</div>
                <div style={{ fontSize: '6px', fontWeight: 600, letterSpacing: '2px', color: '#dddddd' }}>GROUP</div>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '10px', color: '#ffffff', lineHeight: '1.6' }}>
              <div><span style={{ fontWeight: 700, fontStyle: 'italic' }}>Operational Office:</span> Ahmedabad, Gujarat</div>
              <div><span style={{ fontWeight: 700 }}>Phone:</span> +91 92747 02334 | <span style={{ fontWeight: 700 }}>Email:</span> info@vectragroup.in</div>
              <div><span style={{ fontWeight: 700 }}>Website:</span> www.vectragroup.in</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
