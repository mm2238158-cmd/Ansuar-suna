import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Payment } from "@/lib/types";
import { Users, CheckCircle, Clock, XCircle, DollarSign, UserPlus, ShieldCheck } from "lucide-react";

const SuperAdminDashboard = () => {
  const { t } = useLanguage();
  const [stats, setStats] = useState({
    totalMembers: 0,
    pendingApprovals: 0,
    totalAdmins: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    totalCollected: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      const usersSnap = await getDocs(collection(db, "users"));
      const users = usersSnap.docs.map((d) => d.data());
      const paymentsSnap = await getDocs(collection(db, "payments"));
      const payments = paymentsSnap.docs.map((d) => d.data() as Payment);

      setStats({
        totalMembers: users.filter((u) => u.role === "member" && u.status === "active").length,
        pendingApprovals: users.filter((u) => u.status === "pending").length,
        totalAdmins: users.filter((u) => u.role === "admin").length,
        approved: payments.filter((p) => p.status === "approved").length,
        pending: payments.filter((p) => p.status === "pending").length,
        rejected: payments.filter((p) => p.status === "rejected").length,
        totalCollected: payments.filter((p) => p.status === "approved").reduce((s, p) => s + p.amount, 0),
      });
    };
    fetchData();
  }, []);

  const cards = [
    { label: t.superAdmin.activeMembers, value: stats.totalMembers, icon: Users, color: "text-primary" },
    { label: t.superAdmin.pendingApprovals, value: stats.pendingApprovals, icon: UserPlus, color: "text-warning" },
    { label: t.superAdmin.totalAdmins, value: stats.totalAdmins, icon: ShieldCheck, color: "text-primary" },
    { label: t.admin.approvedPayments, value: stats.approved, icon: CheckCircle, color: "text-success" },
    { label: t.admin.pendingPayments, value: stats.pending, icon: Clock, color: "text-warning" },
    { label: t.admin.rejectedPayments, value: stats.rejected, icon: XCircle, color: "text-destructive" },
    { label: t.admin.totalCollected, value: `${stats.totalCollected.toLocaleString()} ETB`, icon: DollarSign, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold">{t.superAdmin.systemOverview}</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="shadow-sm">
            <CardContent className="p-4">
              <c.icon className={`h-5 w-5 ${c.color} mb-2`} />
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
