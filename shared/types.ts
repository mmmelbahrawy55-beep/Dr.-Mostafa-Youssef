export type Lang = "ar" | "en";
export type Role = "customer" | "admin" | "staff";

export interface PublicUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: Role;
  blocked: boolean;
  createdAt: string;
}

export interface SubscriptionDTO {
  id: number;
  userId: number;
  userName?: string;
  userEmail?: string;
  programId: string;
  programName: string;
  paymentId: number | null;
  startsAt: string;
  endsAt: string;
  status: "active" | "expired" | "cancelled";
  createdAt: string;
}

export interface PaymentDTO {
  id: number;
  userId: number;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  programId: string;
  programName: string;
  amount: number;
  days: number;
  method: "vodafone" | "instapay";
  sender: string;
  reference: string;
  status: "auto_approved" | "pending" | "approved" | "rejected";
  risk: string[];
  note: string;
  coupon?: string | null;
  discount?: number;
  createdAt: string;
  reviewedAt: string | null;
  hasScreenshot: boolean;
  screenshotWidth?: number | null;
  screenshotHeight?: number | null;
}

export type Collection =
  | "programs"
  | "services"
  | "testimonials"
  | "results"
  | "posts"
  | "faqs"
  | "credentials";

export interface ContentItem {
  id: string;
  collection: Collection;
  sort: number;
  active: boolean;
  common: Record<string, unknown>;
  ar: Record<string, unknown>;
  en: Record<string, unknown>;
}

export interface MessageDTO {
  id: number;
  name: string;
  phone: string;
  email: string;
  goal: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface MediaItem {
  id: number;
  url: string;
  filename: string;
  mime: string;
  size: number;
  createdAt: string;
  width?: number | null;
  height?: number | null;
  uploadedBy?: number | null;
  uploadedByName?: string;
}

export type AssetKind = "image" | "video" | "pdf" | "file";
export type AssetVisibility = "public" | "subscribers";

/** One file or video link the doctor attached to a plan or to a single client. */
export interface SiteAsset {
  id: number;
  kind: AssetKind;
  url: string;
  filename: string;
  mime: string;
  size: number;
  title: string;
  note: string;
  visibility: AssetVisibility;
  sort: number;
  /** True when a visitor can see the card but not the file itself. */
  locked?: boolean;
  createdAt: string;
}

/** Measurements and targets the doctor sets for one client. */
export interface ClientPlanDTO {
  heightCm: number | null;
  startWeight: number | null;
  currentWeight: number | null;
  targetWeight: number | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  goal: string;
  medicalNotes: string;
  notes: string;
  updatedAt: string | null;
}

/** One weekly follow-up the client submits (weight, notes, optional photo). */
export interface CheckinDTO {
  id: number;
  userId: number;
  userName?: string;
  weight: number | null;
  note: string;
  doctorNote: string;
  reviewed: boolean;
  hasPhoto: boolean;
  createdAt: string;
}

export interface CouponDTO {
  id: number;
  code: string;
  kind: "percent" | "amount";
  value: number;
  maxUses: number;
  used: number;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
}

export interface AppNotificationDTO {
  id: number;
  userId: number;
  userName?: string;
  kind: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface ReportSummary {
  revenue: number;
  expected: number;
  month: number;
  lastMonth: number;
  byPlan: { name: string; total: number; count: number }[];
  byMethod: { method: string; total: number; count: number }[];
  monthly: { month: string; total: number }[];
  activeSubscriptions: number;
  expiringSoon: number;
  couponsUsed: number;
  topCustomers: { name: string; email: string; total: number }[];
}

/**
 * Chat attachments (doctor + client, images and videos) upload in chunks so a
 * file of any size clears both the 4.5 MB serverless body cap and Upstash's
 * 10 MB per-value cap: every request carries at most one chunk, and each chunk
 * is stored as its own Redis value.
 */
export const CHAT_CHUNK_BYTES = 3 * 1024 * 1024;
/** Hard ceiling for one chat attachment (sum of all chunks). */
export const CHAT_MAX_FILE_BYTES = 64 * 1024 * 1024;

export interface CoachMessageDTO {
  id: number;
  userId: number;
  sender: "doctor" | "customer";
  body: string;
  mediaUrl: string | null;
  mediaKind: "image" | "video" | null;
  videoUrl: string | null;
  createdAt: string;
}

export interface CoachConversation {
  userId: number;
  name: string;
  email: string;
  phone: string;
  activeSubscriptions: number;
  endsAt: string | null;
  isTrial: boolean;
  unread: number;
  lastMessage: string;
  lastMessageAt: string | null;
}

export interface SiteSettings {
  contact: {
    phone: string;
    whatsapp: string;
    email: string;
    addressAr: string;
    addressEn: string;
    hoursAr: string;
    hoursEn: string;
    mapEmbed: string;
    instagram: string;
    facebook: string;
    youtube: string;
    tiktok: string;
  };
  payments: {
    vodafone: string;
    instapay: string;
    accountName: string;
    bankNoteAr: string;
    bankNoteEn: string;
    instructionsAr: string;
    instructionsEn: string;
    autoApprove: boolean;
  };
  hero: { image: string };
  announcement: { ar: string; en: string; enabled: boolean };
}

export type CopyOverrides = { ar: Record<string, string>; en: Record<string, string> };

export interface SiteData {
  settings: SiteSettings;
  programs: ContentItem[];
  services: ContentItem[];
  testimonials: ContentItem[];
  results: ContentItem[];
  posts: ContentItem[];
  faqs: ContentItem[];
  credentials?: ContentItem[];
  copy?: CopyOverrides;
}

export interface Overview {
  revenue: number;
  todayRevenue: number;
  monthRevenue: number;
  pendingCount: number;
  pendingAmount: number;
  customers: number;
  newCustomers: number;
  activeSubscriptions: number;
  expiringSoon: number;
  unreadMessages: number;
  coachUnread: number;
  monthly: { month: string; total: number }[];
  recentPayments: PaymentDTO[];
  totals: { approved: number; auto: number; rejected: number };
}

export interface AdminCustomer extends PublicUser {
  activeSubscriptions: number;
  spent: number;
  endsAt: string | null;
}

export interface CustomerSessionDTO {
  createdAt: string;
  lastSeen: string;
  ip: string;
  userAgent: string;
}

export interface CustomerActivityDTO {
  id: string;
  kind: "account" | "subscription" | "payment" | "chat" | "message" | "session";
  title: string;
  detail: string;
  at: string;
}

export interface CustomerProgramInfo {
  name: string;
  summary: string;
  weeks: number;
  workouts: number;
  meals: number;
  checkInEveryDays: number;
  image: string;
  startsAt: string;
  endsAt: string;
  daysLeft: number;
  totalDays: number;
  progress: number;
}

export interface CustomerStats {
  activeSubscriptions: number;
  totalSubscriptions: number;
  totalSpent: number;
  pendingPayments: number;
  unreadCoach: number;
  contactMessages: number;
  sessions: number;
  lastSeen: string | null;
}

export interface CustomerDetail {
  customer: AdminCustomer;
  subscriptions: SubscriptionDTO[];
  payments: PaymentDTO[];
  currentProgram: CustomerProgramInfo | null;
  coachMessages: CoachMessageDTO[];
  contactMessages: MessageDTO[];
  sessions: CustomerSessionDTO[];
  activity: CustomerActivityDTO[];
  stats: CustomerStats;
  files: SiteAsset[];
  plan: ClientPlanDTO | null;
  checkins: CheckinDTO[];
}

export interface AuthResponse {
  user: PublicUser;
}
