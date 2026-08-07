import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, orderBy, query, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Payment, AppUser as UserType, Month } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import PaymentReviewDialog from "@/components/PaymentReviewDialog";
import PaymentStatusBadge from "@/components/PaymentStatusBadge";
import ListToolbar from "@/components/ListToolbar";
import EmptyState from "@/components/EmptyState";
import { ListSkeleton } from "@/components/ListSkeleton";
import { downloadCsv, timestampedFilename, toCsv } from "@/lib/csv";
import { logError } from "@/lib/logger";
import { writeAuditLog } from "@/lib/audit";

const PAGE_SIZE = 25;

const SuperAdminPayments = () => {
  const { t } = useLanguage();
  const { appUser } = useAuth();
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [users, setUsers] = useState<Record<string, UserType>>({});
  const [months, setMonths] = useState<Record<string, Month>>({});
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const paySnap = await getDocs(
          query(collection(db, "payments"), orderBy("submittedAt", "desc"))
        );
        setPayments(paySnap.docs.map((d) => ({ id: d.id, ...d.data() } as Payment)));

        const usersSnap = await getDocs(collection(db, "users"));
        const u: Record<string, UserType> = {};
        usersSnap.docs.forEach((d) => {
          u[d.id] = { id: d.id, ...d.data() } as UserType;
        });
        setUsers(u);

        const monthsSnap = await getDocs(collection(db, "months"));
        const m: Record<string, Month> = {};
        monthsSnap.docs.forEach((d) => {
          m[d.id] = { id: d.id, ...d.data() } as Month;
        });
        setMonths(m);
      } catch (err) {
        logError("superadmin-payments/fetch", err);
        toast({
          title: t.toasts.error,
          description: t.toasts.somethingWentWrong,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!term) return true;
      const name = users[p.userId]?.name?.toLowerCase() ?? "";
      const email = users[p.userId]?.email?.toLowerCase() ?? "";
      const month = months[p.monthId]?.name?.toLowerCase() ?? "";
      return (
        name.includes(term) ||
        email.includes(term) ||
        month.includes(term) ||
        String(p.amount).includes(term)
      );
    });
  }, [payments, statusFilter, search, users, months]);

  useEffect(() => setPage(0), [statusFilter, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const exportCsv = () => {
    const csv = toCsv(filtered, [
      { key: "member", header: "Member", value: (p) => users[p.userId]?.name ?? p.userId },
      { key: "email", header: "Email", value: (p) => users[p.userId]?.email ?? "" },
      { key: "month", header: "Month", value: (p) => months[p.monthId]?.name ?? p.monthId },
      { key: "amount", header: "Amount (ETB)", value: (p) => p.amount },
      { key: "penalty", header: "Penalty (ETB)", value: (p) => p.penaltyAmount ?? 0 },
      { key: "status", header: "Status", value: (p) => p.status },
      { key: "late", header: "Late", value: (p) => (p.isLate ? "yes" : "no") },
      {
        key: "submitted",
        header: "Submitted at",
        value: (p) => p.submittedAt.toDate().toISOString(),
      },
      {
        key: "verified",
        header: "Verified at",
        value: (p) => (p.verifiedAt ? p.verifiedAt.toDate().toISOString() : ""),
      },
      { key: "comment", header: "Admin comment", value: (p) => p.adminComment ?? "" },
    ]);
    downloadCsv(timestampedFilename("payments"), csv);
    toast({ title: t.toasts.exported });
  };

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
      logError("superadmin-payments/verify", err, { paymentId: selectedPayment.id });
      toast({
        title: t.toasts.error,
        description: t.toasts.somethingWentWrong,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">{t.nav.payments}</h1>
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
        id="superadmin-payments-search"
        value={search}
        onChange={setSearch}
        onExport={filtered.length ? exportCsv : undefined}
      />

      {loading ? (
        <ListSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={search || statusFilter !== "all" ? t.common.noResults : t.member.noPayments}
          description={
            search || statusFilter !== "all"
              ? undefined
              : "Once members start submitting contributions they will be listed here."
          }
        />
      ) : (
        <>
          {/* Mobile */}
          <div className="space-y-3 md:hidden">
            {visible.map((p) => (
              <Card
                key={p.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => openReview(p)}
              >
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{users[p.userId]?.name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{months[p.monthId]?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.submittedAt.toDate().toLocaleDateString()}
                      </p>
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

          {/* Desktop */}
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
                  {visible.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {users[p.userId]?.name || "Unknown"}
                      </TableCell>
                      <TableCell>{months[p.monthId]?.name}</TableCell>
                      <TableCell>{p.amount.toLocaleString()} ETB</TableCell>
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

          {pageCount > 1 && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {t.common.page} {page + 1} {t.common.of} {pageCount}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  {t.common.previous}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                >
                  {t.common.next}
                </Button>
              </div>
            </div>
          )}
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

export default SuperAdminPayments;
