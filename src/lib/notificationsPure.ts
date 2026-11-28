import { tk } from "../i18n/dictionary";

// What a notification says. Stored as a kind and a name, written in the reader's language when shown.
export const NOTICE_TEXT = {
  order_new: tk("Yangi buyurtma: {subject}"),
  terms: tk("Yangi shartlar: {subject}"),
  accepted: tk("Shartlar qabul qilindi: {subject}"),
  payment: tk("Toʻlov tasdiqlandi: {subject}"),
  delivery: tk("Ish topshirildi: {subject}"),
  revision: tk("Tuzatish soʻraldi: {subject}"),
  completed: tk("Ish qabul qilindi: {subject}"),
  cancelled: tk("Buyurtma bekor qilindi: {subject}"),
  dispute: tk("Nizo ochildi: {subject}"),
  update: tk("Buyurtmada yangilik: {subject}"),
  review: tk("Yangi sharh: {subject}"),
  reply: tk("Sharhingizga javob: {subject}"),
  request: tk("Yangi soʻrov: {subject}"),
  answered: tk("Soʻrovingizga javob: {subject}"),
  offer: tk("Yangi taklif: {subject}"),
  offer_answer: tk("Taklifingizga javob: {subject}"),
} as const;

export type NoticeKind = keyof typeof NOTICE_TEXT;

export const noticeText = (kind: string): string => NOTICE_TEXT[kind as NoticeKind] ?? NOTICE_TEXT.update;

/** The number on a badge: nothing for none, "9+" past nine. */
export const badge = (n: number): string => (n <= 0 ? "" : n > 9 ? "9+" : String(n));
