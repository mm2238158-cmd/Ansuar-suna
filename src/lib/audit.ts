import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logError } from "@/lib/logger";

export type AuditAction =
  | "role.change"
  | "user.activate"
  | "user.deactivate"
  | "user.assign_admin"
  | "payment.approve"
  | "payment.reject"
  | "month.create"
  | "month.update"
  | "settings.update"
  | "announcement.create"
  | "data_health.delete";

/**
 * Append-only audit trail for privileged actions.
 * Best effort: never blocks or fails the action it records.
 */
export const writeAuditLog = async (
  action: AuditAction,
  actorId: string | undefined,
  details: Record<string, unknown> = {}
) => {
  if (!actorId) return;
  try {
    await addDoc(collection(db, "auditLogs"), {
      action,
      actorId,
      details,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    logError("audit", err, { action, actorId });
  }
};
