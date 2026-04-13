import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Payment, AppUser as AppUserType } from "@/lib/types";
import { Users, CheckCircle, Clock, XCircle, DollarSign } from "lucide-react";

const AdminDashboard = () => {
  const { appUser } = useAuth();
  const { t } = useLanguage();
  const [stats, setStats] = useState({
    totalMembers: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    totalCollected: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!appUser) return;
      // Get assigned members
      const assignQ = query(collection(db, "assignments"), where("adminId", "==", appUser.id));
      const assignSnap = await getDocs(assignQ);
      const memberIds = assignSnap.docs.map((d) => d.data().memberId);
      setStats((prev) => ({ ...prev, totalMembers: memberIds.length }));

      if (memberIds.length === 0) return;

      // Get payments for assigned members - batch in groups of 10
      let allPayments: Payment[] = [];
      for (let i = 0; i < memberIds.length; i += 10) {
        const batch = memberIds.slice(i, i + 10);
        const payQ = query(collection(db, "payments"), where("userId", "in", batch));
        const paySnap = await getDocs(payQ);
        allPayments = [...allPayments, ...paySnap.docs.map((d) => ({ id: d.id, ...d.data() } as Payment))];
      }

      setStats({
        totalMembers: memberIds.length,
        approved: allPayments.filter((p) => p.status === "approved").length,
        pending: allPayments.filter((p) => p.status === "pending").length,
        rejected: allPayments.filter((p) => p.status === "rejected").length,
        totalCollected: allPayments.filter((p) => p.status === "approved").reduce((sum, p) => sum + p.amount, 0),
      });
    };
    fetchData();
  }, [appUser]);

  const cards = [
    { label: t.admin.totalMembers, value: stats.totalMembers, icon: Users, color: "text-primary" },
    { label: t.admin.approvedPayments, value: stats.approved, icon: CheckCircle, color: "text-success" },
    { label: t.admin.pendingPayments, value: stats.pending, icon: Clock, color: "text-warning" },
    { label: t.admin.rejectedPayments, value: stats.rejected, icon: XCircle, color: "text-destructive" },
    { label: t.admin.totalCollected, value: `${stats.totalCollected.toLocaleString()} ETB`, icon: DollarSign, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold">{t.nav.dashboard}</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <c.icon className={`h-5 w-5 ${c.color}`} />
              </div>
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
