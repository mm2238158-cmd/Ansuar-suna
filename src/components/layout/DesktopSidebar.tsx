import { Home, CreditCard, Bell, User, LayoutDashboard, Users, Settings, LogOut, ShieldAlert } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

const DesktopSidebar = () => {
  const { appUser, logout } = useAuth();
  const { t } = useLanguage();
  const role = appUser?.role;

  const memberLinks = [
    { to: "/", icon: Home, label: t.nav.home },
    { to: "/payments", icon: CreditCard, label: t.nav.payments },
    { to: "/notifications", icon: Bell, label: t.nav.notifications },
    { to: "/profile", icon: User, label: t.nav.profile },
  ];

  const adminLinks = [
    { to: "/", icon: LayoutDashboard, label: t.nav.dashboard },
    { to: "/payments", icon: CreditCard, label: t.nav.payments },
    { to: "/members", icon: Users, label: t.nav.members },
    { to: "/profile", icon: User, label: t.nav.profile },
  ];

  const superAdminLinks = [
    { to: "/", icon: LayoutDashboard, label: t.nav.dashboard },
    { to: "/payments", icon: CreditCard, label: t.nav.payments },
    { to: "/users", icon: Users, label: t.nav.users },
    { to: "/settings", icon: Settings, label: t.nav.settings },
    { to: "/data-health", icon: ShieldAlert, label: t.nav.dataHealth },
  ];

  const links = role === "super_admin" ? superAdminLinks : role === "admin" ? adminLinks : memberLinks;

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:border-r bg-card min-h-screen">
      <div className="flex items-center gap-3 p-6 border-b">
        <img src={logo} alt="Ansuarusuna" className="h-10 w-10 rounded-full object-cover" />
        <div>
          <h2 className="font-semibold text-sm text-foreground">{t.common.appName}</h2>
          <p className="text-xs text-muted-foreground capitalize">{role?.replace("_", " ")}</p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )
            }
          >
            <link.icon className="h-5 w-5" />
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t">
        <button
          onClick={logout}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors w-full"
        >
          <LogOut className="h-5 w-5" />
          {t.common.logout}
        </button>
      </div>
    </aside>
  );
};

export default DesktopSidebar;
