import { useEffect } from "react";
import { addDoc, collection, doc, getDoc, getDocs, limit, query, setDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AppUser, Month, Settings } from "@/lib/types";
import { getDeadlineDate, getMonthName, getPeriodKey, isCurrentPeriod, toTimestamp } from "@/lib/month-utils";

const DEFAULT_MONTHLY_AMOUNT = 500;
const DEFAULT_DEADLINE_DAY = 25;

export const useEnsureCurrentMonth = (appUser: AppUser | null) => {
  useEffect(() => {
    const ensure = async () => {
      if (!appUser || appUser.role !== "super_admin") return;

      const now = new Date();
      const periodKey = getPeriodKey(now);

      // Deterministic ID by periodKey avoids the race where two super admins
      // create two docs for the same month (fixes L2).
      const monthRef = doc(db, "months", periodKey);
      const existing = await getDoc(monthRef);
      if (existing.exists()) return;

      // Legacy: check for a month with matching periodKey field but a different doc ID.
      const existingByKey = await getDocs(
        query(collection(db, "months"), where("periodKey", "==", periodKey), limit(1))
      );
      if (!existingByKey.empty) return;

      const openMonths = await getDocs(query(collection(db, "months"), where("status", "==", "open")));
      const currentOpen = openMonths.docs.find((d) => isCurrentPeriod({ id: d.id, ...d.data() } as Month));
      if (currentOpen) return;

      const settingsSnap = await getDoc(doc(db, "settings", "global"));
      const settings = settingsSnap.exists()
        ? ({ id: settingsSnap.id, ...settingsSnap.data() } as Settings)
        : null;

      const monthlyAmount = settings?.monthlyAmount ?? DEFAULT_MONTHLY_AMOUNT;
      const paymentDeadlineDay = settings?.paymentDeadlineDay ?? DEFAULT_DEADLINE_DAY;
      const deadline = getDeadlineDate(now, paymentDeadlineDay);

      try {
        await setDoc(
          monthRef,
          {
            name: getMonthName(now),
            amount: monthlyAmount,
            deadline: toTimestamp(deadline),
            status: "open",
            createdBy: appUser.id,
            createdAt: toTimestamp(now),
            periodKey,
          },
          { merge: false }
        );
      } catch {
        // Another super admin created it in parallel; safe to ignore.
      }
    };

    ensure();
  }, [appUser]);
};
