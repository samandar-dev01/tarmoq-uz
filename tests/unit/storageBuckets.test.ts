import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bucketFor } from "@/lib/storage/bucketPure";

// A stand-in for the S3 library: it records what the app would have sent and to which bucket.
const sent = vi.hoisted(() => [] as { name: string; input: Record<string, unknown> }[]);

vi.mock("@aws-sdk/client-s3", () => {
  const command = (name: string) =>
    class {
      name = name;
      input: Record<string, unknown>;
      constructor(input: Record<string, unknown>) {
        this.input = input;
      }
    };
  return {
    S3Client: class {
      async send(c: { name: string; input: Record<string, unknown> }) {
        sent.push({ name: c.name, input: c.input });
      }
    },
    PutObjectCommand: command("put"),
    DeleteObjectCommand: command("delete"),
    GetObjectCommand: command("get"),
  };
});
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: async (_client: unknown, c: { name: string; input: Record<string, unknown> }) => {
    sent.push({ name: c.name, input: c.input });
    return "https://signed.example/file";
  },
}));

describe("bucketFor", () => {
  it("sends videos to S3_BUCKET", () => {
    expect(bucketFor("deliveries", { S3_BUCKET: "deliveries", S3_RECEIPTS_BUCKET: "receipts" })).toBe("deliveries");
  });

  it("sends receipts to their own bucket when one is set", () => {
    expect(bucketFor("receipts", { S3_BUCKET: "deliveries", S3_RECEIPTS_BUCKET: "receipts" })).toBe("receipts");
  });

  it("lets receipts share S3_BUCKET when no receipts bucket is set (single-bucket stores keep working)", () => {
    expect(bucketFor("receipts", { S3_BUCKET: "everything" })).toBe("everything");
    expect(bucketFor("receipts", { S3_BUCKET: "everything", S3_RECEIPTS_BUCKET: "  " })).toBe("everything");
  });

  it("returns null when nothing is configured, and never lets videos use the receipts bucket", () => {
    expect(bucketFor("deliveries", {})).toBeNull();
    expect(bucketFor("receipts", {})).toBeNull();
    expect(bucketFor("deliveries", { S3_RECEIPTS_BUCKET: "receipts" })).toBeNull();
  });
});

describe("S3 storage picks the bucket per area", () => {
  beforeEach(() => {
    sent.length = 0;
    vi.stubEnv("S3_ACCESS_KEY_ID", "test-key");
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "test-secret");
    vi.stubEnv("S3_BUCKET", "deliveries");
    vi.stubEnv("S3_RECEIPTS_BUCKET", "receipts");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("uploads a video to the deliveries bucket by default", async () => {
    const { put } = await import("@/lib/storage/s3");
    await put("orders/o1/video.mp4", Buffer.from("x"), "video/mp4");
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ name: "put", input: { Bucket: "deliveries", Key: "orders/o1/video.mp4", ContentType: "video/mp4" } });
  });

  it("uploads, signs and deletes a receipt in the receipts bucket", async () => {
    const { put, remove, signedUrl } = await import("@/lib/storage/s3");
    await put("receipts/o1/a.png", Buffer.from("x"), "image/png", "receipts");
    await signedUrl("receipts/o1/a.png", "chek.png", "image/png", false, "receipts");
    await remove("receipts/o1/a.png", "receipts");
    expect(sent.map((s) => [s.name, s.input.Bucket])).toEqual([
      ["put", "receipts"],
      ["get", "receipts"],
      ["delete", "receipts"],
    ]);
  });

  it("signs a delivery link in the deliveries bucket", async () => {
    const { signedUrl } = await import("@/lib/storage/s3");
    await signedUrl("orders/o1/video.mp4", "video.mp4", "video/mp4", true);
    expect(sent[0]).toMatchObject({ name: "get", input: { Bucket: "deliveries" } });
  });

  it("refuses to upload when no bucket is configured", async () => {
    vi.stubEnv("S3_BUCKET", "");
    vi.stubEnv("S3_RECEIPTS_BUCKET", "");
    const { put } = await import("@/lib/storage/s3");
    await expect(put("receipts/o1/a.png", Buffer.from("x"), "image/png", "receipts")).rejects.toThrow(/not configured/);
    expect(sent).toHaveLength(0);
  });
});
