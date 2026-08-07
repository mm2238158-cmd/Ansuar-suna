import type { Month, Settings } from "@/lib/types";
import { resolveMonthWindow } from "@/lib/month-utils";

export interface PaymentDue {
  baseAmount: number;
  penaltyAmount: number;
  totalDue: number;
  isLate: boolean;
}

/**
 * Single source of truth for what a member owes.
 * A payment is late once the month deadline has passed; the configured penalty
 * is only added when penalties are enabled in system settings.
 */
export const computePaymentDue = (
  month: Month | null | undefined,
  settings: Settings | null | undefined,
  now: Date = new Date()
): PaymentDue => {
  const baseAmount = month?.amount ?? 0;
  if (!month) return { baseAmount, penaltyAmount: 0, totalDue: baseAmount, isLate: false };

  const { deadlineMs } = resolveMonthWindow(month);
  const isLate = now.getTime() > deadlineMs;
  const penaltyAmount = isLate && settings?.penaltyEnabled ? Math.max(0, settings.penaltyAmount ?? 0) : 0;

  return { baseAmount, penaltyAmount, totalDue: baseAmount + penaltyAmount, isLate };
};
