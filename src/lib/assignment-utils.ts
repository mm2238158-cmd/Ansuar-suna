import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AppUser } from "@/lib/types";

/** Count active assignments per admin id from the assignments collection. */
export const fetchAdminAssignmentCounts = async (): Promise<Record<string, number>> => {
  const snap = await getDocs(collection(db, "assignments"));
  const counts: Record<string, number> = {};
  snap.docs.forEach((d) => {
    const adminId = d.data().adminId as string;
    counts[adminId] = (counts[adminId] ?? 0) + 1;
  });
  return counts;
};

/** Eligible admins sorted by load (ascending) for manual assign UI. */
export const sortAdminsByLoad = (
  admins: AppUser[],
  counts: Record<string, number>
): AppUser[] =>
  [...admins].sort((a, b) => {
    const diff = (counts[a.id] ?? 0) - (counts[b.id] ?? 0);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });

/** Admins a member may be assigned to: active admins, gender-matched when both sides know it. */
export const eligibleAdminsFor = (admins: AppUser[], member?: AppUser | null): AppUser[] => {
  const active = admins.filter((a) => a.role === "admin" && a.isActive);
  if (!member?.gender) return active;
  const matched = active.filter((a) => a.gender === member.gender);
  return matched.length ? matched : active;
};

const deleteAssignmentsFor = async (memberId: string) => {
  const snap = await getDocs(query(collection(db, "assignments"), where("memberId", "==", memberId)));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
};

/** Single source of truth: assignment doc + user.assignedAdminId always written together. */
export const assignMember = async (memberId: string, adminId: string) => {
  await deleteAssignmentsFor(memberId);
  const batch = writeBatch(db);
  batch.set(doc(collection(db, "assignments")), {
    adminId,
    memberId,
    assignedAt: serverTimestamp(),
  });
  batch.update(doc(db, "users", memberId), { assignedAdminId: adminId });
  await batch.commit();
};

export const unassignMember = async (memberId: string) => {
  await deleteAssignmentsFor(memberId);
  await updateDoc(doc(db, "users", memberId), { assignedAdminId: null });
};

/** Assign many members to one admin. */
export const bulkAssign = async (memberIds: string[], adminId: string) => {
  for (const memberId of memberIds) {
    await assignMember(memberId, adminId);
  }
};

/**
 * Spread unassigned members across eligible admins, keeping loads even.
 * Returns the planned pairs without writing anything (preview-friendly).
 */
export const planBalancedAssignments = (
  members: AppUser[],
  admins: AppUser[],
  counts: Record<string, number>
): { memberId: string; adminId: string }[] => {
  const load: Record<string, number> = { ...counts };
  const plan: { memberId: string; adminId: string }[] = [];

  for (const member of members) {
    const eligible = eligibleAdminsFor(admins, member);
    if (!eligible.length) continue;
    const target = sortAdminsByLoad(eligible, load)[0];
    load[target.id] = (load[target.id] ?? 0) + 1;
    plan.push({ memberId: member.id, adminId: target.id });
  }

  return plan;
};

export const applyAssignmentPlan = async (plan: { memberId: string; adminId: string }[]) => {
  for (const { memberId, adminId } of plan) {
    await assignMember(memberId, adminId);
  }
};
