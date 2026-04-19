import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Payment } from "@/lib/types";
import {
  Users, CheckCircle, Clock, XCircle, DollarSign, UserPlus, ShieldCheck,
  Plus, ArrowRight, TrendingUp, TrendingDown,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

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
  const [trends, setTrends] = useState<{ collectedPct: number | null; approvedPct: number | null }>({
    collectedPct: null,
    approvedPct: null,
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

      // Trend: last 30d vs prev 30d (using verifiedAt for approved payments)
      const now = Date.now();
      const d30 = 30 * 86400000;
      const last30 = payments.filter(
        (p) => p.status === "approved" && p.verifiedAt && now - p.verifiedAt.toDate().getTime() <= d30
      );
      const prev30 = payments.filter(
        (p) => {
          if (p.status !== "approved" || !p.verifiedAt) return false;
          const t = p.verifiedAt.toDate().getTime();
          return now - t > d30 && now - t <= 2 * d30;
        }
      );
      const last30Sum = last30.reduce((s, p) => s + p.amount, 0);
      const prev30Sum = prev30.reduce((s, p) => s + p.amount, 0);
      const collectedPct =
        prev30Sum > 0 ? Math.round(((last30Sum - prev30Sum) / prev30Sum) * 100) : null;
      const approvedPct =
        prev30.length > 0 ? Math.round(((last30.length - prev30.length) / prev30.length) * 100) : null;
      setTrends({ collectedPct, approvedPct });
    };
    fetchData();
  }, []);

  const Trend = ({ pct }: { pct: number | null }) => {
    if (pct === null || pct === 0) return null;
    const up = pct > 0;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded",
          up ? "text-success bg-success/10" : "text-destructive bg-destructive/10"
        )}
      >
        {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {Math.abs(pct)}%
      </span>
    );
  };

  const secondary = useMemo(
    () => [
      { label: t.superAdmin.activeMembers, value: stats.totalMembers, icon: Users, color: "text-primary" },
      { label: t.superAdmin.totalAdmins, value: stats.totalAdmins, icon: ShieldCheck, color: "text-primary" },
      { label: t.admin.approvedPayments, value: stats.approved, icon: CheckCircle, color: "text-success", trend: trends.approvedPct },
      { label: t.admin.pendingPayments, value: stats.pending, icon: Clock, color: "text-warning" },
      { label: t.admin.rejectedPayments, value: stats.rejected, icon: XCircle, color: "text-destructive" },
    ],
    [stats, trends, t]
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold">{t.superAdmin.systemOverview}</h1>

      {/* Priority Metrics */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          {t.superAdmin.priorityMetrics}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Pending Approvals */}
          <Card className="overflow-hidden border-warning/30 bg-gradient-to-br from-warning/10 via-warning/5 to-transparent shadow-sm">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <UserPlus className="h-4 w-4 text-warning" />
                    <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                      {t.superAdmin.pendingApprovals}
                    </p>
                  </div>
                  <p className="text-3xl font-bold text-warning tabular-nums">{stats.pendingApprovals}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t.superAdmin.membersAwaitingApproval}</p>
                </div>
              </div>
              <Link to="/users">
                <Button size="sm" variant="outline" className="gap-1.5 border-warning/40 text-warning hover:bg-warning/10 w-full sm:w-auto">
                  {t.superAdmin.reviewNow} <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Total Collected */}
          <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-sm">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                      {t.admin.totalCollected}
                    </p>
                  </div>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p className="text-3xl font-bold text-primary tabular-nums">
                      {stats.totalCollected.toLocaleString()}
                    </p>
                    <span className="text-sm font-semibold text-primary/70">ETB</span>
                    <Trend pct={trends.collectedPct} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t.superAdmin.acrossAllApproved}
                    {trends.collectedPct !== null && ` · ${t.superAdmin.vsPrev30}`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          {t.superAdmin.quickActions}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <Link to="/payments">
            <Button variant="outline" className="w-full justify-start gap-2 h-12">
              <Plus className="h-4 w-4 text-primary" /> {t.superAdmin.createMonth}
            </Button>
          </Link>
          <Link to="/users">
            <Button variant="outline" className="w-full justify-start gap-2 h-12">
              <UserPlus className="h-4 w-4 text-primary" /> {t.superAdmin.assignMembers}
            </Button>
          </Link>
          <Link to="/payments">
            <Button variant="outline" className="w-full justify-start gap-2 h-12">
              <Clock className="h-4 w-4 text-warning" /> {t.superAdmin.viewPending}
            </Button>
          </Link>
        </div>
      </section>

      {/* Overview (secondary metrics) */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          {t.superAdmin.overview}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {secondary.map((c) => (
            <Card key={c.label} className="shadow-none border-transparent bg-muted/30">
              <CardContent className="p-3">
                <c.icon className={`h-4 w-4 ${c.color} mb-1.5`} />
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <p className="text-xl font-bold tabular-nums">{c.value}</p>
                  {"trend" in c && c.trend !== undefined && <Trend pct={c.trend ?? null} />}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">{c.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
};

export default SuperAdminDashboard;
