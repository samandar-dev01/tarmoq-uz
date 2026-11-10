import type { OrderStatus, ProfileStatus } from "@prisma/client";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  REQUESTED: "Soʻrov yuborildi",
  AGREEMENT_PENDING: "Kelishuv kutilmoqda",
  AWAITING_PAYMENT: "Toʻlov kutilmoqda",
  IN_PROGRESS: "Jarayonda",
  DELIVERED: "Topshirildi",
  COMPLETED: "Yakunlandi",
  CANCELLED: "Bekor qilindi",
  DISPUTED: "Nizoda",
};

export const STATUS_STYLE: Record<OrderStatus, string> = {
  REQUESTED: "bg-paper-deep text-ink",
  AGREEMENT_PENDING: "bg-saffron-tint text-ink",
  AWAITING_PAYMENT: "bg-saffron text-ink",
  IN_PROGRESS: "bg-cobalt-tint text-cobalt-dark",
  DELIVERED: "bg-lilac-tint text-ink",
  COMPLETED: "bg-turquoise-tint text-turquoise-deep",
  CANCELLED: "bg-paper-deep text-ink-mute",
  DISPUTED: "bg-pomegranate-tint text-pomegranate-deep",
};

export const PROFILE_STATUS_LABEL: Record<ProfileStatus, string> = {
  DRAFT: "Qoralama",
  PENDING_REVIEW: "Koʻrib chiqilmoqda",
  APPROVED: "Tasdiqlangan",
  SUSPENDED: "Toʻxtatilgan",
};

export const PROFILE_STATUS_STYLE: Record<ProfileStatus, string> = {
  DRAFT: "bg-paper-deep text-ink",
  PENDING_REVIEW: "bg-saffron text-ink",
  APPROVED: "bg-turquoise-tint text-turquoise-deep",
  SUSPENDED: "bg-pomegranate-tint text-pomegranate-deep",
};

export function nextAction(status: OrderStatus, role: "client" | "provider", hasReview = true): string {
  const client: Record<OrderStatus, string> = {
    REQUESTED: "Ijodkor shartlarni yuborishini kuting",
    AGREEMENT_PENDING: "Shartlarni koʻrib chiqing va qabul qiling",
    AWAITING_PAYMENT: "Ish boshlanishi uchun toʻlov qiling",
    IN_PROGRESS: "Ijodkor videongiz ustida ishlamoqda",
    DELIVERED: "Topshirilgan ishni koʻrib, qabul qiling",
    COMPLETED: hasReview ? "Yakunlandi" : "Sharh qoldiring",
    CANCELLED: "Bekor qilingan",
    DISPUTED: "Administrator nizoni koʻrib chiqmoqda",
  };
  const provider: Record<OrderStatus, string> = {
    REQUESTED: "Shartlaringizni yuboring",
    AGREEMENT_PENDING: "Mijoz shartlarni qabul qilishini kuting",
    AWAITING_PAYMENT: "Mijoz toʻlov qilishini kuting",
    IN_PROGRESS: "Tayyor videoni yuklang",
    DELIVERED: "Mijoz ishni qabul qilishini kuting",
    COMPLETED: "Yakunlandi, toʻlov oʻtkazildi",
    CANCELLED: "Bekor qilingan",
    DISPUTED: "Administrator nizoni koʻrib chiqmoqda",
  };
  return (role === "client" ? client : provider)[status];
}
