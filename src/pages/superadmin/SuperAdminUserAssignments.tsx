import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ListToolbar from "@/components/ListToolbar";
import EmptyState from "@/components/EmptyState";
import ListSkeleton from "@/components/ListSkeleton";
import { writeAuditLog } from "@/lib/audit";
import { logError } from "@/lib/logger";
import {
  applyAssignmentPlan,
  assignMember,
  bulkAssign,
  eligibleAdminsFor,
  planBalancedAssignments,
  sortAdminsByLoad,
  unassignMember,
} from "@/lib/assignment-utils";
import type { AppUser } from "@/lib/types";
import { UserCheck, Users, UserX, Scale, X } from "lucide-react";

type Assignment = { id: string; adminId: string; memberId: string };

const SuperAdminUserAssignments = () => {
  const { t } = useLanguage();
  const { appUser } = useAuth();
  const { toast } = useToast();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"all" | "unassigned" | "assigned">("all");
  const [adminFilter, setAdminFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkAdmin, setBulkAdmin] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppUser)));
      setLoading(false);
    }, (err) => { logError("assignments.users", err); setLoading(false); });

    const unsubAssignments = onSnapshot(collection(db, "assignments"), (snap) => {
      setAssignments(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Assignment, "id">) })));
    }, (err) => logError("assignments.list", err));

    return () => { unsubUsers(); unsubAssignments(); };
  }, []);

  const admins = useMemo(() => users.filter((u) => u.role === "admin" && u.isActive), [users]);
  const members = useMemo(
    () => users.filter((u) => u.role === "member" && u.isActive && u.status === "active"),
    [users]
  );

  const adminIdByMember = useMemo(() => {
    const map: Record<string, string> = {};
    assignments.forEach((a) => { map[a.memberId] = a.adminId; });
    return map;
  }, [assignments]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    assignments.forEach((a) => { c[a.adminId] = (c[a.adminId] ?? 0) + 1; });
    return c;
  }, [assignments]);

  const adminName = (id?: string) => users.find((u) => u.id === id)?.name;

  const assignedTotal = members.filter((m) => adminIdByMember[m.id]).length;
  const unassignedTotal = members.length - assignedTotal;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members.filter((m) => {
      const current = adminIdByMember[m.id];
      if (scope === "unassigned" && current) return false;
      if (scope === "assigned" && !current) return false;
      if (adminFilter !== "all" && current !== adminFilter) return false;
      if (genderFilter !== "all" && m.gender !== genderFilter) return false;
      if (term && ![m.name, m.email, m.phone].some((v) => (v ?? "").toLowerCase().includes(term))) return false;
      return true;
    });
  }, [members, adminIdByMember, scope, adminFilter, genderFilter, search]);

  const toggleSelected = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const allVisibleSelected = filtered.length > 0 && filtered.every((m) => selected.includes(m.id));
  const toggleAllVisible = () =>
    setSelected(allVisibleSelected ? [] : filtered.map((m) => m.id));

  const run = async (fn: () => Promise<void>, successTitle: string) => {
    setBusy(true);
    try {
      await fn();
      toast({ title: successTitle });
    } catch (err) {
      logError("assignments.write", err);
      toast({ title: t.toasts.assignFailed, description: t.toasts.somethingWentWrong, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleAssign = (member: AppUser, adminId: string) =>
    run(async () => {
      await assignMember(member.id, adminId);
      void writeAuditLog("user.assign_admin", appUser?.id, { memberId: member.id, adminId });
    }, t.toasts.adminAssigned);

  const handleUnassign = (member: AppUser) =>
    run(async () => {
      await unassignMember(member.id);
      void writeAuditLog("user.assign_admin", appUser?.id, { memberId: member.id, adminId: null });
    }, t.toasts.memberUnassigned);

  const handleBulk = () => {
    if (!bulkAdmin || selected.length === 0) return;
    return run(async () => {
      await bulkAssign(selected, bulkAdmin);
      void writeAuditLog("user.assign_admin", appUser?.id, { memberIds: selected, adminId: bulkAdmin });
      setSelected([]);
      setBulkAdmin("");
    }, t.toasts.membersAssigned);
  };

  const handleBalance = () => {
    const unassigned = members.filter((m) => !adminIdByMember[m.id]);
    const plan = planBalancedAssignments(unassigned, admins, counts);
    if (plan.length === 0) {
      toast({ title: t.superAdmin.balanceNone });
      return;
    }
    if (!window.confirm(`${t.superAdmin.balanceConfirm} (${plan.length})`)) return;
    return run(async () => {
      await applyAssignmentPlan(plan);
      void writeAuditLog("user.assign_admin", appUser?.id, { balanced: plan.length });
    }, t.toasts.membersAssigned);
  };

  const AdminSelect = ({ member }: { member: AppUser }) => {
    const options = sortAdminsByLoad(eligibleAdminsFor(admins, member), counts);
    const current = adminIdByMember[member.id] ?? "";
    if (options.length === 0) {
      return <span className="text-xs text-muted-foreground">{t.superAdmin.noEligibleAdmin}</span>;
    }
    return (
      <Select
        value={current}
        onValueChange={(v) => handleAssign(member, v)}
        disabled={busy}
      >
        <SelectTrigger className="h-9 w-full sm:w-52" aria-label={t.superAdmin.assignAdmin}>
          <SelectValue placeholder={t.superAdmin.selectAdmin} />
        </SelectTrigger>
        <SelectContent>
          {options.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name} ({counts[a.id] ?? 0} {t.superAdmin.adminMemberLoad})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const stats = [
    { icon: Users, label: t.superAdmin.totalActive, value: members.length },
    { icon: UserCheck, label: t.superAdmin.assignedCount, value: assignedTotal },
    { icon: UserX, label: t.superAdmin.unassignedCount, value: unassignedTotal },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">{t.superAdmin.assignmentsTitle}</h1>
        <p className="text-sm text-muted-foreground">{t.superAdmin.assignmentsDesc}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                <s.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-semibold leading-none">{s.value}</p>
                <p className="text-xs text-muted-foreground truncate">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Admin load */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sortAdminsByLoad(admins, counts).map((a) => (
          <Card key={a.id}>
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{a.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{a.gender ?? "—"}</p>
              </div>
              <span className="text-sm font-semibold whitespace-nowrap">
                {counts[a.id] ?? 0} <span className="text-xs font-normal text-muted-foreground">{t.superAdmin.adminLoadCard}</span>
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <ListToolbar id="assignments-search" value={search} onChange={setSearch} />
        <div className="flex flex-wrap gap-2">
          <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
            <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.common.all}</SelectItem>
              <SelectItem value="unassigned">{t.superAdmin.filterUnassigned}</SelectItem>
              <SelectItem value="assigned">{t.superAdmin.filterAssigned}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={adminFilter} onValueChange={setAdminFilter}>
            <SelectTrigger className="w-44 h-9"><SelectValue placeholder={t.superAdmin.filterByAdmin} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.superAdmin.filterByAdmin}</SelectItem>
              {admins.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={genderFilter} onValueChange={setGenderFilter}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.superAdmin.allGenders}</SelectItem>
              <SelectItem value="male">{t.auth.genderMale}</SelectItem>
              <SelectItem value="female">{t.auth.genderFemale}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="h-9 gap-2" onClick={handleBalance} disabled={busy || unassignedTotal === 0}>
            <Scale className="h-4 w-4" /> {t.superAdmin.balanceUnassigned}
          </Button>
        </div>
      </div>

      {/* Bulk bar */}
      {selected.length > 0 && (
        <Card className="border-primary/40">
          <CardContent className="p-3 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{selected.length} {t.superAdmin.selectedCount}</span>
            <Select value={bulkAdmin} onValueChange={setBulkAdmin}>
              <SelectTrigger className="h-9 w-52"><SelectValue placeholder={t.superAdmin.selectAdmin} /></SelectTrigger>
              <SelectContent>
                {sortAdminsByLoad(admins, counts).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({counts[a.id] ?? 0} {t.superAdmin.adminMemberLoad})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleBulk} disabled={!bulkAdmin || busy}>
              {t.superAdmin.assignSelected}
            </Button>
            <Button size="sm" variant="ghost" className="gap-1" onClick={() => setSelected([])}>
              <X className="h-4 w-4" /> {t.superAdmin.clearSelection}
            </Button>
          </CardContent>
        </Card>
      )}

      {loading && <ListSkeleton />}

      {!loading && filtered.length === 0 && (
        <EmptyState title={t.common.noResults} description={t.common.noData} />
      )}

      {/* Mobile */}
      {!loading && filtered.length > 0 && (
        <div className="md:hidden space-y-3">
          {filtered.map((m) => (
            <Card key={m.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selected.includes(m.id)}
                    onCheckedChange={() => toggleSelected(m.id)}
                    aria-label={m.name}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{m.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.phone}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.superAdmin.currentAdmin}:{" "}
                      {adminName(adminIdByMember[m.id]) ?? t.superAdmin.noAdminYet}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <AdminSelect member={m} />
                  {adminIdByMember[m.id] && (
                    <Button size="sm" variant="outline" onClick={() => handleUnassign(m)} disabled={busy}>
                      {t.superAdmin.unassign}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Desktop */}
      {!loading && filtered.length > 0 && (
        <div className="hidden md:block">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={toggleAllVisible}
                      aria-label={t.common.all}
                    />
                  </TableHead>
                  <TableHead>{t.auth.name}</TableHead>
                  <TableHead>{t.auth.phone}</TableHead>
                  <TableHead>{t.superAdmin.gender}</TableHead>
                  <TableHead>{t.superAdmin.currentAdmin}</TableHead>
                  <TableHead>{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.includes(m.id)}
                        onCheckedChange={() => toggleSelected(m.id)}
                        aria-label={m.name}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell>{m.phone}</TableCell>
                    <TableCell className="capitalize">{m.gender ?? "—"}</TableCell>
                    <TableCell>
                      {adminName(adminIdByMember[m.id]) ?? (
                        <span className="text-muted-foreground">{t.superAdmin.noAdminYet}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <AdminSelect member={m} />
                        {adminIdByMember[m.id] && (
                          <Button size="sm" variant="ghost" onClick={() => handleUnassign(m)} disabled={busy}>
                            {t.superAdmin.unassign}
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
      )}
    </div>
  );
};

export default SuperAdminUserAssignments;
