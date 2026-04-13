import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc, query, where, addDoc, Timestamp, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AppUser as UserType } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle, XCircle, Shield, User, UserCheck } from "lucide-react";

const SuperAdminUsers = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserType[]>([]);
  const [admins, setAdmins] = useState<UserType[]>([]);
  const [filter, setFilter] = useState("all");
  const [assignDialog, setAssignDialog] = useState<UserType | null>(null);
  const [selectedAdmin, setSelectedAdmin] = useState("");

  const fetchUsers = async () => {
    const snap = await getDocs(collection(db, "users"));
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserType));
    setUsers(all);
    setAdmins(all.filter((u) => u.role === "admin"));
  };

  useEffect(() => { fetchUsers(); }, []);

  const approveUser = async (userId: string) => {
    await updateDoc(doc(db, "users", userId), { status: "active", isActive: true });
    toast({ title: "User approved" });
    fetchUsers();
  };

  const toggleActive = async (userId: string, isActive: boolean) => {
    await updateDoc(doc(db, "users", userId), { isActive: !isActive, status: !isActive ? "active" : "inactive" });
    toast({ title: isActive ? "User deactivated" : "User activated" });
    fetchUsers();
  };

  const changeRole = async (userId: string, role: string) => {
    await updateDoc(doc(db, "users", userId), { role });
    toast({ title: "Role updated" });
    fetchUsers();
  };

  const assignAdmin = async () => {
    if (!assignDialog || !selectedAdmin) return;
    // Remove existing assignment
    const existingQ = query(collection(db, "assignments"), where("memberId", "==", assignDialog.id));
    const existingSnap = await getDocs(existingQ);
    await Promise.all(existingSnap.docs.map((d) => deleteDoc(d.ref)));

    await addDoc(collection(db, "assignments"), {
      adminId: selectedAdmin,
      memberId: assignDialog.id,
      assignedAt: Timestamp.now(),
    });
    await updateDoc(doc(db, "users", assignDialog.id), { assignedAdminId: selectedAdmin });
    toast({ title: "Admin assigned" });
    setAssignDialog(null);
    setSelectedAdmin("");
  };

  const filtered = filter === "all" ? users :
    filter === "pending" ? users.filter((u) => u.status === "pending") :
    users.filter((u) => u.role === filter);

  const statusBadge = (user: UserType) => {
    const colors: Record<string, string> = {
      active: "bg-success/10 text-success",
      pending: "bg-warning/10 text-warning",
      inactive: "bg-muted text-muted-foreground",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[user.status] || ""}`}>
        {t.status[user.status as keyof typeof t.status]}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-display font-bold">{t.superAdmin.manageUsers}</h1>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.common.all}</SelectItem>
            <SelectItem value="pending">{t.status.pending}</SelectItem>
            <SelectItem value="member">{t.nav.members}</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mobile */}
      <div className="md:hidden space-y-3">
        {filtered.map((u) => (
          <Card key={u.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{u.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{u.role.replace("_", " ")}</p>
                  </div>
                </div>
                {statusBadge(u)}
              </div>
              <div className="flex gap-2 flex-wrap">
                {u.status === "pending" && (
                  <Button size="sm" onClick={() => approveUser(u.id)} className="gap-1">
                    <CheckCircle className="h-3 w-3" /> {t.superAdmin.approveUser}
                  </Button>
                )}
                {u.status !== "pending" && (
                  <Button size="sm" variant="outline" onClick={() => toggleActive(u.id, u.isActive)}>
                    {u.isActive ? t.superAdmin.deactivateUser : t.superAdmin.activateUser}
                  </Button>
                )}
                {u.role === "member" && u.status === "active" && (
                  <Button size="sm" variant="outline" onClick={() => setAssignDialog(u)} className="gap-1">
                    <Shield className="h-3 w-3" /> {t.superAdmin.assignAdmin}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
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
                <TableHead>Role</TableHead>
                <TableHead>{t.common.status}</TableHead>
                <TableHead>{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.phone}</TableCell>
                  <TableCell>
                    <Select value={u.role} onValueChange={(v) => changeRole(u.id, v)}>
                      <SelectTrigger className="w-32 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{statusBadge(u)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {u.status === "pending" && (
                        <Button size="sm" variant="ghost" onClick={() => approveUser(u.id)}>
                          <UserCheck className="h-4 w-4 text-success" />
                        </Button>
                      )}
                      {u.status !== "pending" && (
                        <Button size="sm" variant="ghost" onClick={() => toggleActive(u.id, u.isActive)}>
                          {u.isActive ? <XCircle className="h-4 w-4 text-destructive" /> : <CheckCircle className="h-4 w-4 text-success" />}
                        </Button>
                      )}
                      {u.role === "member" && u.status === "active" && (
                        <Button size="sm" variant="ghost" onClick={() => setAssignDialog(u)}>
                          <Shield className="h-4 w-4 text-primary" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Assign Admin Dialog */}
      <Dialog open={!!assignDialog} onOpenChange={() => setAssignDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.superAdmin.assignAdmin} - {assignDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedAdmin} onValueChange={setSelectedAdmin}>
              <SelectTrigger>
                <SelectValue placeholder="Select an admin" />
              </SelectTrigger>
              <SelectContent>
                {admins.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAssignDialog(null)} className="flex-1">{t.common.cancel}</Button>
              <Button onClick={assignAdmin} className="flex-1" disabled={!selectedAdmin}>{t.common.confirm}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminUsers;
