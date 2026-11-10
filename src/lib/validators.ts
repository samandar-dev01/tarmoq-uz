import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  // bcrypt only uses the first 72 bytes, so cap there
  password: z.string().min(8, "Use at least 8 characters").max(72),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  // ADMIN can never be self-registered
  role: z.enum(["CLIENT", "PROVIDER"]),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password").max(200),
});

export type RegisterInput = z.infer<typeof registerSchema>;
