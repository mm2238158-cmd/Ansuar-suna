import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { collection, query, where, getDocs, addDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AppUser as UserType, Payment } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bell, User } from "lucide-react";

const AdminMembers = () => {
  const { appUser } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [members, setMembers] = useState<UserType[]>([]);
  const [payments, setPayments] = useState<Record<string, Payment[]>>({});

  useEffect(() => {
    const fetchData = async () => {
      if (!appUser) return;
      const assignQ = query(collection(db, "assignments"), where("adminId", "==", appUser.id));
      const assignSnap = await getDocs(assignQ);
      const memberIds = assignSnap.docs.map((d) => d.data().memberId);
      if (memberIds.length === 0) return;

      const allMembers: UserType[] = [];
      const allPayments: Record<string, Payment[]> = {};
      for (let i = 0; i < memberIds.length; i += 10) {
        const batch = memberIds.slice(i, i + 10);
        const usersQ = query(collection(db, "users"), where("__name__", "in", batch));
        const usersSnap = await getDocs(usersQ);
        usersSnap.docs.forEach((d) => allMembers.push({ id: d.id, ...d.data() } as UserType));

        const payQ = query(collection(db, "payments"), where("userId", "in", batch));
        const paySnap = await getDocs(payQ);
        paySnap.docs.forEach((d) => {
          const p = { id: d.id, ...d.data() } as Payment;
          if (!allPayments[p.userId]) allPayments[p.userId] = [];
          allPayments[p.userId].push(p);
        });
      }
      setMembers(allMembers);
      setPayments(allPayments);
    };
    fetchData();
  }, [appUser]);

  const sendReminder = async (userId: string) => {
    try {
      await addDoc(collection(db, "notifications"), {
        userId,
        type: "reminder",
        message: "Please submit your monthly contribution payment.",
        isRead: false,
        createdAt: Timestamp.now(),
      });
      toast({ title: t.admin.reminderSent });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold">{t.admin.assignedMembers}</h1>

      {/* Mobile */}
      <div className="md:hidden space-y-3">
        {members.map((m) => {
          const latestPayment = payments[m.id]?.[0];
          return (
            <Card key={m.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.phone}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => sendReminder(m.id)}>
                    <Bell className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Desktop */}
      <div className="hidden md:block">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.auth.name}</TableHead>
                <TableHead>{t.auth.email}</TableHead>
                <TableHead>{t.auth.phone}</TableHead>
                <TableHead>{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell>{m.email}</TableCell>
                  <TableCell>{m.phone}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => sendReminder(m.id)} className="gap-1">
                      <Bell className="h-4 w-4" /> {t.admin.sendReminder}
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

export default AdminMembers;
