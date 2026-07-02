import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";
import { CheckCircle2, Mail, Phone, LogOut } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { auth } from "@/lib/firebase";
import { getCallableErrorMessage } from "@/lib/callable-errors";

const VerifyAccount = () => {
  const {
    firebaseUser,
    appUser,
    logout,
    reloadFirebaseUser,
    resendEmailVerification,
    initPhoneRecaptcha,
    sendPhoneOtp,
    confirmPhoneOtp,
    activateAccount,
    refreshUser,
  } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneLinked, setPhoneLinked] = useState(false);
  const [phone, setPhone] = useState(appUser?.phone || "");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    initPhoneRecaptcha("recaptcha-container");
  }, [initPhoneRecaptcha]);

  useEffect(() => {
    setPhone(appUser?.phone || "");
  }, [appUser?.phone]);

  const syncVerificationState = async () => {
    await reloadFirebaseUser();
    const user = auth.currentUser;
    if (!user) return;
    setEmailVerified(user.emailVerified);
    setPhoneLinked(!!user.phoneNumber);
  };

  useEffect(() => {
    if (firebaseUser) {
      setEmailVerified(firebaseUser.emailVerified);
      setPhoneLinked(!!firebaseUser.phoneNumber);
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
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: "Error", description: message, variant: "destructive" });
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

  const handleSendOtp = async () => {
    if (!phone.trim()) {
      toast({ title: "Error", description: t.auth.verifyPhoneRequired, variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await sendPhoneOtp(phone);
      setOtpSent(true);
      toast({ title: t.auth.verifyOtpSent });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmOtp = async () => {
    if (otp.length < 6) return;
    setLoading(true);
    try {
      await confirmPhoneOtp(otp);
      setPhoneLinked(true);
      toast({ title: t.auth.verifyPhoneConfirmed });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: "Error", description: message, variant: "destructive" });
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
        description: getCallableErrorMessage(err, t.auth.verifyActivateFailed),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const canActivate = emailVerified && phoneLinked;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div id="recaptcha-container" />
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

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2 font-medium">
              <Phone className="h-4 w-4 text-primary" />
              {t.auth.verifyPhoneStep}
              {phoneLinked && <CheckCircle2 className="h-4 w-4 text-success ml-auto" />}
            </div>
            <p className="text-xs text-muted-foreground">{t.auth.verifyPhoneHelp}</p>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+251..."
              disabled={phoneLinked}
            />
            {!phoneLinked && (
              <>
                <Button type="button" className="w-full" onClick={handleSendOtp} disabled={loading || otpSent}>
                  {otpSent ? t.auth.verifyOtpSent : t.auth.verifySendOtp}
                </Button>
                {otpSent && (
                  <div className="space-y-3">
                    <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                      <InputOTPGroup className="justify-center">
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                          <InputOTPSlot key={i} index={i} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                    <Button type="button" className="w-full" onClick={handleConfirmOtp} disabled={loading || otp.length < 6}>
                      {t.auth.verifyConfirmOtp}
                    </Button>
                  </div>
                )}
              </>
            )}
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
