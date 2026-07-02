import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

const PendingApproval = () => {
  const { logout, appUser } = useAuth();
  const { t } = useLanguage();
  const message =
    appUser?.status === "inactive" ? t.auth.accountInactive : t.auth.registrationPending;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg text-center">
        <CardContent className="p-8 space-y-6">
          <img src={logo} alt="Logo" className="h-20 w-20 mx-auto rounded-full object-cover shadow-md" />
          <h2 className="text-xl font-display font-semibold">{t.common.appName}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">{message}</p>
          <Button variant="outline" onClick={logout} className="gap-2">
            <LogOut className="h-4 w-4" />
            {t.common.logout}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingApproval;
