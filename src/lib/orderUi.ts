import type { OrderStatus, ProfileStatus } from "@prisma/client";
import type { Locale } from "../i18n/config";
import { tk } from "../i18n/dictionary";
import { plural } from "../i18n/plural";

// Every sentence below is a translation key (src/i18n/ru/orders.ts, guide at the top of src/i18n/dictionary.ts): `tk` marks it
// and returns it unchanged, so a page puts it into the reader's language with `t(STATUS_LABEL[status])`.
// The admin pages show these tables as they are, which is Uzbek.

export const STATUS_LABEL: Record<OrderStatus, string> = {
  REQUESTED: tk("Soʻrov yuborildi"),
  AGREEMENT_PENDING: tk("Kelishuv kutilmoqda"),
  AWAITING_PAYMENT: tk("Toʻlov kutilmoqda"),
  IN_PROGRESS: tk("Jarayonda"),
  DELIVERED: tk("Topshirildi"),
  COMPLETED: tk("Yakunlandi"),
  CANCELLED: tk("Bekor qilindi"),
  DISPUTED: tk("Nizoda"),
};

export const STATUS_STYLE: Record<OrderStatus, string> = {
  REQUESTED: "bg-paper-deep text-ink",
  AGREEMENT_PENDING: "bg-saffron-tint text-ink",
  AWAITING_PAYMENT: "bg-saffron text-night",
  IN_PROGRESS: "bg-cobalt-tint text-cobalt-dark",
  DELIVERED: "bg-lilac-tint text-ink",
  COMPLETED: "bg-turquoise-tint text-turquoise-deep",
  CANCELLED: "bg-paper-deep text-ink-mute",
  DISPUTED: "bg-pomegranate-tint text-pomegranate-deep",
};

export const PROFILE_STATUS_LABEL: Record<ProfileStatus, string> = {
  DRAFT: tk("Qoralama"),
  PENDING_REVIEW: tk("Koʻrib chiqilmoqda"),
  APPROVED: tk("Tasdiqlangan"),
  SUSPENDED: tk("Toʻxtatilgan"),
};

export const PROFILE_STATUS_STYLE: Record<ProfileStatus, string> = {
  DRAFT: "bg-paper-deep text-ink",
  PENDING_REVIEW: "bg-saffron text-night",
  APPROVED: "bg-turquoise-tint text-turquoise-deep",
  SUSPENDED: "bg-pomegranate-tint text-pomegranate-deep",
};

export function nextAction(status: OrderStatus, role: "client" | "provider", hasReview = true): string {
  const client: Record<OrderStatus, string> = {
    REQUESTED: tk("Ijodkor shartlarni yuborishini kuting"),
    AGREEMENT_PENDING: tk("Shartlarni koʻrib chiqing va qabul qiling"),
    AWAITING_PAYMENT: tk("Ish boshlanishi uchun toʻlov qiling"),
    IN_PROGRESS: tk("Ijodkor videongiz ustida ishlamoqda"),
    DELIVERED: tk("Topshirilgan ishni koʻrib, qabul qiling"),
    COMPLETED: hasReview ? tk("Yakunlandi") : tk("Sharh qoldiring"),
    CANCELLED: tk("Bekor qilingan"),
    DISPUTED: tk("Administrator nizoni koʻrib chiqmoqda"),
  };
  const provider: Record<OrderStatus, string> = {
    REQUESTED: tk("Shartlaringizni yuboring"),
    AGREEMENT_PENDING: tk("Mijoz shartlarni qabul qilishini kuting"),
    AWAITING_PAYMENT: tk("Mijoz toʻlov qilishini kuting"),
    IN_PROGRESS: tk("Tayyor videoni yuklang"),
    DELIVERED: tk("Mijoz ishni qabul qilishini kuting"),
    COMPLETED: tk("Yakunlandi"),
    CANCELLED: tk("Bekor qilingan"),
    DISPUTED: tk("Administrator nizoni koʻrib chiqmoqda"),
  };
  return (role === "client" ? client : provider)[status];
}

/** "2 ta tuzatish" / «2 правки»: the number of revisions a package or an order includes, in the reader's language. */
export const revisionsText = (locale: Locale, n: number): string => plural(locale, n, "tuzatish", ["правка", "правки", "правок"]);
