import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Payment } from "@/lib/types";
import {
  Users,
  CheckCircle,
  Clock,
  UserPlus,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  CreditCard,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Stats {
  activeMembers: number;
  pendingApprovals: number;
  totalAdmins: number;
  approvedPayments: number;
  pendingPayments: number;
  totalCollected: number;
  collectedTrendPct: number | null;
}

const initialStats: Stats = {
  activeMembers: 0,
  pendingApprovals: 0,
  totalAdmins: 0,
  approvedPayments: 0,
  pendingPayments: 0,
  totalCollected: 0,
  collectedTrendPct: null,
};

const SuperAdminDashboard = () => {
  const { t } = useLanguage();
  const [stats, setStats] = useState<Stats>(initialStats);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [usersSnap, paymentsSnap] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "payments")),
        ]);
        const users = usersSnap.docs.map((d) => d.data());
        const payments = paymentsSnap.docs.map((d) => d.data() as Payment);

        const approved = payments.filter((p) => p.status === "approved");
        const totalCollected = approved.reduce((s, p) => s + (p.amount || 0), 0);

        const now = Date.now();
        const D30 = 30 * 86400000;
        const sumIn = (from: number, to: number) =>
          approved
            .filter((p) => {
              const ts = p.verifiedAt?.toDate().getTime();
              return ts !== undefined && ts >= from && ts < to;
            })
            .reduce((s, p) => s + (p.amount || 0), 0);
        const last30 = sumIn(now - D30, now);
        const prev30 = sumIn(now - 2 * D30, now - D30);
        const collectedTrendPct =
          prev30 > 0 ? Math.round(((last30 - prev30) / prev30) * 100) : null;

        if (!alive) return;
        setStats({
          activeMembers: users.filter((u) => u.role === "member" && u.status === "active").length,
          pendingApprovals: users.filter((u) => u.status === "pending").length,
          totalAdmins: users.filter((u) => u.role === "admin").length,
          approvedPayments: approved.length,
          pendingPayments: payments.filter((p) => p.status === "pending").length,
          totalCollected,
          collectedTrendPct,
        });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
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

  const kpis = [
    { label: t.superAdmin.activeMembers, value: stats.activeMembers, icon: Users },
    { label: t.superAdmin.totalAdmins, value: stats.totalAdmins, icon: ShieldCheck },
    { label: t.admin.approvedPayments, value: stats.approvedPayments, icon: CheckCircle },
    { label: t.admin.pendingPayments, value: stats.pendingPayments, icon: Clock },
  ];

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-display font-bold tracking-tight">
          {t.superAdmin.systemOverview}
        </h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </header>

      {/* Hero KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-l-4 border-l-warning shadow-sm">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground font-medium">
              <UserPlus className="h-4 w-4 text-warning" />
              {t.superAdmin.pendingApprovals}
            </div>
            {loading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <p className="text-4xl font-bold text-warning tabular-nums">
                {stats.pendingApprovals}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {t.superAdmin.membersAwaitingApproval}
            </p>
            <Link to="/users">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-warning/40 text-warning hover:bg-warning/10"
              >
                {t.superAdmin.reviewNow} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary shadow-sm">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground font-medium">
              <CreditCard className="h-4 w-4 text-primary" />
              {t.admin.totalCollected}
            </div>
            {loading ? (
              <Skeleton className="h-9 w-32" />
            ) : (
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className="text-4xl font-bold text-primary tabular-nums">
                  {stats.totalCollected.toLocaleString()}
                </p>
                <span className="text-sm font-semibold text-primary/70">ETB</span>
                <Trend pct={stats.collectedTrendPct} />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {t.superAdmin.acrossAllApproved}
              {stats.collectedTrendPct !== null && ` · ${t.superAdmin.vsPrev30}`}
            </p>
          </CardContent>
        </Card>
      </section>

      {/* KPI strip */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          {t.superAdmin.overview}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpis.map((k) => (
            <Card key={k.label} className="shadow-none">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <k.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                {loading ? (
                  <Skeleton className="h-6 w-12 mb-1" />
                ) : (
                  <p className="text-2xl font-bold tabular-nums leading-none">{k.value}</p>
                )}
                <p className="text-[11px] text-muted-foreground mt-2 uppercase tracking-wide">
                  {k.label}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Quick actions */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          {t.superAdmin.quickActions}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <Link to="/users">
            <Button variant="outline" className="w-full justify-start gap-2 h-12">
              <UserPlus className="h-4 w-4 text-warning" />
              {t.superAdmin.reviewNow}
            </Button>
          </Link>
          <Link to="/payments">
            <Button variant="outline" className="w-full justify-start gap-2 h-12">
              <Clock className="h-4 w-4 text-primary" />
              {t.superAdmin.viewPending}
            </Button>
          </Link>
          <Link to="/data-health">
            <Button variant="outline" className="w-full justify-start gap-2 h-12">
              <ShieldAlert className="h-4 w-4 text-primary" />
              {t.nav.dataHealth}
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default SuperAdminDashboard;
