import React, { useState } from "react";
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
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (!gender) {
      toast({ title: "Error", description: t.auth.genderRequired, variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await register(email, password, name, phone, gender);
      toast({ title: t.auth.registerSuccess });
      navigate("/login");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.auth.name}</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Full Name" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.auth.phone}</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+251..." />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.auth.email}</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="email@example.com" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.auth.gender}</label>
              <Select value={gender} onValueChange={(value) => setGender(value as Gender)}>
                <SelectTrigger>
                  <SelectValue placeholder={t.auth.selectGender} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">{t.auth.genderMale}</SelectItem>
                  <SelectItem value="female">{t.auth.genderFemale}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.auth.password}</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.auth.confirmPassword}</label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="••••••••" />
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
