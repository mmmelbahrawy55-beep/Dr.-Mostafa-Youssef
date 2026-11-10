export type Lang = "ar" | "en";
export type Role = "customer" | "admin";

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
  monthly: { month: string; total: number }[];
  recentPayments: PaymentDTO[];
  totals: { approved: number; auto: number; rejected: number };
}

export interface AdminCustomer extends PublicUser {
  activeSubscriptions: number;
  spent: number;
  endsAt: string | null;
}

export interface CustomerDetail {
  customer: AdminCustomer;
  subscriptions: SubscriptionDTO[];
  payments: PaymentDTO[];
}

export interface AuthResponse {
  user: PublicUser;
}
