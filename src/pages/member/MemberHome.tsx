import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Upload, CreditCard, CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Month, Payment } from "@/lib/types";
import { Link } from "react-router-dom";

const MemberHome = () => {
  const { appUser } = useAuth();
  const { t } = useLanguage();
  const [currentMonth, setCurrentMonth] = useState<Month | null>(null);
  const [currentPayment, setCurrentPayment] = useState<Payment | null>(null);
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      if (!appUser) return;
      // Get current open month
      const monthsQ = query(collection(db, "months"), where("status", "==", "open"), orderBy("createdAt", "desc"), limit(1));
      const monthsSnap = await getDocs(monthsQ);
      if (!monthsSnap.empty) {
        const m = { id: monthsSnap.docs[0].id, ...monthsSnap.docs[0].data() } as Month;
        setCurrentMonth(m);

        // Check if user already has a payment for this month
        const payQ = query(collection(db, "payments"), where("userId", "==", appUser.id), where("monthId", "==", m.id));
        const paySnap = await getDocs(payQ);
        if (!paySnap.empty) {
          setCurrentPayment({ id: paySnap.docs[0].id, ...paySnap.docs[0].data() } as Payment);
        }
      }
    };
    fetchData();
  }, [appUser]);

  useEffect(() => {
    if (!currentMonth) return;
    const interval = setInterval(() => {
      const now = new Date();
      const deadline = currentMonth.deadline.toDate();
      const diff = deadline.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft(t.member.overdue);
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      setTimeLeft(days > 0 ? `${days} ${t.member.daysLeft}` : `${hours} ${t.member.hoursLeft}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [currentMonth, t]);

  const statusColor = (status?: string) => {
    switch (status) {
      case "approved": return "text-success bg-success/10";
      case "pending": return "text-warning bg-warning/10";
      case "rejected":
      case "late": return "text-destructive bg-destructive/10";
      default: return "text-muted-foreground bg-muted";
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-display font-bold">{t.nav.home}</h1>

      {/* Current Month Card */}
      <Card className="shadow-md border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            {t.member.currentMonth}
          </CardTitle>
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
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t.member.deadline}:</span>
                <span className={timeLeft === t.member.overdue ? "text-destructive font-semibold" : "font-medium"}>
                  {timeLeft}
                </span>
              </div>

              {currentPayment ? (
                <div className={`rounded-lg p-3 text-center text-sm font-medium ${statusColor(currentPayment.status)}`}>
                  {t.status[currentPayment.status as keyof typeof t.status]}
                </div>
              ) : (
                <Link to="/payments?upload=true">
                  <Button className="w-full gap-2">
                    <Upload className="h-4 w-4" />
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
      <div className="grid grid-cols-2 gap-4">
        <Link to="/payments">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
              <CreditCard className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium">{t.member.paymentHistory}</span>
            </CardContent>
          </Card>
        </Link>
        <Link to="/notifications">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
              <Clock className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium">{t.nav.notifications}</span>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
};

export default MemberHome;
