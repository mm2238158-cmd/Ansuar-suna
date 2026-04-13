import { Home, CreditCard, Bell, User, LayoutDashboard, Users, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

const BottomNav = () => {
  const { appUser } = useAuth();
  const { t } = useLanguage();
  const role = appUser?.role;

  const memberTabs = [
    { to: "/", icon: Home, label: t.nav.home },
    { to: "/payments", icon: CreditCard, label: t.nav.payments },
    { to: "/notifications", icon: Bell, label: t.nav.notifications },
    { to: "/profile", icon: User, label: t.nav.profile },
  ];

  const adminTabs = [
    { to: "/", icon: LayoutDashboard, label: t.nav.dashboard },
    { to: "/payments", icon: CreditCard, label: t.nav.payments },
    { to: "/members", icon: Users, label: t.nav.members },
    { to: "/profile", icon: User, label: t.nav.profile },
  ];

  const superAdminTabs = [
    { to: "/", icon: LayoutDashboard, label: t.nav.dashboard },
    { to: "/payments", icon: CreditCard, label: t.nav.payments },
    { to: "/users", icon: Users, label: t.nav.users },
    { to: "/settings", icon: Settings, label: t.nav.settings },
  ];

  const tabs = role === "super_admin" ? superAdminTabs : role === "admin" ? adminTabs : memberTabs;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card shadow-lg md:hidden">
      <div className="flex items-center justify-around py-2">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 px-3 py-1.5 text-xs transition-colors",
                isActive ? "text-primary font-semibold" : "text-muted-foreground"
              )
            }
          >
            <tab.icon className="h-5 w-5" />
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
