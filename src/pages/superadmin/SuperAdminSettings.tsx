import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, addDoc, collection, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Settings as SettingsType } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CalendarPlus, Megaphone, Settings2 } from "lucide-react";
import { getPeriodKey } from "@/lib/month-utils";

const SuperAdminSettings = () => {
  const { appUser } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  // Settings
  const [settings, setSettings] = useState<SettingsType>({
    id: "global",
    monthlyAmount: 500,
    paymentDeadlineDay: 25,
    penaltyEnabled: false,
    penaltyAmount: 50,
  });

  // Create month
  const [monthName, setMonthName] = useState("");
  const [monthAmount, setMonthAmount] = useState("");
  const [monthDeadline, setMonthDeadline] = useState("");

  // Announcement
  const [annTitle, setAnnTitle] = useState("");
  const [annMessage, setAnnMessage] = useState("");
  const [annTarget, setAnnTarget] = useState("all");

  useEffect(() => {
    const fetchSettings = async () => {
      const snap = await getDoc(doc(db, "settings", "global"));
      if (snap.exists()) setSettings({ id: snap.id, ...snap.data() } as SettingsType);
    };
    fetchSettings();
  }, []);

  const saveSettings = async () => {
    try {
      await setDoc(doc(db, "settings", "global"), {
        monthlyAmount: settings.monthlyAmount,
        paymentDeadlineDay: settings.paymentDeadlineDay,
        penaltyEnabled: settings.penaltyEnabled,
        penaltyAmount: settings.penaltyAmount,
      });
      toast({ title: t.profile.updateSuccess });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const createMonth = async () => {
    if (!monthName || !monthAmount || !monthDeadline) return;
    try {
      const selectedDate = new Date(monthDeadline);
      const deadlineEndOfDay = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        23,
        59,
        59,
        999
      );
      await addDoc(collection(db, "months"), {
        name: monthName,
        amount: Number(monthAmount),
        deadline: Timestamp.fromDate(deadlineEndOfDay),
        status: "open",
        createdBy: appUser?.id,
        createdAt: Timestamp.now(),
        periodKey: getPeriodKey(selectedDate),
      });
      toast({ title: "Month created" });
      setMonthName("");
      setMonthAmount("");
      setMonthDeadline("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const createAnnouncement = async () => {
    if (!annTitle || !annMessage) return;
    try {
      await addDoc(collection(db, "announcements"), {
        title: annTitle,
        message: annMessage,
        target: annTarget,
        createdBy: appUser?.id,
        createdAt: Timestamp.now(),
      });
      toast({ title: "Announcement created" });
      setAnnTitle("");
      setAnnMessage("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-display font-bold">{t.nav.settings}</h1>

      {/* System Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            {t.superAdmin.systemSettings}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.superAdmin.monthAmount}</label>
              <Input
                type="number"
                value={settings.monthlyAmount}
                onChange={(e) => setSettings({ ...settings, monthlyAmount: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.superAdmin.paymentDeadlineDay}</label>
              <Input
                type="number"
                min={1}
                max={31}
                value={settings.paymentDeadlineDay}
                onChange={(e) => setSettings({ ...settings, paymentDeadlineDay: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">{t.superAdmin.enablePenalty}</label>
            <Switch
              checked={settings.penaltyEnabled}
              onCheckedChange={(v) => setSettings({ ...settings, penaltyEnabled: v })}
            />
          </div>
          {settings.penaltyEnabled && (
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.superAdmin.penaltyAmount}</label>
              <Input
                type="number"
                value={settings.penaltyAmount}
                onChange={(e) => setSettings({ ...settings, penaltyAmount: Number(e.target.value) })}
              />
            </div>
          )}
          <Button onClick={saveSettings} className="w-full">{t.common.save}</Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Create Month */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-primary" />
            {t.superAdmin.createMonth}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t.superAdmin.monthName}</label>
            <Input value={monthName} onChange={(e) => setMonthName(e.target.value)} placeholder="e.g. April 2026" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.common.amount} (ETB)</label>
              <Input type="number" value={monthAmount} onChange={(e) => setMonthAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.superAdmin.monthDeadline}</label>
              <Input type="date" value={monthDeadline} onChange={(e) => setMonthDeadline(e.target.value)} />
            </div>
          </div>
          <Button onClick={createMonth} className="w-full">{t.superAdmin.createMonth}</Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Announcements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            {t.superAdmin.createAnnouncement}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t.superAdmin.announcementTitle}</label>
            <Input value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t.superAdmin.announcementMessage}</label>
            <Textarea value={annMessage} onChange={(e) => setAnnMessage(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t.superAdmin.announcementTarget}</label>
            <Select value={annTarget} onValueChange={setAnnTarget}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.common.all}</SelectItem>
                <SelectItem value="members">{t.nav.members}</SelectItem>
                <SelectItem value="admins">Admins</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={createAnnouncement} className="w-full">{t.superAdmin.createAnnouncement}</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminSettings;
