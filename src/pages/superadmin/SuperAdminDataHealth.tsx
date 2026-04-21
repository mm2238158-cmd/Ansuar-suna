import { useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  updateDoc,
  type Timestamp,
} from "firebase/firestore";
import { deleteObject, listAll, ref as storageRef, type StorageReference } from "firebase/storage";
import { AlertTriangle, CheckCircle2, ChevronDown, Database, Wrench } from "lucide-react";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AppUser, Assignment, Month, Payment } from "@/lib/types";

type BrokenPaymentIssue = {
  paymentId: string;
  userId: string;
  monthId: string;
  screenshotPath?: string | null;
  reason: "missing_user" | "missing_month" | "missing_user_and_month";
};

type DuplicatePaymentIssue = {
  paymentId: string;
  userId: string;
  monthId: string;
  submittedAt?: Timestamp;
  screenshotPath?: string | null;
};

type BadAssignmentIssue = {
  assignmentId: string;
  adminId: string;
  memberId: string;
  missingAdmin: boolean;
  missingMember: boolean;
};

type InvalidAdminLinkIssue = {
  userId: string;
  userName: string;
  assignedAdminId: string;
  reason: "missing_admin" | "not_admin";
};

const getStoragePathFromUrl = (url: string): string | null => {
  if (!url) return null;
  if (url.startsWith("payments/")) return url;

  try {
    return storageRef(storage, url).fullPath;
  } catch {
    // Fallback for raw download URL parsing.
  }

  const matched = url.match(/\/o\/([^?]+)/);
  if (!matched) return null;

  try {
    return decodeURIComponent(matched[1]);
  } catch {
    return null;
  }
};

const timestampMs = (value?: Timestamp) => (value ? value.toDate().getTime() : 0);

const listAllFilesRecursive = async (folderRef: StorageReference): Promise<StorageReference[]> => {
  const files: StorageReference[] = [];
  const { items, prefixes } = await listAll(folderRef);
  files.push(...items);

  for (const prefix of prefixes) {
    const nested = await listAllFilesRecursive(prefix);
    files.push(...nested);
  }

  return files;
};

