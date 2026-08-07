import { z } from "zod";
import { isValidE164, normalizePhone } from "@/lib/phone-utils";

const phoneField = z
  .string()
  .trim()
  .min(1, "Phone number is required")
  .transform(normalizePhone)
  .refine(isValidE164, "Enter a valid phone number, e.g. +2519XXXXXXXX");

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80, "Name is too long"),
  phone: phoneField,
});

export const monthSchema = z.object({
  name: z.string().trim().min(3, "Month name is required").max(60, "Month name is too long"),
  amount: z.coerce.number().positive("Amount must be greater than 0").max(1_000_000, "Amount is too large"),
  deadline: z.string().min(1, "Deadline is required"),
});

export const announcementSchema = z.object({
  title: z.string().trim().min(3, "Title is required").max(120, "Title is too long"),
  message: z.string().trim().min(5, "Message is required").max(1000, "Message must be under 1000 characters"),
  target: z.enum(["all", "members", "admins"]),
});

export const settingsSchema = z.object({
  monthlyAmount: z.coerce.number().positive("Amount must be greater than 0").max(1_000_000),
  paymentDeadlineDay: z.coerce.number().int().min(1, "Day must be 1-31").max(31, "Day must be 1-31"),
  penaltyEnabled: z.boolean(),
  penaltyAmount: z.coerce.number().min(0, "Penalty cannot be negative").max(1_000_000),
});

export const paymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  monthId: z.string().min(1, "A month must be selected"),
});

export const adminCommentSchema = z
  .string()
  .trim()
  .max(500, "Comment must be under 500 characters");

/** Returns the first validation message, or null when valid. */
export const firstError = (result: z.SafeParseReturnType<unknown, unknown>) =>
  result.success ? null : result.error.errors[0]?.message ?? "Invalid input";
