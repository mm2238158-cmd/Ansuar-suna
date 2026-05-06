import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { collection, query, where, getDocs, addDoc, orderBy, limit, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import type { Payment, Month } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Upload, Image as ImageIcon } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { resolveMonthWindow } from "@/lib/month-utils";

const MemberPayments = () => {
  const { appUser } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [currentMonth, setCurrentMonth] = useState<Month | null>(null);
  const [months, setMonths] = useState<Record<string, Month>>({});
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(searchParams.get("upload") === "true");

  useEffect(() => {
    const fetchData = async () => {
      if (!appUser) return;
      const payQ = query(collection(db, "payments"), where("userId", "==", appUser.id), orderBy("submittedAt", "desc"));
      const paySnap = await getDocs(payQ);
      setPayments(paySnap.docs.map((d) => ({ id: d.id, ...d.data() } as Payment)));

      const monthsSnap = await getDocs(collection(db, "months"));
      const m: Record<string, Month> = {};
      monthsSnap.docs.forEach((d) => { m[d.id] = { id: d.id, ...d.data() } as Month; });
      setMonths(m);

      const openQ = query(collection(db, "months"), where("status", "==", "open"), orderBy("createdAt", "desc"), limit(1));
      const openSnap = await getDocs(openQ);
      if (!openSnap.empty) setCurrentMonth({ id: openSnap.docs[0].id, ...openSnap.docs[0].data() } as Month);
    };
    fetchData();
  }, [appUser]);

  const handleUpload = async () => {
    if (!file || !appUser || !currentMonth) return;
    if (file.size > 1024 * 1024) {
      toast({ title: "Error", description: "File must be less than 1MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const storageRef = ref(storage, `payments/${appUser.id}/${currentMonth.id}_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      await addDoc(collection(db, "payments"), {
        userId: appUser.id,
        monthId: currentMonth.id,
        amount: currentMonth.amount,
        status: "pending",
        screenshotUrl: url,
        submittedAt: Timestamp.now(),
        isLate: Date.now() > resolveMonthWindow(currentMonth).deadlineMs,
        penaltyAmount: 0,
      });

      toast({ title: t.auth.registerSuccess.replace("Registration", "Payment") });
      setShowUpload(false);
      setFile(null);
      // Refresh payments
      const payQ = query(collection(db, "payments"), where("userId", "==", appUser.id), orderBy("submittedAt", "desc"));
      const paySnap = await getDocs(payQ);
      setPayments(paySnap.docs.map((d) => ({ id: d.id, ...d.data() } as Payment)));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
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
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold">{t.nav.payments}</h1>
        {currentMonth && (
          <Button onClick={() => setShowUpload(true)} className="gap-2" size="sm">
            <Upload className="h-4 w-4" />
            {t.member.uploadPayment}
          </Button>
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.member.uploadScreenshot}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {currentMonth && (
              <div className="text-sm text-muted-foreground">
                {currentMonth.name} — {currentMonth.amount.toLocaleString()} ETB
              </div>
            )}
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground mt-2">Max 1MB</p>
            </div>
            {file && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ImageIcon className="h-4 w-4" />
                {file.name}
              </div>
            )}
            <Button onClick={handleUpload} disabled={!file || uploading} className="w-full">
              {uploading ? t.common.loading : t.common.submit}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment List - Cards on mobile, table on desktop */}
      <div className="md:hidden space-y-3">
        {payments.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">{t.member.noPayments}</p>
        ) : (
          payments.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm">{months[p.monthId]?.name || p.monthId}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.submittedAt.toDate().toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-semibold">{p.amount.toLocaleString()} ETB</p>
                    {statusBadge(p.status)}
                  </div>
                </div>
                {p.adminComment && (
                  <p className="text-xs text-muted-foreground mt-2 border-t pt-2">{p.adminComment}</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="hidden md:block">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.member.month}</TableHead>
                <TableHead>{t.common.amount}</TableHead>
                <TableHead>{t.member.submittedAt}</TableHead>
                <TableHead>{t.common.status}</TableHead>
                <TableHead>{t.admin.screenshot}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {t.member.noPayments}
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{months[p.monthId]?.name || p.monthId}</TableCell>
                    <TableCell className="font-medium">{p.amount.toLocaleString()} ETB</TableCell>
                    <TableCell>{p.submittedAt.toDate().toLocaleDateString()}</TableCell>
                    <TableCell>{statusBadge(p.status)}</TableCell>
                    <TableCell>
                      <a href={p.screenshotUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline text-sm">
                        {t.common.view}
                      </a>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
};

export default MemberPayments;
