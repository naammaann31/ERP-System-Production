import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

export const deleteEmployee = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }

  const { employeeUid } = data;

  if (!employeeUid) {
    throw new functions.https.HttpsError("invalid-argument", "Employee UID is required.");
  }

  const db = admin.firestore();
  
  try {
    // Verify caller is Admin or HR
    const callerDoc = await db.collection("users").doc(context.auth.uid).get();
    const callerRole = callerDoc.data()?.role;

    if (!["Admin", "HR", "OPS_HR"].includes(callerRole)) {
      throw new functions.https.HttpsError("permission-denied", "Only Admin or HR can delete employees.");
    }

    // 1. Delete Firebase Auth User
    try {
      await admin.auth().deleteUser(employeeUid);
    } catch (authError: any) {
      if (authError.code !== "auth/user-not-found") {
        throw authError;
      }
      console.log(`Auth user ${employeeUid} not found, proceeding to delete Firestore document.`);
    }

    // 2. Delete Firestore Document
    await db.collection("users").doc(employeeUid).delete();

    // 3. Log the deletion securely
    const callerName = callerDoc.data()?.fullName || "Unknown User";
    await db.collection("audit_logs").add({
      actorName: callerName,
      actorUid: context.auth.uid,
      action: "Deleted Employee",
      target: employeeUid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error deleting employee:", error);
    throw new functions.https.HttpsError("internal", error.message || "Failed to delete employee.");
  }
});
