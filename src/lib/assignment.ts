type Gender = "male" | "female";

export interface AdminUser {
  id: string;
  name: string;
  gender?: Gender;
  isActive?: boolean;
  role: string;
}

export const getEligibleAdmins = (admins: AdminUser[], memberGender?: Gender): AdminUser[] => {
  const active = admins.filter((a) => a.role === "admin" && a.isActive !== false);
  if (!memberGender) return active;
  return active.filter((a) => a.gender === memberGender);
};

export const pickLeastLoadedAdmin = (
  eligible: AdminUser[],
  counts: Record<string, number>
): AdminUser | null => {
  if (eligible.length === 0) return null;
  if (eligible.length === 1) return eligible[0];

  const load = (admin: AdminUser) => counts[admin.id] ?? 0;

  return [...eligible].sort((a, b) => {
    const diff = load(a) - load(b);
    if (diff !== 0) return diff;
    const nameDiff = a.name.localeCompare(b.name);
    if (nameDiff !== 0) return nameDiff;
    return a.id.localeCompare(b.id);
  })[0];
};
