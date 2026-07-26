import React, { useState } from "react";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";
import { Link, useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Gender } from "@/lib/types";
import { Eye, EyeOff } from "lucide-react";
import { normalizePhone, isValidE164 } from "@/lib/phone-utils";
import { getAuthErrorMessage } from "@/lib/auth-errors";

const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
    phone: z
      .string()
      .trim()
      .min(7, "Enter a valid phone number")
      .max(20)
      .refine((v) => isValidE164(normalizePhone(v)), "Enter a valid phone number (e.g. +2519XXXXXXXX)"),
    email: z.string().trim().email("Enter a valid email").max(255),
    gender: z.enum(["male", "female"], { errorMap: () => ({ message: "Please select a gender" }) }),
    password: z.string().min(8, "Password must be at least 8 characters").max(128),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

const Register = () => {
  const { register } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = registerSchema.safeParse({
      name,
      phone,
      email,
      gender: gender as Gender,
      password,
      confirmPassword,
    });
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      toast({ title: "Error", description: first.message, variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await register(parsed.data.email, parsed.data.password, parsed.data.name, parsed.data.phone, parsed.data.gender);
      toast({ title: t.auth.verifyEmailSent });
      navigate("/verify-account");
    } catch (err: unknown) {
      toast({ title: "Error", description: getAuthErrorMessage(err, t.auth), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg border-border/50">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={logo} alt="Ansuarusuna" className="h-16 w-16 rounded-full object-cover shadow-md" />
          </div>
          <CardTitle className="text-2xl font-display">{t.auth.register}</CardTitle>
          <CardDescription>{t.common.appName}</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit} noValidate>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="reg-name" className="text-sm font-medium">{t.auth.name}</label>
              <Input id="reg-name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Full Name" maxLength={100} />
            </div>
            <div className="space-y-2">
              <label htmlFor="reg-phone" className="text-sm font-medium">{t.auth.phone}</label>
              <Input id="reg-phone" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+251..." maxLength={20} inputMode="tel" />
            </div>
            <div className="space-y-2">
              <label htmlFor="reg-email" className="text-sm font-medium">{t.auth.email}</label>
              <Input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="email@example.com" maxLength={255} />
            </div>
            <div className="space-y-2">
              <label htmlFor="reg-gender" className="text-sm font-medium">{t.auth.gender}</label>
              <Select value={gender} onValueChange={(value) => setGender(value as Gender)}>
                <SelectTrigger id="reg-gender">
                  <SelectValue placeholder={t.auth.selectGender} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">{t.auth.genderMale}</SelectItem>
                  <SelectItem value="female">{t.auth.genderFemale}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label htmlFor="reg-password" className="text-sm font-medium">{t.auth.password}</label>
              <div className="relative">
                <Input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="pr-11"
                  minLength={8}
                  maxLength={128}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-8 w-8"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="reg-confirm" className="text-sm font-medium">{t.auth.confirmPassword}</label>
              <div className="relative">
                <Input
                  id="reg-confirm"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="pr-11"
                  minLength={8}
                  maxLength={128}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-8 w-8"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t.common.loading : t.auth.register}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              {t.auth.hasAccount}{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">
                {t.auth.login}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Register;
