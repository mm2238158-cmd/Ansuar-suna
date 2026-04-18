import React from "react";
import BottomNav from "./BottomNav";
import DesktopSidebar from "./DesktopSidebar";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo.png";
import { useLanguage } from "@/contexts/LanguageContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Link } from "react-router-dom";

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { appUser } = useAuth();
  const { t } = useLanguage();

  const initials = (appUser?.name || "U")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen w-full bg-background">
      <DesktopSidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b bg-card/95 backdrop-blur shadow-sm md:hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src={logo} alt="Logo" className="h-9 w-9 rounded-full object-cover ring-2 ring-primary/30" />
            <span className="font-semibold text-sm text-foreground truncate">{t.common.appName}</span>
          </div>
          <Link to="/profile" aria-label="Profile">
            <Avatar className="h-9 w-9 ring-2 ring-primary/40 hover:ring-primary transition-all">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Link>
        </header>

        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6 overflow-auto">
          {children}
        </main>

        <BottomNav />
      </div>
    </div>
  );
};

export default AppLayout;
