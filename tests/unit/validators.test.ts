import { describe, it, expect } from "vitest";
import { loginSchema, registerSchema } from "@/lib/validators";

const valid = { name: "Test User", email: "Test@Example.com", password: "Passw0rd!", role: "CLIENT" };

describe("registerSchema", () => {
  it("accepts client and provider and lowercases the email", () => {
    expect(registerSchema.parse(valid).email).toBe("test@example.com");
    expect(registerSchema.parse({ ...valid, role: "PROVIDER" }).role).toBe("PROVIDER");
  });

  it("never allows self-registering as ADMIN", () => {
    expect(registerSchema.safeParse({ ...valid, role: "ADMIN" }).success).toBe(false);
  });

  it("rejects short passwords, bad emails and passwords over bcrypt's 72-byte limit", () => {
    expect(registerSchema.safeParse({ ...valid, password: "short" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, password: "x".repeat(73) }).success).toBe(false);
  });

  it("treats an empty phone as not provided", () => {
    expect(registerSchema.parse({ ...valid, phone: "" }).phone).toBeUndefined();
  });
});

describe("loginSchema", () => {
  it("requires both fields", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });
});
