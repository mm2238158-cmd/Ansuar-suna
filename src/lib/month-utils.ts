import { Timestamp } from "firebase/firestore";
import type { Month } from "@/lib/types";

export const getPeriodKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

export const getMonthName = (date: Date) =>
  date.toLocaleString("en-US", { month: "long", year: "numeric" });

export const getMonthStart = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);

export const getClampedDay = (date: Date, requestedDay: number) => {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return Math.min(Math.max(1, requestedDay), lastDay);
};

export const getDeadlineDate = (date: Date, requestedDay: number) => {
  const day = getClampedDay(date, requestedDay);
  return new Date(date.getFullYear(), date.getMonth(), day, 23, 59, 59, 999);
};

export const resolveMonthWindow = (month: Month) => {
  const deadlineDate = month.deadline.toDate();
  const startDate = getMonthStart(deadlineDate);
  const deadlineEndDate = new Date(
    deadlineDate.getFullYear(),
    deadlineDate.getMonth(),
    deadlineDate.getDate(),
    23,
    59,
    59,
    999
  );
  return {
    startMs: startDate.getTime(),
    deadlineMs: deadlineEndDate.getTime(),
  };
};

export const isCurrentPeriod = (month: Month, now = new Date()) => {
  const key = month.periodKey ?? getPeriodKey(month.deadline.toDate());
  return key === getPeriodKey(now);
};

export const toTimestamp = (date: Date) => Timestamp.fromDate(date);
