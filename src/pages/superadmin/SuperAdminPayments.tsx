import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Payment, AppUser as UserType, Month } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

const SuperAdminPayments = () => {
  const { t } = useLanguage();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [users, setUsers] = useState<Record<string, UserType>>({});
  const [months, setMonths] = useState<Record<string, Month>>({});
  const [statusFilter, setStatusFilter] = useState("all");

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
          <Card key={p.id}>
            <CardContent className="p-4">
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
                <TableHead>{t.admin.screenshot}</TableHead>
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
                    <Button size="sm" variant="ghost" asChild>
                      <a href={p.screenshotUrl} target="_blank" rel="noreferrer"><Eye className="h-4 w-4" /></a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
};

export default SuperAdminPayments;