const SuperAdminDataHealth = () => {
  const { appUser } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const [auditLoading, setAuditLoading] = useState(false);
  const [auditedAt, setAuditedAt] = useState<Date | null>(null);
  const [fixingKeys, setFixingKeys] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    orphanedFiles: true,
    brokenPayments: false,
    duplicatePayments: false,
    badAssignments: false,
    invalidAdminLinks: false,
  });

  const [orphanedFiles, setOrphanedFiles] = useState<string[]>([]);
  const [brokenPayments, setBrokenPayments] = useState<BrokenPaymentIssue[]>([]);
  const [duplicatePayments, setDuplicatePayments] = useState<DuplicatePaymentIssue[]>([]);
  const [badAssignments, setBadAssignments] = useState<BadAssignmentIssue[]>([]);
  const [invalidAdminLinks, setInvalidAdminLinks] = useState<InvalidAdminLinkIssue[]>([]);

  const isFounderSuperAdmin = appUser?.role === "super_admin" && !!appUser?.isFounder;

  const setFixing = (key: string, value: boolean) => {
    setFixingKeys((prev) => {
      const next = new Set(prev);
      if (value) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const withFixState = async (key: string, runner: () => Promise<void>) => {
    setFixing(key, true);
    try {
      await runner();
    } finally {
      setFixing(key, false);
    }
  };

  const runAudit = async () => {
    if (!isFounderSuperAdmin) return;
    setAuditLoading(true);

    try {
      const [usersSnap, monthsSnap, paymentsSnap, assignmentsSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "months")),
        getDocs(collection(db, "payments")),
        getDocs(collection(db, "assignments")),
      ]);

      const users = usersSnap.docs.map((item) => ({ id: item.id, ...item.data() } as AppUser));
      const months = monthsSnap.docs.map((item) => ({ id: item.id, ...item.data() } as Month));
      const payments = paymentsSnap.docs.map((item) => ({ id: item.id, ...item.data() } as Payment));
      const assignments = assignmentsSnap.docs.map(
        (item) => ({ id: item.id, ...item.data() } as Assignment)
      );

      const userMap = new Map(users.map((u) => [u.id, u]));
      const monthSet = new Set(months.map((m) => m.id));

      const paymentScreenshotPathById = new Map<string, string | null>();
      const referencedScreenshotPaths = new Set<string>();
      for (const payment of payments) {
        const path = getStoragePathFromUrl(payment.screenshotUrl);
        paymentScreenshotPathById.set(payment.id, path);
        if (path) referencedScreenshotPaths.add(path);
      }

      const paymentRootRef = storageRef(storage, "payments");
      const fileRefs = await listAllFilesRecursive(paymentRootRef).catch(() => []);
      const storagePaths = fileRefs.map((item) => item.fullPath);
      const nextOrphaned = storagePaths.filter((fullPath) => !referencedScreenshotPaths.has(fullPath));

      const nextBrokenPayments = payments
        .filter((payment) => !userMap.has(payment.userId) || !monthSet.has(payment.monthId))
        .map((payment) => {
          const missingUser = !userMap.has(payment.userId);
          const missingMonth = !monthSet.has(payment.monthId);
          const reason: BrokenPaymentIssue["reason"] =
            missingUser && missingMonth
              ? "missing_user_and_month"
              : missingUser
                ? "missing_user"
                : "missing_month";

          return {
            paymentId: payment.id,
            userId: payment.userId,
            monthId: payment.monthId,
            screenshotPath: paymentScreenshotPathById.get(payment.id),
            reason,
          };
        });

      const grouped = new Map<string, Payment[]>();
      for (const payment of payments) {
        const key = `${payment.userId}::${payment.monthId}`;
        const list = grouped.get(key) ?? [];
        list.push(payment);
        grouped.set(key, list);
      }

      const nextDuplicatePayments: DuplicatePaymentIssue[] = [];
      grouped.forEach((group) => {
        if (group.length < 2) return;
        const sorted = [...group].sort((a, b) => timestampMs(b.submittedAt) - timestampMs(a.submittedAt));
        const older = sorted.slice(1);
        older.forEach((payment) => {
          nextDuplicatePayments.push({
            paymentId: payment.id,
            userId: payment.userId,
            monthId: payment.monthId,
            submittedAt: payment.submittedAt,
            screenshotPath: paymentScreenshotPathById.get(payment.id),
          });
        });
      });

      const nextBadAssignments = assignments
        .filter((a) => !userMap.has(a.adminId) || !userMap.has(a.memberId))
        .map((a) => ({
          assignmentId: a.id,
          adminId: a.adminId,
          memberId: a.memberId,
          missingAdmin: !userMap.has(a.adminId),
          missingMember: !userMap.has(a.memberId),
        }));

      const nextInvalidAdminLinks = users
        .filter((user) => !!user.assignedAdminId)
        .map((user) => {
          const linkedAdmin = user.assignedAdminId ? userMap.get(user.assignedAdminId) : null;
          if (!linkedAdmin) {
            return {
              userId: user.id,
              userName: user.name || user.email,
              assignedAdminId: user.assignedAdminId as string,
              reason: "missing_admin" as const,
            };
          }
          if (linkedAdmin.role !== "admin") {
            return {
              userId: user.id,
              userName: user.name || user.email,
              assignedAdminId: user.assignedAdminId as string,
              reason: "not_admin" as const,
            };
          }
          return null;
        })
        .filter((item): item is InvalidAdminLinkIssue => item !== null);

      setOrphanedFiles(nextOrphaned);
      setBrokenPayments(nextBrokenPayments);
      setDuplicatePayments(nextDuplicatePayments);
      setBadAssignments(nextBadAssignments);
      setInvalidAdminLinks(nextInvalidAdminLinks);
      setAuditedAt(new Date());
    } catch (error) {
      toast({
        title: t.superAdmin.dataHealthAuditFailed,
        description: t.superAdmin.dataHealthTryAgain,
        variant: "destructive",
      });
    } finally {
      setAuditLoading(false);
    }
  };

  const deleteStoragePathIfExists = async (path: string | null | undefined) => {
    if (!path) return;
    try {
      await deleteObject(storageRef(storage, path));
    } catch {
      // Missing file is considered already cleaned.
    }
  };

  const deleteBrokenPayment = async (issue: BrokenPaymentIssue) => {
    if (!window.confirm(t.superAdmin.dataHealthConfirmDeletePayment)) return;
    await deleteDoc(doc(db, "payments", issue.paymentId));
    await deleteStoragePathIfExists(issue.screenshotPath);
    await runAudit();
    toast({ title: t.superAdmin.dataHealthFixSuccess });
  };

  const deleteDuplicatePayment = async (issue: DuplicatePaymentIssue) => {
    if (!window.confirm(t.superAdmin.dataHealthConfirmDeleteDuplicate)) return;
    await deleteDoc(doc(db, "payments", issue.paymentId));
    await deleteStoragePathIfExists(issue.screenshotPath);
    await runAudit();
    toast({ title: t.superAdmin.dataHealthFixSuccess });
  };

  const deleteBadAssignment = async (issue: BadAssignmentIssue) => {
    if (!window.confirm(t.superAdmin.dataHealthConfirmDeleteAssignment)) return;
    await deleteDoc(doc(db, "assignments", issue.assignmentId));
    await runAudit();
    toast({ title: t.superAdmin.dataHealthFixSuccess });
  };

  const clearInvalidAdminLink = async (issue: InvalidAdminLinkIssue) => {
    if (!window.confirm(t.superAdmin.dataHealthConfirmClearAdminLink)) return;
    await updateDoc(doc(db, "users", issue.userId), { assignedAdminId: deleteField() });
    await runAudit();
    toast({ title: t.superAdmin.dataHealthFixSuccess });
  };

  const deleteOrphanedFile = async (path: string) => {
    if (!window.confirm(t.superAdmin.dataHealthConfirmDeleteFile)) return;
    await deleteStoragePathIfExists(path);
    await runAudit();
    toast({ title: t.superAdmin.dataHealthFixSuccess });
  };

  const busy = auditLoading || fixingKeys.size > 0;
  const summary = useMemo(
    () => [
      {
        key: "orphanedFiles",
        label: t.superAdmin.dataHealthOrphanedFiles,
        count: orphanedFiles.length,
        fixAllLabel: t.superAdmin.dataHealthFixAll,
      },
      {
        key: "brokenPayments",
        label: t.superAdmin.dataHealthBrokenPayments,
        count: brokenPayments.length,
        fixAllLabel: t.superAdmin.dataHealthFixAll,
      },
      {
        key: "duplicatePayments",
        label: t.superAdmin.dataHealthDuplicatePayments,
        count: duplicatePayments.length,
        fixAllLabel: t.superAdmin.dataHealthFixAll,
      },
      {
        key: "badAssignments",
        label: t.superAdmin.dataHealthBadAssignments,
        count: badAssignments.length,
        fixAllLabel: t.superAdmin.dataHealthFixAll,
      },
      {
        key: "invalidAdminLinks",
        label: t.superAdmin.dataHealthInvalidAdminLinks,
        count: invalidAdminLinks.length,
        fixAllLabel: t.superAdmin.dataHealthFixAll,
      },
    ],
    [t, orphanedFiles.length, brokenPayments.length, duplicatePayments.length, badAssignments.length, invalidAdminLinks.length]
  );

  if (!isFounderSuperAdmin) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-display font-bold">{t.superAdmin.dataHealthTitle}</h1>
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {t.superAdmin.dataHealthAccessDeniedTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {t.superAdmin.dataHealthAccessDeniedDescription}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold">{t.superAdmin.dataHealthTitle}</h1>
          {auditedAt ? (
            <p className="text-xs text-muted-foreground mt-1">
              {t.superAdmin.dataHealthLastRun}: {auditedAt.toLocaleString()}
            </p>
          ) : null}
        </div>
        <Button onClick={runAudit} disabled={busy}>
          <Database className="h-4 w-4" />
          {auditLoading ? t.common.loading : t.superAdmin.dataHealthRunAudit}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 divide-y">
          {summary.map((item) => (
            <div key={item.key}>
              <div className="p-4 flex items-center justify-between gap-3">
                <button
                  className="flex items-center gap-3 min-w-0 text-left"
                  onClick={() => setExpanded((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                  type="button"
                >
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      expanded[item.key] ? "rotate-180" : ""
                    }`}
                  />
                  <span className="font-medium">{item.label}</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums">{item.count}</span>
                  {item.count === 0 ? (
                    <span className="text-xs px-2 py-1 rounded-md bg-success/10 text-success inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {t.superAdmin.dataHealthClean}
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={async () => {
                        if (item.key === "orphanedFiles") {
                          await withFixState(`fix-all-${item.key}`, async () => {
                            if (!window.confirm(t.superAdmin.dataHealthConfirmDeleteAllFiles)) return;
                            for (const path of orphanedFiles) {
                              await deleteStoragePathIfExists(path);
                            }
                            await runAudit();
                            toast({ title: t.superAdmin.dataHealthFixSuccess });
                          });
                        }
                        if (item.key === "brokenPayments") {
                          await withFixState(`fix-all-${item.key}`, async () => {
                            if (!window.confirm(t.superAdmin.dataHealthConfirmDeleteAllBrokenPayments)) return;
                            for (const issue of brokenPayments) {
                              await deleteDoc(doc(db, "payments", issue.paymentId));
                              await deleteStoragePathIfExists(issue.screenshotPath);
                            }
                            await runAudit();
                            toast({ title: t.superAdmin.dataHealthFixSuccess });
                          });
                        }
                        if (item.key === "duplicatePayments") {
                          await withFixState(`fix-all-${item.key}`, async () => {
                            if (!window.confirm(t.superAdmin.dataHealthConfirmDeleteAllDuplicates)) return;
                            for (const issue of duplicatePayments) {
                              await deleteDoc(doc(db, "payments", issue.paymentId));
                              await deleteStoragePathIfExists(issue.screenshotPath);
                            }
                            await runAudit();
                            toast({ title: t.superAdmin.dataHealthFixSuccess });
                          });
                        }
                        if (item.key === "badAssignments") {
                          await withFixState(`fix-all-${item.key}`, async () => {
                            if (!window.confirm(t.superAdmin.dataHealthConfirmDeleteAllAssignments)) return;
                            for (const issue of badAssignments) {
                              await deleteDoc(doc(db, "assignments", issue.assignmentId));
                            }
                            await runAudit();
                            toast({ title: t.superAdmin.dataHealthFixSuccess });
                          });
                        }
                        if (item.key === "invalidAdminLinks") {
                          await withFixState(`fix-all-${item.key}`, async () => {
                            if (!window.confirm(t.superAdmin.dataHealthConfirmClearAllAdminLinks)) return;
                            for (const issue of invalidAdminLinks) {
                              await updateDoc(doc(db, "users", issue.userId), { assignedAdminId: deleteField() });
                            }
                            await runAudit();
                            toast({ title: t.superAdmin.dataHealthFixSuccess });
                          });
                        }
                      }}
                    >
                      <Wrench className="h-3.5 w-3.5" />
                      {item.fixAllLabel}
                    </Button>
                  )}
                </div>
              </div>

              {expanded[item.key] ? (
                <div className="px-4 pb-4">
                  {item.key === "orphanedFiles" && (
                    <div className="space-y-2">
                      {orphanedFiles.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t.superAdmin.dataHealthNoIssuesInCategory}</p>
                      ) : (
                        orphanedFiles.map((path) => (
                          <div
                            key={path}
                            className="border rounded-md p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                          >
                            <p className="text-sm break-all">{path}</p>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={busy}
                              onClick={() =>
                                withFixState(`orphan-${path}`, async () => {
                                  await deleteOrphanedFile(path);
                                })
                              }
                            >
                              {t.superAdmin.dataHealthFix}
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {item.key === "brokenPayments" && (
                    <div className="space-y-2">
                      {brokenPayments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t.superAdmin.dataHealthNoIssuesInCategory}</p>
                      ) : (
                        brokenPayments.map((issue) => (
                          <div
                            key={issue.paymentId}
                            className="border rounded-md p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                          >
                            <div className="text-sm">
                              <p className="font-medium">{t.superAdmin.dataHealthPaymentId}: {issue.paymentId}</p>
                              <p className="text-muted-foreground">
                                {t.superAdmin.dataHealthReason}: {issue.reason}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={busy}
                              onClick={() =>
                                withFixState(`broken-${issue.paymentId}`, async () => {
                                  await deleteBrokenPayment(issue);
                                })
                              }
                            >
                              {t.superAdmin.dataHealthFix}
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {item.key === "duplicatePayments" && (
                    <div className="space-y-2">
                      {duplicatePayments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t.superAdmin.dataHealthNoIssuesInCategory}</p>
                      ) : (
                        duplicatePayments.map((issue) => (
                          <div
                            key={issue.paymentId}
                            className="border rounded-md p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                          >
                            <div className="text-sm">
                              <p className="font-medium">{t.superAdmin.dataHealthPaymentId}: {issue.paymentId}</p>
                              <p className="text-muted-foreground">
                                {t.superAdmin.dataHealthDuplicateKey}: {issue.userId} / {issue.monthId}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={busy}
                              onClick={() =>
                                withFixState(`duplicate-${issue.paymentId}`, async () => {
                                  await deleteDuplicatePayment(issue);
                                })
                              }
                            >
                              {t.superAdmin.dataHealthFix}
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {item.key === "badAssignments" && (
                    <div className="space-y-2">
                      {badAssignments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t.superAdmin.dataHealthNoIssuesInCategory}</p>
                      ) : (
                        badAssignments.map((issue) => (
                          <div
                            key={issue.assignmentId}
                            className="border rounded-md p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                          >
                            <div className="text-sm">
                              <p className="font-medium">{t.superAdmin.dataHealthAssignmentId}: {issue.assignmentId}</p>
                              <p className="text-muted-foreground">
                                {issue.missingAdmin ? t.superAdmin.dataHealthMissingAdmin : ""}{" "}
                                {issue.missingMember ? t.superAdmin.dataHealthMissingMember : ""}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={busy}
                              onClick={() =>
                                withFixState(`assignment-${issue.assignmentId}`, async () => {
                                  await deleteBadAssignment(issue);
                                })
                              }
                            >
                              {t.superAdmin.dataHealthFix}
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {item.key === "invalidAdminLinks" && (
                    <div className="space-y-2">
                      {invalidAdminLinks.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t.superAdmin.dataHealthNoIssuesInCategory}</p>
                      ) : (
                        invalidAdminLinks.map((issue) => (
                          <div
                            key={issue.userId}
                            className="border rounded-md p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                          >
                            <div className="text-sm">
                              <p className="font-medium">{issue.userName}</p>
                              <p className="text-muted-foreground">
                                {t.superAdmin.dataHealthInvalidAdmin}: {issue.assignedAdminId} ({issue.reason})
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={busy}
                              onClick={() =>
                                withFixState(`admin-link-${issue.userId}`, async () => {
                                  await clearInvalidAdminLink(issue);
                                })
                              }
                            >
                              {t.superAdmin.dataHealthFix}
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminDataHealth;
