import { describe, expect, it } from "vitest";
import { DEFAULT_CONNECTION_LIMIT, withConnectionLimit } from "@/lib/dbUrl";

describe("withConnectionLimit", () => {
  it("adds a limit to an address that has no query string", () => {
    expect(withConnectionLimit("postgresql://u:p@host:5432/db")).toBe(`postgresql://u:p@host:5432/db?connection_limit=${DEFAULT_CONNECTION_LIMIT}`);
  });

  it("adds it after the settings that are already there", () => {
    expect(withConnectionLimit("postgresql://u:p@host:5432/db?sslmode=require")).toBe(
      `postgresql://u:p@host:5432/db?sslmode=require&connection_limit=${DEFAULT_CONNECTION_LIMIT}`,
    );
  });

  it("leaves an address alone that already names a limit (the owner's choice wins), wherever it stands", () => {
    const first = "postgresql://u:p@host:5432/db?connection_limit=3";
    const later = "postgresql://u:p@host:5432/db?pgbouncer=true&connection_limit=9";
    expect(withConnectionLimit(first)).toBe(first);
    expect(withConnectionLimit(later)).toBe(later);
  });

  it("never rewrites the password: an escaped character comes out exactly as it went in", () => {
    const url = "postgresql://postgres.abc:p%40ss%2Fw%3Ard@aws-0.pooler.supabase.com:5432/postgres";
    expect(withConnectionLimit(url).startsWith(url)).toBe(true);
  });

  it("takes another limit when asked", () => {
    expect(withConnectionLimit("postgresql://h/db", 2)).toBe("postgresql://h/db?connection_limit=2");
  });
});
