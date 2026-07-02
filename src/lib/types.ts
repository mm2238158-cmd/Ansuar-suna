import { Timestamp } from "firebase/firestore";

export type UserRole = "member" | "admin" | "super_admin";
export type UserStatus = "pending" | "active" | "inactive";
export type Gender = "male" | "female";
export type PaymentStatus = "pending" | "approved" | "rejected" | "late";
export type MonthStatus = "open" | "closed";
export type AnnouncementTarget = "all" | "members" | "admins";
export type Language = "en" | "am" | "om";

export interface AppUser {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  assignedAdminId?: string;
  isActive: boolean;
  joinedAt: Timestamp;
  language?: Language;
  isFounder?: boolean;
  gender?: Gender;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  activatedAt?: Timestamp;
}

export interface Month {
  id: string;
  name: string;
  amount: number;
  deadline: Timestamp;
  status: MonthStatus;
  createdBy: string;
  createdAt: Timestamp;
  periodKey?: string;
}

export interface Payment {
  id: string;
  userId: string;
  monthId: string;
  amount: number;
  status: PaymentStatus;
  screenshotUrl: string;
  submittedAt: Timestamp;
  verifiedBy?: string;
  verifiedAt?: Timestamp;
  adminComment?: string;
  isLate: boolean;
  penaltyAmount?: number;
}

export interface Assignment {
  id: string;
  adminId: string;
  memberId: string;
  assignedAt: Timestamp;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: Timestamp;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  target: AnnouncementTarget;
  createdBy: string;
  createdAt: Timestamp;
}

export interface Settings {
  id: string;
  monthlyAmount: number;
  paymentDeadlineDay: number;
  penaltyEnabled: boolean;
  penaltyAmount: number;
}
