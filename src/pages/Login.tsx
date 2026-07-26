import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";
import { Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";

const Login = () => {
  const { login, loginWithGoogle } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast({ title: t.auth.loginSuccess });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const authErrorMessage = (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    return message === "SIGN_UP_REQUIRED" ? t.auth.signUpRequired : message;
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
      toast({ title: t.auth.loginSuccess });
    } catch (err: unknown) {
      toast({ title: "Error", description: authErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "radial-gradient(circle at 20% 0%, hsl(var(--primary) / 0.12), transparent 50%), radial-gradient(circle at 80% 100%, hsl(var(--primary) / 0.08), transparent 50%), hsl(var(--background))",
      }}
    >
      <Card className="w-full max-w-md shadow-2xl border-border/40 backdrop-blur">
        <CardHeader className="text-center space-y-5 pt-8">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl" />
              <img
                src={logo}
                alt="Ansuarusuna"
                className="relative h-24 w-24 rounded-full object-cover shadow-lg ring-4 ring-primary/20"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <CardTitle className="text-2xl font-display">{t.common.appName}</CardTitle>
            <CardDescription className="text-sm">{t.auth.login}</CardDescription>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-5 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.auth.email}</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="email@example.com"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.auth.password}</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="h-11 pr-11"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-9 w-9"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Link to="/forgot-password" className="text-sm text-primary hover:underline block text-right">
              {t.auth.forgotPassword}
            </Link>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pb-8">
            <Button type="submit" className="w-full h-11 shadow-md" disabled={loading}>
              {loading ? t.common.loading : t.auth.login}
            </Button>
            {/*
              Google sign-in is temporarily hidden because there is no Google
              signup / profile-completion flow: users who signed in with Google
              but lack a Firestore profile would be silently signed out.
              Re-enable this once a proper first-time Google onboarding page
              collects name, phone, and gender before creating the user doc.
              (Audit item H1.)
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">{t.auth.orContinueWith}</span>
              </div>
            </div>
            <Button type="button" variant="outline" className="w-full h-11" onClick={handleGoogle} disabled={loading}>
              ...
              {t.auth.signInWithGoogle}
            </Button>
            */}
            <p className="text-sm text-center text-muted-foreground">
              {t.auth.noAccount}{" "}
              <Link to="/register" className="text-primary font-medium hover:underline">
                {t.auth.register}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Login;
