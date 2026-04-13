import React from "react";
import BottomNav from "./BottomNav";
import DesktopSidebar from "./DesktopSidebar";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo.png";
import { useLanguage } from "@/contexts/LanguageContext";

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { appUser } = useAuth();
  const { t } = useLanguage();

  return (
    <div className="flex min-h-screen w-full bg-background">
      <DesktopSidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="flex items-center justify-between p-4 border-b bg-card md:hidden">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Logo" className="h-8 w-8 rounded-full object-cover" />
            <span className="font-semibold text-sm text-foreground">{t.common.appName}</span>
          </div>
          <span className="text-xs text-muted-foreground capitalize">
            {appUser?.name}
          </span>
        </header>

        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 overflow-auto">
          {children}
        </main>

        <BottomNav />
      </div>
    </div>
  );
};

export default AppLayout;
