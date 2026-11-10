import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Ism-familiyangizni kiriting").max(80),
  email: z.string().trim().toLowerCase().email("Email manzilini toʻgʻri kiriting"),
  // bcrypt only uses the first 72 bytes, so cap there
  password: z.string().min(8, "Parol kamida 8 ta belgidan iborat boʻlsin").max(72),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, "Telefon raqamini toʻgʻri kiriting")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  // ADMIN can never be self-registered
  role: z.enum(["CLIENT", "PROVIDER"]),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email manzilini toʻgʻri kiriting"),
  password: z.string().min(1, "Parolni kiriting").max(200),
});

export type RegisterInput = z.infer<typeof registerSchema>;
