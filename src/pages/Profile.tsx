import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Language } from "@/lib/types";
import { LogOut, User } from "lucide-react";

const Profile = () => {
  const { appUser, logout, refreshUser } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { toast } = useToast();
  const [name, setName] = useState(appUser?.name || "");
  const [phone, setPhone] = useState(appUser?.phone || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!appUser) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", appUser.id), { name, phone, language });
      await refreshUser();
      toast({ title: t.profile.updateSuccess });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-display font-bold">{t.nav.profile}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            {t.profile.editProfile}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t.auth.name}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t.auth.phone}</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t.auth.email}</label>
            <Input value={appUser?.email || ""} disabled />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t.profile.languagePreference}</label>
            <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t.common.english}</SelectItem>
                <SelectItem value="am">{t.common.amharic}</SelectItem>
                <SelectItem value="om">{t.common.oromo}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave} className="w-full" disabled={saving}>
            {saving ? t.common.loading : t.common.save}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium capitalize">{appUser?.role?.replace("_", " ")}</p>
              <p className="text-xs text-muted-foreground">
                {t.status[appUser?.status as keyof typeof t.status]}
              </p>
            </div>
            <Button variant="outline" onClick={logout} className="gap-2">
              <LogOut className="h-4 w-4" />
              {t.common.logout}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;
