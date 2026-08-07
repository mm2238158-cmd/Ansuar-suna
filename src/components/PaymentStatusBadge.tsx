import { useLanguage } from "@/contexts/LanguageContext";

const colors: Record<string, string> = {
  approved: "bg-success/10 text-success",
  pending: "bg-warning/10 text-warning",
  rejected: "bg-destructive/10 text-destructive",
  late: "bg-destructive/10 text-destructive",
};

const PaymentStatusBadge = ({ status }: { status: string }) => {
  const { t } = useLanguage();
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium ${colors[status] || ""}`}>
      {t.status[status as keyof typeof t.status] ?? status}
    </span>
  );
};

export default PaymentStatusBadge;
