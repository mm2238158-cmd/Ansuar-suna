import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getEligibleAdmins, pickLeastLoadedAdmin } from "./assignment";

const ensureAdmin = () => {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
};

async function fetchAdminAssignmentCounts(): Promise<Record<string, number>> {
  ensureAdmin();
  const snap = await admin.firestore().collection("assignments").get();
  const counts: Record<string, number> = {};
  snap.docs.forEach((d) => {
    const adminId = d.data().adminId as string;
    counts[adminId] = (counts[adminId] ?? 0) + 1;
  });
  return counts;
}

export const activateAccount = onCall({ cors: true }, async (request) => {
  ensureAdmin();

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const uid = request.auth.uid;
  const authUser = await admin.auth().getUser(uid);

  if (!authUser.emailVerified) {
    throw new HttpsError("failed-precondition", "Email is not verified yet.");
  }

  if (!authUser.phoneNumber) {
    throw new HttpsError("failed-precondition", "Phone number is not verified yet.");
  }

  const db = admin.firestore();
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw new HttpsError("not-found", "User profile not found.");
  }

  const userData = userSnap.data()!;

  if (userData.role !== "member") {
    throw new HttpsError("permission-denied", "Only members can use this activation flow.");
  }

  if (userData.status === "active" && userData.isActive === true) {
    return { success: true, alreadyActive: true, assignedAdminId: userData.assignedAdminId ?? null };
  }

  if (userData.status !== "pending") {
    throw new HttpsError("failed-precondition", "Account is not eligible for activation.");
  }

  const adminsSnap = await db.collection("users").where("role", "==", "admin").get();
  const admins = adminsSnap.docs.map((d) => ({
    id: d.id,
    name: (d.data().name as string) || "",
    gender: d.data().gender as "male" | "female" | undefined,
    isActive: d.data().isActive as boolean | undefined,
    role: d.data().role as string,
  }));

  const eligible = getEligibleAdmins(admins, userData.gender as "male" | "female" | undefined);
  const counts = await fetchAdminAssignmentCounts();
  const bestAdmin = pickLeastLoadedAdmin(eligible, counts);

  const now = admin.firestore.FieldValue.serverTimestamp();
  const existingAssignments = await db.collection("assignments").where("memberId", "==", uid).get();

  const batch = db.batch();
  existingAssignments.docs.forEach((docSnap) => batch.delete(docSnap.ref));

  if (bestAdmin) {
    const assignmentRef = db.collection("assignments").doc();
    batch.set(assignmentRef, {
      adminId: bestAdmin.id,
      memberId: uid,
      assignedAt: now,
    });
    batch.update(userRef, {
      status: "active",
      isActive: true,
      emailVerified: true,
      phoneVerified: true,
      activatedAt: now,
      assignedAdminId: bestAdmin.id,
    });
  } else {
    batch.update(userRef, {
      status: "active",
      isActive: true,
      emailVerified: true,
      phoneVerified: true,
      activatedAt: now,
    });
  }

  await batch.commit();

  return {
    success: true,
    assignedAdminId: bestAdmin?.id ?? null,
    noAdminAvailable: !bestAdmin,
  };
});
