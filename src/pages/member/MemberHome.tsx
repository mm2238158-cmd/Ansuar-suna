import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Upload, CreditCard, CalendarDays, ChevronRight, Bell, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Month, Payment } from "@/lib/types";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const MemberHome = () => {
  const { appUser } = useAuth();
  const { t } = useLanguage();
  const [currentMonth, setCurrentMonth] = useState<Month | null>(null);
  const [currentPayment, setCurrentPayment] = useState<Payment | null>(null);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [openMonthsCount, setOpenMonthsCount] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [monthStartMs, setMonthStartMs] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!appUser) return;

      // Current open month
      const monthsQ = query(
        collection(db, "months"),
        where("status", "==", "open"),
        orderBy("createdAt", "desc"),
        limit(1)
      );
      const monthsSnap = await getDocs(monthsQ);
      if (!monthsSnap.empty) {
        const m = { id: monthsSnap.docs[0].id, ...monthsSnap.docs[0].data() } as Month;
        setCurrentMonth(m);
        setMonthStartMs(m.createdAt.toDate().getTime());

        const payQ = query(
          collection(db, "payments"),
          where("userId", "==", appUser.id),
          where("monthId", "==", m.id)
        );
        const paySnap = await getDocs(payQ);
        if (!paySnap.empty) {
          setCurrentPayment({ id: paySnap.docs[0].id, ...paySnap.docs[0].data() } as Payment);
        }
      }

      // All payments for summary
      const allPayQ = query(collection(db, "payments"), where("userId", "==", appUser.id));
      const allPaySnap = await getDocs(allPayQ);
      setAllPayments(allPaySnap.docs.map((d) => ({ id: d.id, ...d.data() } as Payment)));

      // Total open months (for missed calc)
      const openMonthsSnap = await getDocs(query(collection(db, "months"), where("status", "==", "open")));
      setOpenMonthsCount(openMonthsSnap.size);
    };
    fetchData();
  }, [appUser]);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const countdown = useMemo(() => {
    if (!currentMonth) return null;
    const deadline = currentMonth.deadline.toDate().getTime();
    const diff = deadline - now;
    const overdue = diff <= 0;
    const abs = Math.abs(diff);
    const days = Math.floor(abs / 86400000);
    const hours = Math.floor((abs % 86400000) / 3600000);
    const minutes = Math.floor((abs % 3600000) / 60000);
    const seconds = Math.floor((abs % 60000) / 1000);
    return { overdue, days, hours, minutes, seconds, diff };
  }, [currentMonth, now]);

  const progress = useMemo(() => {
    if (!currentMonth || !monthStartMs) return { pct: 0, color: "bg-success" };
    const deadline = currentMonth.deadline.toDate().getTime();
    const total = deadline - monthStartMs;
    if (total <= 0) return { pct: 0, color: "bg-destructive" };
    const elapsed = now - monthStartMs;
    const pctElapsed = Math.min(100, Math.max(0, (elapsed / total) * 100));
    const pctRemaining = 100 - pctElapsed;
    let color = "bg-success";
    if (pctRemaining < 10) color = "bg-destructive";
    else if (pctRemaining <= 50) color = "bg-warning";
    return { pct: pctElapsed, color };
  }, [currentMonth, monthStartMs, now]);

  const summary = useMemo(() => {
    const paid = allPayments.filter((p) => p.status === "approved").length;
    const pending = allPayments.filter((p) => p.status === "pending").length;
    const missed =
      allPayments.filter((p) => p.status === "rejected" || p.status === "late").length +
      Math.max(0, openMonthsCount - allPayments.filter((p) => p.status !== "rejected").length);
    return { paid, pending, missed: Math.max(0, missed) };
  }, [allPayments, openMonthsCount]);

  const statusInfo = (status?: string) => {
    switch (status) {
      case "approved":
        return { label: t.status.approved, cls: "bg-success/15 text-success border-success/30", Icon: CheckCircle2 };
      case "pending":
        return { label: t.status.pending, cls: "bg-warning/15 text-warning border-warning/30", Icon: Clock };
      case "rejected":
        return { label: t.status.rejected, cls: "bg-destructive/15 text-destructive border-destructive/30", Icon: XCircle };
      case "late":
        return { label: t.status.late, cls: "bg-destructive/15 text-destructive border-destructive/30", Icon: AlertCircle };
      default:
        return { label: t.member.notSubmitted, cls: "bg-muted text-muted-foreground border-border", Icon: AlertCircle };
    }
  };

  const sInfo = statusInfo(currentPayment?.status);

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <h1 className="text-2xl font-display font-bold">{t.nav.home}</h1>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2.5">
        <Card className="border-success/20 bg-success/5">
          <CardContent className="p-3 text-center">
            <CheckCircle2 className="h-5 w-5 text-success mx-auto mb-1" />
            <p className="text-xl font-bold text-success">{summary.paid}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t.member.paidMonths}</p>
          </CardContent>
        </Card>
        <Card className="border-warning/20 bg-warning/5">
          <CardContent className="p-3 text-center">
            <Clock className="h-5 w-5 text-warning mx-auto mb-1" />
            <p className="text-xl font-bold text-warning">{summary.pending}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t.member.pending}</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-3 text-center">
            <XCircle className="h-5 w-5 text-destructive mx-auto mb-1" />
            <p className="text-xl font-bold text-destructive">{summary.missed}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t.member.missed}</p>
          </CardContent>
        </Card>
      </div>

      {/* Current Month Card */}
      <Card className="shadow-md border-primary/20 overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              {t.member.currentMonth}
            </CardTitle>
            <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border", sInfo.cls)}>
              <sInfo.Icon className="h-3 w-3" />
              {sInfo.label}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentMonth ? (
            <>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">{currentMonth.name}</span>
                <span className="text-2xl font-bold text-primary">
                  {currentMonth.amount.toLocaleString()} ETB
                </span>
              </div>

              {/* Countdown */}
              {countdown && (
                <div className={cn(
                  "rounded-xl p-4 border",
                  countdown.overdue ? "bg-destructive/10 border-destructive/30" : "bg-primary/5 border-primary/20"
                )}>
                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mb-2">
                    <Clock className="h-3.5 w-3.5" />
                    {countdown.overdue ? t.member.overdue : t.member.deadline}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { v: countdown.days, l: t.member.days },
                      { v: countdown.hours, l: t.member.hours },
                      { v: countdown.minutes, l: t.member.minutes },
                      { v: countdown.seconds, l: t.member.seconds },
                    ].map((u, i) => (
                      <div key={i} className="text-center">
                        <div className={cn(
                          "text-2xl font-bold tabular-nums",
                          countdown.overdue ? "text-destructive" : "text-foreground"
                        )}>
                          {String(u.v).padStart(2, "0")}
                        </div>
                        <div className="text-[10px] uppercase text-muted-foreground tracking-wide">{u.l}</div>
                      </div>
                    ))}
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", progress.color)}
                      style={{ width: `${progress.pct}%` }}
                    />
                  </div>
                </div>
              )}

              {!currentPayment && (
                <Link to="/payments?upload=true" className="block">
                  <Button className="w-full h-14 gap-2 text-base shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all hover:-translate-y-0.5">
                    <Upload className="h-5 w-5" />
                    {t.member.uploadPayment}
                  </Button>
                </Link>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-4">{t.common.noData}</p>
          )}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="space-y-2.5">
        <Link to="/payments" className="block">
          <Card className="hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{t.member.paymentHistory}</p>
                <p className="text-xs text-muted-foreground truncate">{t.member.paymentHistoryDesc}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        </Link>
        <Link to="/notifications" className="block">
          <Card className="hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{t.nav.notifications}</p>
                <p className="text-xs text-muted-foreground truncate">{t.member.notificationsDesc}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
};

export default MemberHome;
