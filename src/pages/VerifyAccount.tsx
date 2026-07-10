import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";
import { CheckCircle2, Mail, LogOut } from "lucide-react";
import { auth } from "@/lib/firebase";
import { getAuthErrorMessage } from "@/lib/auth-errors";

const VerifyAccount = () => {
  const {
    firebaseUser,
    appUser,
    logout,
    reloadFirebaseUser,
    resendEmailVerification,
    activateAccount,
    refreshUser,
  } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [emailVerified, setEmailVerified] = useState(false);
  const [loading, setLoading] = useState(false);


  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const showDomainHint = hostname !== "localhost" && hostname !== "127.0.0.1";


  const syncVerificationState = async () => {
    await reloadFirebaseUser();
    const user = auth.currentUser;
    if (!user) return;
    setEmailVerified(user.emailVerified);
  };

  useEffect(() => {
    if (firebaseUser) {
      setEmailVerified(firebaseUser.emailVerified);
    }
  }, [firebaseUser]);

  useEffect(() => {
    const interval = setInterval(() => {
      syncVerificationState().catch(() => undefined);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleResendEmail = async () => {
    setLoading(true);
    try {
      await resendEmailVerification();
      toast({ title: t.auth.verifyEmailResent });
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: getAuthErrorMessage(err, t.auth),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckEmail = async () => {
    setLoading(true);
    try {
      await syncVerificationState();
      if (auth.currentUser?.emailVerified) {
        toast({ title: t.auth.verifyEmailConfirmed });
      } else {
        toast({ title: t.auth.verifyEmailPending, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };


  const handleActivate = async () => {
    setLoading(true);
    try {
      await syncVerificationState();
      const result = await activateAccount();
      await refreshUser();
      if (result.noAdminAvailable) {
        toast({ title: t.auth.verifyActivatedNoAdmin });
      } else {
        toast({ title: t.auth.verifyActivated });
      }
      navigate("/", { replace: true });
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: getAuthErrorMessage(err, t.auth),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const canActivate = emailVerified;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="text-center space-y-3">
          <img src={logo} alt="Logo" className="h-16 w-16 mx-auto rounded-full object-cover" />
          <CardTitle className="text-xl font-display">{t.auth.verifyAccountTitle}</CardTitle>
          <p className="text-sm text-muted-foreground">{t.auth.verifyAccountDesc}</p>
        </CardHeader>
        <CardContent className="space-y-6 pb-8">
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2 font-medium">
              <Mail className="h-4 w-4 text-primary" />
              {t.auth.verifyEmailStep}
              {emailVerified && <CheckCircle2 className="h-4 w-4 text-success ml-auto" />}
            </div>
            <p className="text-xs text-muted-foreground">{t.auth.verifyEmailHelp}</p>
            <div className="flex gap-2 flex-wrap">
              <Button type="button" variant="outline" size="sm" onClick={handleResendEmail} disabled={loading}>
                {t.auth.verifyResendEmail}
              </Button>
              <Button type="button" size="sm" onClick={handleCheckEmail} disabled={loading}>
                {t.auth.verifyCheckEmail}
              </Button>
            </div>
          </div>



          <Button type="button" className="w-full" onClick={handleActivate} disabled={!canActivate || loading}>
            {loading ? t.common.loading : t.auth.verifyActivate}
          </Button>

          <Button type="button" variant="outline" className="w-full gap-2" onClick={logout}>
            <LogOut className="h-4 w-4" />
            {t.common.logout}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyAccount;
