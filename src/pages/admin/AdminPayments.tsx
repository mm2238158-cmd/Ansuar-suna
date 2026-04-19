import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useMemo, useState } from "react";
import { collection, query, where, getDocs, doc, updateDoc, Timestamp, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Payment, AppUser as UserType, Month } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CheckCircle, XCircle, Eye, Clock } from "lucide-react";

const AdminPayments = () => {
  const { appUser } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [users, setUsers] = useState<Record<string, UserType>>({});
  const [months, setMonths] = useState<Record<string, Month>>({});
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!appUser) return;
      const assignQ = query(collection(db, "assignments"), where("adminId", "==", appUser.id));
      const assignSnap = await getDocs(assignQ);
      const memberIds = assignSnap.docs.map((d) => d.data().memberId);
      if (memberIds.length === 0) return;

      const usersMap: Record<string, UserType> = {};
      for (let i = 0; i < memberIds.length; i += 10) {
        const batch = memberIds.slice(i, i + 10);
        const usersQ = query(collection(db, "users"), where("__name__", "in", batch));
        const usersSnap = await getDocs(usersQ);
        usersSnap.docs.forEach((d) => { usersMap[d.id] = { id: d.id, ...d.data() } as UserType; });
      }
      setUsers(usersMap);

      let allPayments: Payment[] = [];
      for (let i = 0; i < memberIds.length; i += 10) {
        const batch = memberIds.slice(i, i + 10);
        const payQ = query(collection(db, "payments"), where("userId", "in", batch), orderBy("submittedAt", "desc"));
        const paySnap = await getDocs(payQ);
        allPayments = [...allPayments, ...paySnap.docs.map((d) => ({ id: d.id, ...d.data() } as Payment))];
      }
      setPayments(allPayments);

      const monthsSnap = await getDocs(collection(db, "months"));
      const m: Record<string, Month> = {};
      monthsSnap.docs.forEach((d) => { m[d.id] = { id: d.id, ...d.data() } as Month; });
      setMonths(m);
    };
    fetchData();
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
      if (comment.trim()) updates.adminComment = comment.trim();
      await updateDoc(doc(db, "payments", selectedPayment.id), updates);
      setPayments((prev) => prev.map((p) => (p.id === selectedPayment.id ? { ...p, status, adminComment: comment.trim() || p.adminComment } : p)));
      toast({ title: status === "approved" ? `✓ ${t.status.approved}` : `✗ ${t.status.rejected}` });
      closeReview();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    const list = statusFilter === "all" ? payments : payments.filter((p) => p.status === statusFilter);
    if (statusFilter === "all") {
      // Surface pending first
      const order: Record<string, number> = { pending: 0, late: 1, rejected: 2, approved: 3 };
      return [...list].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
    }
    return list;
  }, [payments, statusFilter]);

  const rowTone = (status: string) => {
    if (status === "pending") return "bg-warning/5 border-l-4 border-l-warning";
    if (status === "approved") return "opacity-70";
    if (status === "rejected") return "bg-destructive/5";
    return "";
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      approved: "bg-success/10 text-success",
      pending: "bg-warning/10 text-warning",
      rejected: "bg-destructive/10 text-destructive",
      late: "bg-destructive/10 text-destructive",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || ""}`}>
        {t.status[status as keyof typeof t.status]}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-display font-bold">{t.admin.verificationQueue}</h1>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
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

      {/* Mobile view */}
      <div className="md:hidden space-y-3">
        {filtered.map((p) => (
          <Card key={p.id} className={`cursor-pointer hover:shadow-md transition-all ${rowTone(p.status)}`} onClick={() => openReview(p)}>
            <CardContent className="p-4 space-y-2">
              {p.status === "pending" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-warning/15 text-warning uppercase tracking-wide">
                  <Clock className="h-2.5 w-2.5" /> {t.admin.actionNeeded}
                </span>
              )}
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-sm">{users[p.userId]?.name || "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">{months[p.monthId]?.name}</p>
                </div>
                <div className="text-right space-y-1">
                  <p className="font-semibold text-sm">{p.amount.toLocaleString()} ETB</p>
                  {statusBadge(p.status)}
                </div>
              </div>
              <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={(e) => { e.stopPropagation(); openReview(p); }}>
                <Eye className="h-3.5 w-3.5" /> {t.admin.reviewPayment}
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
                  <TableCell>{statusBadge(p.status)}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openReview(p)}>
                      <Eye className="h-3.5 w-3.5" /> {t.admin.reviewPayment}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Review Dialog */}
      <Dialog open={!!selectedPayment} onOpenChange={(o) => !o && closeReview()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.admin.reviewPayment}</DialogTitle>
            <DialogDescription>{t.admin.viewScreenshot}</DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-3 text-sm rounded-lg bg-muted/50 p-3">
                <div>
                  <p className="text-xs text-muted-foreground">{t.admin.memberName}</p>
                  <p className="font-medium">{users[selectedPayment.userId]?.name || "Unknown"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t.member.month}</p>
                  <p className="font-medium">{months[selectedPayment.monthId]?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t.common.amount}</p>
                  <p className="font-semibold text-primary">{selectedPayment.amount.toLocaleString()} ETB</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t.admin.paymentDate}</p>
                  <p className="font-medium">{selectedPayment.submittedAt.toDate().toLocaleDateString()}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">{t.common.status}</p>
                  {statusBadge(selectedPayment.status)}
                </div>
              </div>

              {/* Screenshot */}
              <div className="rounded-lg overflow-hidden border bg-muted/30">
                <a href={selectedPayment.screenshotUrl} target="_blank" rel="noreferrer">
                  <img
                    src={selectedPayment.screenshotUrl}
                    alt="Payment screenshot"
                    className="w-full max-h-[400px] object-contain bg-background"
                  />
                </a>
              </div>

              {/* Comment */}
              <Textarea
                placeholder={t.admin.commentPlaceholder}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />

              {/* Actions */}
              {selectedPayment.status === "pending" ? (
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    className="flex-1 gap-1.5"
                    onClick={() => handleAction("rejected")}
                    disabled={submitting}
                  >
                    <XCircle className="h-4 w-4" /> {t.common.reject}
                  </Button>
                  <Button
                    className="flex-1 gap-1.5 bg-success hover:bg-success/90 text-success-foreground"
                    onClick={() => handleAction("approved")}
                    disabled={submitting}
                  >
                    <CheckCircle className="h-4 w-4" /> {t.common.approve}
                  </Button>
                </div>
              ) : (
                <Button variant="outline" className="w-full" onClick={closeReview}>
                  {t.common.close}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPayments;
