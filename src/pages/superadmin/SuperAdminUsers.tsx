import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AppUser as UserType, Gender, UserRole } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle, XCircle, Crown, ShieldCheck } from "lucide-react";

import ListToolbar from "@/components/ListToolbar";
import EmptyState from "@/components/EmptyState";
import { writeAuditLog } from "@/lib/audit";
import { downloadCsv, timestampedFilename, toCsv } from "@/lib/csv";

interface RoleDialogState {
  user: UserType;
  role: UserRole;
  gender: Gender | "";
}

const SuperAdminUsers = () => {
  const { t } = useLanguage();
  const { appUser } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserType[]>([]);
  const [filter, setFilter] = useState("all");
  const [roleDialog, setRoleDialog] = useState<RoleDialogState | null>(null);
  const [savingRole, setSavingRole] = useState(false);
  const [search, setSearch] = useState("");

  const isFounder = !!appUser?.isFounder;
  const currentUid = appUser?.id;

  const fetchUsers = async () => {
    const snap = await getDocs(collection(db, "users"));
    setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserType)));
  };

  useEffect(() => { fetchUsers(); }, []);

  const activeSuperAdminCount = () =>
    users.filter((u) => u.role === "super_admin" && u.isActive).length;

  const isLocked = (u: UserType) => {
    if (u.id === currentUid) return true; // self
    if (u.isFounder && !isFounder) return true; // founder protection
    return false;
  };

  const toggleActive = async (u: UserType) => {
    if (isLocked(u)) {
      toast({ title: t.toasts.actionBlocked, description: u.id === currentUid ? t.toasts.cannotDeactivateSelf : t.toasts.founderProtected, variant: "destructive" });
      return;
    }
    if (u.role === "super_admin" && u.isActive && activeSuperAdminCount() <= 1) {
      toast({ title: t.toasts.actionBlocked, description: t.toasts.lastSuperAdminDeactivate, variant: "destructive" });
      return;
    }
    await updateDoc(doc(db, "users", u.id), { isActive: !u.isActive, status: !u.isActive ? "active" : "inactive" });
    void writeAuditLog(u.isActive ? "user.deactivate" : "user.activate", currentUid, { targetId: u.id });
    toast({ title: u.isActive ? t.toasts.userDeactivated : t.toasts.userActivated });
    fetchUsers();
  };

  const openRoleDialog = (u: UserType) => {
    if (isLocked(u)) {
      toast({
        title: t.toasts.actionBlocked,
        description: u.id === currentUid ? t.toasts.cannotChangeOwnRole : t.toasts.founderRoleProtected,
        variant: "destructive",
      });
      return;
    }
    setRoleDialog({ user: u, role: u.role, gender: u.gender ?? "" });
  };

  const confirmRoleChange = async () => {
    if (!roleDialog) return;
    const { user: u, role, gender } = roleDialog;

    if (role === u.role && (role !== "admin" || gender === (u.gender ?? ""))) {
      setRoleDialog(null);
      return;
    }
    if (u.role === "super_admin" && role !== "super_admin" && activeSuperAdminCount() <= 1) {
      toast({ title: t.toasts.actionBlocked, description: t.toasts.lastSuperAdminDemote, variant: "destructive" });
      return;
    }
    if (role === "super_admin" && !isFounder) {
      toast({ title: t.toasts.actionBlocked, description: t.toasts.founderOnlyPromote, variant: "destructive" });
      return;
    }
    if (role === "admin" && !gender) {
      toast({ title: t.toasts.error, description: t.superAdmin.genderRequiredForAdmin, variant: "destructive" });
      return;
    }

    setSavingRole(true);
    try {
      const payload: Record<string, unknown> = { role };
      if (role === "admin" && gender) payload.gender = gender;
      await updateDoc(doc(db, "users", u.id), payload);
      void writeAuditLog("role.change", currentUid, { targetId: u.id, from: u.role, to: role });
      toast({ title: t.toasts.roleUpdated });
      setRoleDialog(null);
      fetchUsers();
    } catch (err: any) {
      toast({ title: t.toasts.error, description: err.message, variant: "destructive" });
    } finally {
      setSavingRole(false);
    }
  };

  const byFilter = filter === "all" ? users :
    filter === "pending" ? users.filter((u) => u.status === "pending") :
    users.filter((u) => u.role === filter);

  const term = search.trim().toLowerCase();
  const filtered = term
    ? byFilter.filter((u) =>
        [u.name, u.email, u.phone].some((v) => (v ?? "").toLowerCase().includes(term))
      )
    : byFilter;

  const exportUsers = () => {
    const csv = toCsv(filtered, [
      { key: "name", header: "Name", value: (u) => u.name },
      { key: "email", header: "Email", value: (u) => u.email },
      { key: "phone", header: "Phone", value: (u) => u.phone },
      { key: "role", header: "Role", value: (u) => u.role },
      { key: "status", header: "Status", value: (u) => u.status },
      { key: "gender", header: "Gender", value: (u) => u.gender ?? "" },
      { key: "active", header: "Active", value: (u) => (u.isActive ? "yes" : "no") },
      { key: "admin", header: "Assigned admin", value: (u) => u.assignedAdminId ?? "" },
      { key: "joined", header: "Joined at", value: (u) => u.joinedAt?.toDate?.().toISOString() ?? "" },
    ]);
    downloadCsv(timestampedFilename("users"), csv);
    toast({ title: t.toasts.exported });
  };

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

  const roleLabel = (role: UserRole) =>
    role === "super_admin" ? t.superAdmin.roleSuperAdmin : role === "admin" ? t.superAdmin.roleAdmin : t.superAdmin.roleMember;

  const userAvatar = (u: UserType, size = "h-10 w-10") => (
    <Avatar className={size}>
      {u.photoURL && <AvatarImage src={u.photoURL} alt={u.name} />}
      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
        {(u.name || "U").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );

  const roleTags = (u: UserType) => (
    <div className="flex gap-1">
      {u.isFounder && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">
          <Crown className="h-2.5 w-2.5" /> Founder
        </span>
      )}
      {u.id === currentUid && (
        <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-medium">You</span>
      )}
    </div>
  );

  const dialogRole = roleDialog?.role;

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

      <ListToolbar
        id="superadmin-users-search"
        value={search}
        onChange={setSearch}
        onExport={filtered.length ? exportUsers : undefined}
      />

      {filtered.length === 0 && (
        <EmptyState title={t.common.noResults} description={t.common.noData} />
      )}

      {/* Mobile */}
      <div className="md:hidden space-y-3">
        {filtered.map((u) => {
          const locked = isLocked(u);
          return (
            <Card key={u.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {userAvatar(u)}
                    <div>
                      <p className="font-medium text-sm flex items-center gap-2">{u.name} {roleTags(u)}</p>
                      <p className="text-xs text-muted-foreground">{roleLabel(u.role)}</p>
                    </div>
                  </div>
                  {statusBadge(u)}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {u.status === "pending" && (
                    <span className="text-xs text-muted-foreground px-2 py-1 rounded-md bg-muted">
                      {t.auth.verifyAccountTitle}
                    </span>
                  )}
                  {u.status !== "pending" && (
                    <Button size="sm" variant="outline" onClick={() => toggleActive(u)} disabled={locked}>
                      {u.isActive ? t.superAdmin.deactivateUser : t.superAdmin.activateUser}
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => openRoleDialog(u)} disabled={locked}>
                    <ShieldCheck className="h-4 w-4" />
                    {t.superAdmin.manageRole}
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
                <TableHead>Role</TableHead>
                <TableHead>{t.common.status}</TableHead>
                <TableHead>{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const locked = isLocked(u);
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {userAvatar(u, "h-8 w-8")}
                        {u.name} {roleTags(u)}
                      </div>
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.phone}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        {u.role === "super_admin" && <Crown className="h-3.5 w-3.5 text-primary" />}
                        {roleLabel(u.role)}
                      </span>
                    </TableCell>
                    <TableCell>{statusBadge(u)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {u.status !== "pending" && (
                          <Button size="sm" variant="ghost" onClick={() => toggleActive(u)} disabled={locked} aria-label={u.isActive ? t.superAdmin.deactivateUser : t.superAdmin.activateUser}>
                            {u.isActive ? <XCircle className="h-4 w-4 text-destructive" /> : <CheckCircle className="h-4 w-4 text-success" />}
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openRoleDialog(u)} disabled={locked}>
                          <ShieldCheck className="h-4 w-4" />
                          {t.superAdmin.manageRole}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Manage role */}
      <Dialog open={!!roleDialog} onOpenChange={() => setRoleDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              {t.superAdmin.manageRole}
            </DialogTitle>
            <DialogDescription>{t.superAdmin.manageRoleDesc}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium">{roleDialog?.user.name}</p>
              <p className="text-xs text-muted-foreground">{roleDialog?.user.email}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t.superAdmin.currentRole}: {roleDialog ? roleLabel(roleDialog.user.role) : ""}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t.superAdmin.changeRole}</label>
              <Select
                value={roleDialog?.role}
                onValueChange={(v) => setRoleDialog((prev) => (prev ? { ...prev, role: v as UserRole } : null))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">{t.superAdmin.roleMember}</SelectItem>
                  <SelectItem value="admin">{t.superAdmin.roleAdmin}</SelectItem>
                  {isFounder && <SelectItem value="super_admin">{t.superAdmin.roleSuperAdmin}</SelectItem>}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {dialogRole === "super_admin"
                  ? t.superAdmin.roleSuperAdminDesc
                  : dialogRole === "admin"
                  ? t.superAdmin.roleAdminDesc
                  : t.superAdmin.roleMemberDesc}
              </p>
            </div>

            {dialogRole === "admin" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">{t.superAdmin.gender}</label>
                <Select
                  value={roleDialog?.gender || ""}
                  onValueChange={(v) => setRoleDialog((prev) => (prev ? { ...prev, gender: v as Gender } : null))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t.auth.selectGender} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{t.auth.genderMale}</SelectItem>
                    <SelectItem value="female">{t.auth.genderFemale}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t.superAdmin.promoteToAdminDesc}</p>
              </div>
            )}

            {dialogRole === "super_admin" && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-1">
                <p className="text-sm font-medium">{t.superAdmin.superAdminWarningTitle}</p>
                <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
                  <li>{t.superAdmin.superAdminPower1}</li>
                  <li>{t.superAdmin.superAdminPower2}</li>
                  <li>{t.superAdmin.superAdminPower3}</li>
                </ul>
                <p className="text-xs text-destructive">{t.superAdmin.superAdminWarningNote}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialog(null)}>{t.common.cancel}</Button>
            <Button
              onClick={confirmRoleChange}
              disabled={savingRole || (dialogRole === "admin" && !roleDialog?.gender)}
            >
              {savingRole ? t.common.loading : t.common.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminUsers;
