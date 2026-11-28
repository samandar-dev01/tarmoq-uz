import { z } from "zod";
import { DOORS } from "./authRole";

/** What a phone number may look like (sign-up and the settings page both use it): an optional +, then 7 to 20 digits, spaces, brackets and dashes. */
export const PHONE_PATTERN = /^\+?[0-9 ()-]{7,20}$/;

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Ism-familiyangizni kiriting").max(80),
  email: z.string().trim().toLowerCase().email("Email manzilini toʻgʻri kiriting"),
  // bcrypt only uses the first 72 bytes, so cap there
  password: z.string().min(8, "Parol kamida 8 ta belgidan iborat boʻlsin").max(72),
  phone: z
    .string()
    .trim()
    .regex(PHONE_PATTERN, "Telefon raqamini toʻgʻri kiriting")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  // ADMIN can never be self-registered
  role: z.enum(["CLIENT", "PROVIDER"]),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email manzilini toʻgʻri kiriting"),
  password: z.string().min(1, "Parolni kiriting").max(200),
  // The authenticator app's code, for an account with two-step sign-in.
  code: z.string().max(10).optional(),
  // The sign-in door the form was on. Optional: API clients that send none are not checked against a door.
  role: z.enum(DOORS).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
