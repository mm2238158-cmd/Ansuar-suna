import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRef, useState } from "react";
import { doc, updateDoc, deleteField } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Language } from "@/lib/types";
import { LogOut, User, Camera, Trash2 } from "lucide-react";
import { logError } from "@/lib/logger";

const MAX_AVATAR_BYTES = 1024 * 1024;

const Profile = () => {
  const { appUser, logout, refreshUser } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { toast } = useToast();
  const [name, setName] = useState(appUser?.name || "");
  const [phone, setPhone] = useState(appUser?.phone || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const initials = (appUser?.name || "U")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleSave = async () => {
    if (!appUser) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", appUser.id), { name, phone, language });
      await refreshUser();
      toast({ title: t.profile.updateSuccess });
    } catch (err: any) {
      toast({ title: t.toasts.error, description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePickFile = () => fileRef.current?.click();

  const handleFile = async (file?: File | null) => {
    if (!file || !appUser) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: t.profile.photoInvalidType, variant: "destructive" });
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast({ title: t.profile.photoTooLarge, variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `avatars/${appUser.id}/avatar-${Date.now()}.${ext}`;
      const fileRefObj = ref(storage, path);
      await uploadBytes(fileRefObj, file, { contentType: file.type });
      const url = await getDownloadURL(fileRefObj);
      await updateDoc(doc(db, "users", appUser.id), { photoURL: url });
      // Best-effort cleanup of the previous file.
      if (appUser.photoURL) {
        try {
          await deleteObject(ref(storage, appUser.photoURL));
        } catch (e) {
          logError("avatar.cleanup", e);
        }
      }
      await refreshUser();
      toast({ title: t.profile.photoUpdated });
    } catch (err: any) {
      logError("avatar.upload", err);
      toast({ title: t.toasts.error, description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    if (!appUser?.photoURL) return;
    setUploading(true);
    try {
      try {
        await deleteObject(ref(storage, appUser.photoURL));
      } catch (e) {
        logError("avatar.delete", e);
      }
      await updateDoc(doc(db, "users", appUser.id), { photoURL: deleteField() });
      await refreshUser();
      toast({ title: t.profile.photoRemoved });
    } catch (err: any) {
      toast({ title: t.toasts.error, description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-display font-bold">{t.nav.profile}</h1>

      <Card>
        <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-5">
          <Avatar className="h-24 w-24 ring-2 ring-primary/30">
            {appUser?.photoURL && <AvatarImage src={appUser.photoURL} alt={appUser?.name || "Avatar"} />}
            <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 text-center sm:text-left space-y-3">
            <div>
              <p className="font-medium">{appUser?.name}</p>
              <p className="text-xs text-muted-foreground">{t.profile.photoHelp}</p>
            </div>
            <div className="flex flex-wrap justify-center sm:justify-start gap-2">
              <Button size="sm" onClick={handlePickFile} disabled={uploading} className="gap-2">
                <Camera className="h-4 w-4" />
                {appUser?.photoURL ? t.profile.changePhoto : t.profile.uploadPhoto}
              </Button>
              {appUser?.photoURL && (
                <Button size="sm" variant="outline" onClick={handleRemove} disabled={uploading} className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  {t.profile.removePhoto}
                </Button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>
        </CardContent>
      </Card>

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
