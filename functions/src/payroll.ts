import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

export const generatePayroll = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }

  const db = admin.firestore();

  // Verify caller is Admin or HR
  const callerDoc = await db.collection("users").doc(context.auth.uid).get();
  const callerRole = callerDoc.data()?.role;
  if (!["Admin", "HR", "OPS_HR"].includes(callerRole)) {
    throw new functions.https.HttpsError("permission-denied", "Only Admin or HR can generate payrolls.");
  }

  const { 
    employeeUid, 
    month, 
    year, 
    lopDays, 
    professionalTax, 
    incomeTax, 
    providentFund, 
    incentives, 
    paymentDate, 
    modeOfPayment 
  } = data;

  if (!employeeUid || month == null || year == null) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields.");
  }

  try {
    // Read user and salary structure
    const [userDoc, structDoc] = await Promise.all([
      db.collection("users").doc(employeeUid).get(),
      db.collection("salary_structures").doc(employeeUid).get()
    ]);

    if (!userDoc.exists || !structDoc.exists) {
      throw new functions.https.HttpsError("not-found", "User or salary structure not found.");
    }

    const userData = userDoc.data()!;
    const structData = structDoc.data()!;

    // Perform the calculation on the server
    const grossSalary = structData.grossSalary || 0;
    const basic = grossSalary * 0.5;
    const hra = grossSalary * 0.2;
    const travelAllowance = structData.travelAllowance || 0;
    const otherAllowances = structData.otherAllowances || 0;
    const otherDeductions = structData.otherDeductions || 0;

    let specialAllowance = grossSalary - basic - hra - travelAllowance;
    if (specialAllowance < 0) specialAllowance = 0;

    const totalEarnings = grossSalary + otherAllowances + (incentives || 0);

    const daysInMonth = new Date(year, month, 0).getDate();
    const perDaySalary = grossSalary / daysInMonth;
    const lopDeduction = perDaySalary * (lopDays || 0);

    const pt = professionalTax || 0;
    const it = incomeTax || 0;
    const pf = providentFund || 0;

    const totalDeductions = lopDeduction + pt + it + pf + otherDeductions;
    const netSalary = totalEarnings - totalDeductions;

    const payrollId = `${employeeUid}_${year}_${month}`;

    const payrollData = {
      userId: employeeUid,
      employeeName: userData.fullName || "Unknown",
      employeeId: userData.employeeId || "",
      jobRole: userData.jobRole || "",
      department: userData.department || "",
      month,
      year,
      grossSalary,
      basic,
      hra,
      travelAllowance,
      specialAllowance,
      otherAllowances,
      incentives: incentives || 0,
      totalEarnings,
      lopDays: lopDays || 0,
      lopDeduction,
      taxDeduction: pt,
      incomeTax: it,
      providentFund: pf,
      otherDeductions,
      totalDeductions,
      netSalary,
      paymentDate: paymentDate || new Date().toISOString(),
      modeOfPayment: modeOfPayment || "Bank Transfer",
      status: "Paid",
      generatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Save to Firestore securely
    await db.collection("payrolls").doc(payrollId).set(payrollData);

    // Also write audit log securely
    await db.collection("audit_logs").add({
      actorName: callerDoc.data()?.fullName || "Unknown",
      actorUid: context.auth.uid,
      action: "Generated Payroll",
      target: employeeUid,
      details: `Generated payroll for ${month}/${year}`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, payrollId, payrollData };
  } catch (error: any) {
    console.error("Error generating payroll:", error);
    throw new functions.https.HttpsError("internal", error.message || "Failed to generate payroll.");
  }
});
