import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { collection, doc, getDocs, orderBy, query, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Payment, AppUser as UserType, Month } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, Eye, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const SuperAdminPayments = () => {
  const { t } = useLanguage();
  const { appUser } = useAuth();
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [users, setUsers] = useState<Record<string, UserType>>({});
  const [months, setMonths] = useState<Record<string, Month>>({});
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const paySnap = await getDocs(query(collection(db, "payments"), orderBy("submittedAt", "desc")));
      setPayments(paySnap.docs.map((d) => ({ id: d.id, ...d.data() } as Payment)));

      const usersSnap = await getDocs(collection(db, "users"));
      const u: Record<string, UserType> = {};
      usersSnap.docs.forEach((d) => { u[d.id] = { id: d.id, ...d.data() } as UserType; });
      setUsers(u);

      const monthsSnap = await getDocs(collection(db, "months"));
      const m: Record<string, Month> = {};
      monthsSnap.docs.forEach((d) => { m[d.id] = { id: d.id, ...d.data() } as Month; });
      setMonths(m);
    };
    fetchData();
  }, []);

  const filtered = statusFilter === "all" ? payments : payments.filter((p) => p.status === statusFilter);

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
      await updateDoc(doc(db, "payments", selectedPayment.id), {
        status,
        verifiedBy: appUser?.id,
        verifiedAt: Timestamp.now(),
        adminComment: comment || undefined,
      });
      setPayments((prev) => prev.map((p) => (p.id === selectedPayment.id ? { ...p, status, adminComment: comment } : p)));
      toast({ title: status === "approved" ? `✓ ${t.status.approved}` : `✗ ${t.status.rejected}` });
      closeReview();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
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
        <h1 className="text-2xl font-display font-bold">{t.nav.payments}</h1>
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

      {/* Mobile */}
      <div className="md:hidden space-y-3">
        {filtered.map((p) => (
          <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openReview(p)}>
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-sm">{users[p.userId]?.name || "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">{months[p.monthId]?.name}</p>
                  <p className="text-xs text-muted-foreground">{p.submittedAt.toDate().toLocaleDateString()}</p>
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
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{users[p.userId]?.name || "Unknown"}</TableCell>
                  <TableCell>{months[p.monthId]?.name}</TableCell>
                  <TableCell>{p.amount.toLocaleString()} ETB</TableCell>
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

              <div className="rounded-lg overflow-hidden border bg-muted/30">
                <a href={selectedPayment.screenshotUrl} target="_blank" rel="noreferrer">
                  <img
                    src={selectedPayment.screenshotUrl}
                    alt="Payment screenshot"
                    className="w-full max-h-[400px] object-contain bg-background"
                  />
                </a>
              </div>

              <Textarea
                placeholder={t.admin.commentPlaceholder}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />

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

export default SuperAdminPayments;
