import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import { collection, query, where, getDocs, doc, updateDoc, Timestamp, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Payment, AppUser as UserType, Month } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle, XCircle, Eye } from "lucide-react";

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

  useEffect(() => {
    const fetchData = async () => {
      if (!appUser) return;
      const assignQ = query(collection(db, "assignments"), where("adminId", "==", appUser.id));
      const assignSnap = await getDocs(assignQ);
      const memberIds = assignSnap.docs.map((d) => d.data().memberId);
      if (memberIds.length === 0) return;

      // Fetch users
      const usersMap: Record<string, UserType> = {};
      for (let i = 0; i < memberIds.length; i += 10) {
        const batch = memberIds.slice(i, i + 10);
        const usersQ = query(collection(db, "users"), where("__name__", "in", batch));
        const usersSnap = await getDocs(usersQ);
        usersSnap.docs.forEach((d) => { usersMap[d.id] = { id: d.id, ...d.data() } as UserType; });
      }
      setUsers(usersMap);

      // Fetch payments
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

  const handleAction = async (paymentId: string, status: "approved" | "rejected") => {
    try {
      await updateDoc(doc(db, "payments", paymentId), {
        status,
        verifiedBy: appUser?.id,
        verifiedAt: Timestamp.now(),
        adminComment: comment || undefined,
      });
      setPayments((prev) => prev.map((p) => (p.id === paymentId ? { ...p, status, adminComment: comment } : p)));
      setSelectedPayment(null);
      setComment("");
      toast({ title: `Payment ${status}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const filtered = statusFilter === "all" ? payments : payments.filter((p) => p.status === statusFilter);

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
          <Card key={p.id}>
            <CardContent className="p-4 space-y-2">
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
              {p.status === "pending" && (
                <div className="flex gap-2 pt-2">
                  <Button size="sm" className="flex-1 gap-1" onClick={() => handleAction(p.id, "approved")}>
                    <CheckCircle className="h-3 w-3" /> {t.common.approve}
                  </Button>
                  <Button size="sm" variant="destructive" className="flex-1 gap-1" onClick={() => { setSelectedPayment(p); }}>
                    <XCircle className="h-3 w-3" /> {t.common.reject}
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={p.screenshotUrl} target="_blank" rel="noreferrer"><Eye className="h-3 w-3" /></a>
                  </Button>
                </div>
              )}
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
                <TableRow key={p.id}>
                  <TableCell>{users[p.userId]?.name || "Unknown"}</TableCell>
                  <TableCell>{months[p.monthId]?.name}</TableCell>
                  <TableCell className="font-medium">{p.amount.toLocaleString()} ETB</TableCell>
                  <TableCell>{p.submittedAt.toDate().toLocaleDateString()}</TableCell>
                  <TableCell>{statusBadge(p.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" asChild>
                        <a href={p.screenshotUrl} target="_blank" rel="noreferrer"><Eye className="h-4 w-4" /></a>
                      </Button>
                      {p.status === "pending" && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => handleAction(p.id, "approved")}>
                            <CheckCircle className="h-4 w-4 text-success" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setSelectedPayment(p)}>
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Reject Dialog */}
      <Dialog open={!!selectedPayment} onOpenChange={() => setSelectedPayment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.common.reject}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder={t.admin.commentPlaceholder}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSelectedPayment(null)} className="flex-1">
                {t.common.cancel}
              </Button>
              <Button variant="destructive" onClick={() => selectedPayment && handleAction(selectedPayment.id, "rejected")} className="flex-1">
                {t.common.reject}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPayments;
