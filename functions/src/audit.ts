import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

export const logAudit = functions.https.onCall(async (data, context) => {
  // 1. Verify Authentication
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }

  const { action, target, details } = data;

  if (!action || !target) {
    throw new functions.https.HttpsError("invalid-argument", "Action and target are required.");
  }

  const uid = context.auth.uid;
  const db = admin.firestore();

  try {
    // 2. Fetch actor name securely
    const userDoc = await db.collection("users").doc(uid).get();
    const actorName = userDoc.exists ? userDoc.data()?.fullName || "Unknown User" : "Unknown User";

    // 3. Write to audit_logs
    await db.collection("audit_logs").add({
      actorName,
      actorUid: uid,
      action,
      target,
      details: details || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error("Error logging audit:", error);
    throw new functions.https.HttpsError("internal", "Failed to log audit event.");
  }
});
