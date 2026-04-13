import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { collection, query, where, getDocs, orderBy, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Notification as AppNotification, Announcement } from "@/lib/types";
import { Bell, Megaphone, CheckCheck } from "lucide-react";

const Notifications = () => {
  const { appUser } = useAuth();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!appUser) return;
      const notifQ = query(collection(db, "notifications"), where("userId", "==", appUser.id), orderBy("createdAt", "desc"));
      const notifSnap = await getDocs(notifQ);
      setNotifications(notifSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification)));

      const role = appUser.role;
      const annQ = query(
        collection(db, "announcements"),
        where("target", "in", ["all", role === "admin" ? "admins" : "members"]),
        orderBy("createdAt", "desc")
      );
      const annSnap = await getDocs(annQ);
      setAnnouncements(annSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement)));
    };
    fetchData();
  }, [appUser]);

  const markAsRead = async (id: string) => {
    await updateDoc(doc(db, "notifications", id), { isRead: true });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.isRead);
    await Promise.all(unread.map((n) => updateDoc(doc(db, "notifications", n.id), { isRead: true })));
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold">{t.notifications.title}</h1>
        {notifications.some((n) => !n.isRead) && (
          <Button variant="ghost" size="sm" onClick={markAllRead} className="gap-1 text-xs">
            <CheckCheck className="h-4 w-4" />
            {t.notifications.markAllRead}
          </Button>
        )}
      </div>

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="space-y-3">
          {announcements.map((a) => (
            <Card key={a.id} className="border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Megaphone className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">{a.title}</p>
                    <p className="text-sm text-muted-foreground mt-1">{a.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {a.createdAt.toDate().toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Personal Notifications */}
      <div className="space-y-2">
        {notifications.length === 0 && announcements.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">{t.notifications.noNotifications}</p>
        ) : (
          notifications.map((n) => (
            <Card key={n.id} className={n.isRead ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Bell className={`h-4 w-4 mt-0.5 flex-shrink-0 ${n.isRead ? "text-muted-foreground" : "text-primary"}`} />
                    <div>
                      <p className="text-sm">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {n.createdAt.toDate().toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {!n.isRead && (
                    <Button variant="ghost" size="sm" onClick={() => markAsRead(n.id)} className="text-xs">
                      {t.notifications.markAsRead}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;
