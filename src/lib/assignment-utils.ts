import { collection, getDocs } from "firebase/firestore";
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

/** Pick the eligible admin with the fewest assigned members; ties broken by name then id. */
export const pickLeastLoadedAdmin = (
  eligibleAdmins: AppUser[],
  counts: Record<string, number>
): AppUser | null => {
  if (eligibleAdmins.length === 0) return null;
  if (eligibleAdmins.length === 1) return eligibleAdmins[0];

  const load = (admin: AppUser) => counts[admin.id] ?? 0;

  return [...eligibleAdmins].sort((a, b) => {
    const diff = load(a) - load(b);
    if (diff !== 0) return diff;
    const nameDiff = a.name.localeCompare(b.name);
    if (nameDiff !== 0) return nameDiff;
    return a.id.localeCompare(b.id);
  })[0];
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
