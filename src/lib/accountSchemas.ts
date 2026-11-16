import { z } from "zod";
import { PHONE_PATTERN } from "./validators";

// What the settings page may send. The rules for the name, phone, email and password are the ones sign-up uses
// (src/lib/validators.ts); the extra messages here are for the cases sign-up leaves to the browser's own limits.
// Nothing here ever takes a role, an active flag or an id from the client.

const name = z.string().trim().min(2, "Ism-familiyangizni kiriting").max(80, "Ism 80 ta belgidan oshmasin");
const email = z.string().trim().toLowerCase().email("Email manzilini toʻgʻri kiriting");
// bcrypt only uses the first 72 bytes, so cap there (as sign-up does)
const newPassword = z.string().min(8, "Parol kamida 8 ta belgidan iborat boʻlsin").max(72, "Parol 72 ta belgidan oshmasin");
const currentPassword = z.string().min(1, "Joriy parolni kiriting").max(200);

/** The profile form: a name, and a phone that may be left empty (which removes it). */
export const profileSchema = z.object({
  name,
  phone: z.string().trim().regex(PHONE_PATTERN, "Telefon raqamini toʻgʻri kiriting").or(z.literal("")).optional(),
});

export const passwordSchema = z
  .object({ currentPassword, newPassword, confirmPassword: z.string().max(200) })
  .refine((v) => v.newPassword === v.confirmPassword, { message: "Yangi parollar bir xil emas", path: ["confirmPassword"] })
  .refine((v) => v.newPassword !== v.currentPassword, { message: "Yangi parol joriy paroldan farq qilsin", path: ["newPassword"] });

export const emailChangeSchema = z.object({ email, currentPassword });

export type ProfileInput = z.infer<typeof profileSchema>;
