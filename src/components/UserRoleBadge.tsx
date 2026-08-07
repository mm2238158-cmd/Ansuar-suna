import { Crown, Shield, User } from "lucide-react";
import type { UserRole } from "@/lib/types";

const styles: Record<UserRole, string> = {
  super_admin: "bg-primary/10 text-primary",
  admin: "bg-accent/20 text-accent-foreground",
  member: "bg-muted text-muted-foreground",
};

const icons: Record<UserRole, typeof User> = {
  super_admin: Crown,
  admin: Shield,
  member: User,
};

const UserRoleBadge = ({ role }: { role: UserRole | string }) => {
  const key = (role in styles ? role : "member") as UserRole;
  const Icon = icons[key];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${styles[key]}`}
    >
      <Icon className="h-2.5 w-2.5" aria-hidden="true" />
      {key.replace("_", " ")}
    </span>
  );
};

export default UserRoleBadge;
