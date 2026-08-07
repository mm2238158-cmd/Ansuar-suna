import { useState } from "react";
import { CheckCircle, XCircle, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import PaymentStatusBadge from "@/components/PaymentStatusBadge";
import type { Month, Payment } from "@/lib/types";

interface PaymentReviewDialogProps {
  payment: Payment | null;
  memberName?: string;
  month?: Month;
  comment: string;
  onCommentChange: (value: string) => void;
  submitting: boolean;
  onAction: (status: "approved" | "rejected") => void;
  onClose: () => void;
}

const PaymentReviewDialog = ({
  payment,
  memberName,
  month,
  comment,
  onCommentChange,
  submitting,
  onAction,
  onClose,
}: PaymentReviewDialogProps) => {
  const { t } = useLanguage();
  const [zoomed, setZoomed] = useState(false);

  const close = () => {
    setZoomed(false);
    onClose();
  };

  return (
    <Dialog open={!!payment} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.admin.reviewPayment}</DialogTitle>
          <DialogDescription>{t.admin.viewScreenshot}</DialogDescription>
        </DialogHeader>

        {payment && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">{t.admin.memberName}</p>
                <p className="font-medium">{memberName || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t.member.month}</p>
                <p className="font-medium">{month?.name ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t.common.amount}</p>
                <p className="font-semibold text-primary">{payment.amount.toLocaleString()} ETB</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t.admin.paymentDate}</p>
                <p className="font-medium">{payment.submittedAt.toDate().toLocaleDateString()}</p>
              </div>
              {!!payment.penaltyAmount && (
                <div>
                  <p className="text-xs text-muted-foreground">{t.member.penalty}</p>
                  <p className="font-medium text-destructive">
                    {payment.penaltyAmount.toLocaleString()} ETB
                  </p>
                </div>
              )}
              <div className="col-span-2 flex items-center gap-2">
                <PaymentStatusBadge status={payment.status} />
                {payment.isLate && (
                  <span className="rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                    {t.member.overdue}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div
                className={`overflow-auto rounded-lg border bg-muted/30 ${zoomed ? "max-h-[70vh]" : ""}`}
              >
                <img
                  src={payment.screenshotUrl}
                  alt={`${t.admin.screenshot} — ${memberName ?? ""}`}
                  loading="lazy"
                  decoding="async"
                  className={
                    zoomed
                      ? "w-auto max-w-none bg-background"
                      : "max-h-[420px] w-full bg-background object-contain"
                  }
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setZoomed((z) => !z)}
                  aria-label={zoomed ? "Fit screenshot to width" : "Zoom screenshot to full size"}
                >
                  {zoomed ? <ZoomOut className="h-3.5 w-3.5" /> : <ZoomIn className="h-3.5 w-3.5" />}
                  {zoomed ? t.common.close : t.common.view}
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <a href={payment.screenshotUrl} target="_blank" rel="noreferrer">
                    {t.admin.viewScreenshot}
                  </a>
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="payment-review-comment" className="text-sm font-medium">
                {t.admin.addComment}
              </label>
              <Textarea
                id="payment-review-comment"
                placeholder={t.admin.commentPlaceholder}
                value={comment}
                onChange={(e) => onCommentChange(e.target.value)}
                rows={3}
                maxLength={500}
              />
            </div>

            {payment.status === "pending" ? (
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  className="flex-1 gap-1.5"
                  onClick={() => onAction("rejected")}
                  disabled={submitting}
                >
                  <XCircle className="h-4 w-4" aria-hidden="true" /> {t.common.reject}
                </Button>
                <Button
                  className="flex-1 gap-1.5 bg-success text-success-foreground hover:bg-success/90"
                  onClick={() => onAction("approved")}
                  disabled={submitting}
                >
                  <CheckCircle className="h-4 w-4" aria-hidden="true" /> {t.common.approve}
                </Button>
              </div>
            ) : (
              <Button variant="outline" className="w-full" onClick={close}>
                {t.common.close}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentReviewDialog;
