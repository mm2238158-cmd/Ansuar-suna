import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  Timestamp,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Payment, AppUser as UserType, Month } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Clock, Receipt } from "lucide-react";
import PaymentReviewDialog from "@/components/PaymentReviewDialog";
import PaymentStatusBadge from "@/components/PaymentStatusBadge";
import ListToolbar from "@/components/ListToolbar";
import EmptyState from "@/components/EmptyState";
import { ListSkeleton } from "@/components/ListSkeleton";
import { logError } from "@/lib/logger";
import { writeAuditLog } from "@/lib/audit";

const AdminPayments = () => {
  const { appUser } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [users, setUsers] = useState<Record<string, UserType>>({});
  const [months, setMonths] = useState<Record<string, Month>>({});
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appUser) return;
    let unsubscribers: (() => void)[] = [];

    const init = async () => {
      try {
        const assignSnap = await getDocs(
          query(collection(db, "assignments"), where("adminId", "==", appUser.id))
        );
        const memberIds = assignSnap.docs.map((d) => d.data().memberId as string);
        if (memberIds.length === 0) {
          setLoading(false);
          return;
        }

        const usersMap: Record<string, UserType> = {};
        for (let i = 0; i < memberIds.length; i += 10) {
          const batch = memberIds.slice(i, i + 10);
          const usersSnap = await getDocs(
            query(collection(db, "users"), where("__name__", "in", batch))
          );
          usersSnap.docs.forEach((d) => {
            usersMap[d.id] = { id: d.id, ...d.data() } as UserType;
          });
        }
        setUsers(usersMap);

        const monthsSnap = await getDocs(collection(db, "months"));
        const m: Record<string, Month> = {};
        monthsSnap.docs.forEach((d) => {
          m[d.id] = { id: d.id, ...d.data() } as Month;
        });
        setMonths(m);

        // Live verification queue: approvals show up immediately.
        const chunks: string[][] = [];
        for (let i = 0; i < memberIds.length; i += 10) chunks.push(memberIds.slice(i, i + 10));
        const byChunk: Record<number, Payment[]> = {};

        unsubscribers = chunks.map((batch, index) =>
          onSnapshot(
            query(
              collection(db, "payments"),
              where("userId", "in", batch),
              orderBy("submittedAt", "desc")
            ),
            (snap) => {
              byChunk[index] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Payment));
              setPayments(
                Object.values(byChunk)
                  .flat()
                  .sort((a, b) => b.submittedAt.toMillis() - a.submittedAt.toMillis())
              );
              setLoading(false);
            },
            (err) => {
              logError("admin-payments/snapshot", err);
              setLoading(false);
            }
          )
        );
      } catch (err) {
        logError("admin-payments/init", err);
        setLoading(false);
      }
    };

    init();
    return () => unsubscribers.forEach((fn) => fn());
  }, [appUser]);

  const openReview = (p: Payment) => {
    setSelectedPayment(p);
    setComment(p.adminComment || "");
  };

  const closeReview = () => {
    setSelectedPayment(null);
    setComment("");
  };

  const handleAction = async (status: "approved" | "rejected") => {
    if (!selectedPayment) return;
    if (status === "rejected" && !comment.trim()) {
      toast({ title: t.admin.rejectRequiresComment, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const updates: Record<string, unknown> = {
        status,
        verifiedBy: appUser?.id,
        verifiedAt: Timestamp.now(),
      };
      if (comment.trim()) updates.adminComment = comment.trim().slice(0, 500);
      await updateDoc(doc(db, "payments", selectedPayment.id), updates);
      setPayments((prev) =>
        prev.map((p) =>
          p.id === selectedPayment.id
            ? { ...p, status, adminComment: comment.trim() || p.adminComment }
            : p
        )
      );
      void writeAuditLog(status === "approved" ? "payment.approve" : "payment.reject", appUser?.id, {
        paymentId: selectedPayment.id,
        memberId: selectedPayment.userId,
        amount: selectedPayment.amount,
      });
      toast({ title: status === "approved" ? `✓ ${t.status.approved}` : `✗ ${t.status.rejected}` });
      closeReview();
    } catch (err) {
      logError("admin-payments/verify", err, { paymentId: selectedPayment.id });
      toast({
        title: t.toasts.error,
        description: t.toasts.somethingWentWrong,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = statusFilter === "all" ? payments : payments.filter((p) => p.status === statusFilter);
    if (term) {
      list = list.filter((p) => {
        const name = users[p.userId]?.name?.toLowerCase() ?? "";
        const month = months[p.monthId]?.name?.toLowerCase() ?? "";
        return name.includes(term) || month.includes(term) || String(p.amount).includes(term);
      });
    }
    if (statusFilter === "all") {
      const order: Record<string, number> = { pending: 0, late: 1, rejected: 2, approved: 3 };
      return [...list].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
    }
    return list;
  }, [payments, statusFilter, search, users, months]);

  const rowTone = (status: string) => {
    if (status === "pending") return "bg-warning/5 border-l-4 border-l-warning";
    if (status === "approved") return "opacity-70";
    if (status === "rejected") return "bg-destructive/5";
    return "";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">{t.admin.verificationQueue}</h1>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36" aria-label={t.common.filter}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.common.all}</SelectItem>
            <SelectItem value="pending">{t.status.pending}</SelectItem>
            <SelectItem value="approved">{t.status.approved}</SelectItem>
            <SelectItem value="rejected">{t.status.rejected}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ListToolbar
        id="admin-payments-search"
        value={search}
        onChange={setSearch}
        placeholder={`${t.common.search} ${t.admin.memberName.toLowerCase()}...`}
      />

      {loading ? (
        <ListSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={search ? t.common.noResults : t.member.noPayments}
          description={
            search ? undefined : "Payments submitted by your assigned members will appear here."
          }
        />
      ) : (
        <>
          {/* Mobile view */}
          <div className="space-y-3 md:hidden">
            {filtered.map((p) => (
              <Card
                key={p.id}
                className={`cursor-pointer transition-all hover:shadow-md ${rowTone(p.status)}`}
                onClick={() => openReview(p)}
              >
                <CardContent className="space-y-2 p-4">
                  {p.status === "pending" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
                      <Clock className="h-2.5 w-2.5" aria-hidden="true" /> {t.admin.actionNeeded}
                    </span>
                  )}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{users[p.userId]?.name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{months[p.monthId]?.name}</p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="text-sm font-semibold">{p.amount.toLocaleString()} ETB</p>
                      <PaymentStatusBadge status={p.status} />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      openReview(p);
                    }}
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" /> {t.admin.reviewPayment}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop view */}
          <div className="hidden md:block">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.admin.memberName}</TableHead>
                    <TableHead>{t.member.month}</TableHead>
                    <TableHead>{t.common.amount}</TableHead>
                    <TableHead>{t.admin.paymentDate}</TableHead>
                    <TableHead>{t.common.status}</TableHead>
                    <TableHead>{t.common.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id} className={rowTone(p.status)}>
                      <TableCell>{users[p.userId]?.name || "Unknown"}</TableCell>
                      <TableCell>{months[p.monthId]?.name}</TableCell>
                      <TableCell className="font-medium">{p.amount.toLocaleString()} ETB</TableCell>
                      <TableCell>{p.submittedAt.toDate().toLocaleDateString()}</TableCell>
                      <TableCell>
                        <PaymentStatusBadge status={p.status} />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => openReview(p)}
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" /> {t.admin.reviewPayment}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        </>
      )}

      <PaymentReviewDialog
        payment={selectedPayment}
        memberName={selectedPayment ? users[selectedPayment.userId]?.name : undefined}
        month={selectedPayment ? months[selectedPayment.monthId] : undefined}
        comment={comment}
        onCommentChange={setComment}
        submitting={submitting}
        onAction={handleAction}
        onClose={closeReview}
      />
    </div>
  );
};

export default AdminPayments;
