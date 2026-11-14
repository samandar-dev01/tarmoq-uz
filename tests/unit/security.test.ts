import { afterEach, describe, expect, it, vi } from "vitest";
import { readBodyLimited, readFormLimited } from "@/lib/body";
import { detectVideoFamily, videoMatchesExtension } from "@/lib/deliveryPure";
import { clientIp, readJson, sameOriginOk } from "@/lib/http";
import { decryptCard, encryptCard } from "@/lib/payoutSecret";
import { signToken, verifyToken } from "@/lib/token";

const post = (headers: Record<string, string> = {}, body: BodyInit | null = "{}") =>
  new Request("http://localhost/api/x", { method: "POST", headers, body });

/** A body that arrives in chunks with no Content-Length, like a chunked upload. */
function chunked(sizes: number[], headers: Record<string, string> = {}) {
  let i = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i >= sizes.length) return controller.close();
      controller.enqueue(new Uint8Array(sizes[i++]!).fill(97));
    },
  });
  return new Request("http://localhost/api/x", { method: "POST", headers, body: stream, duplex: "half" } as RequestInit);
}

afterEach(() => vi.unstubAllEnvs());

describe("clientIp (vibeguard #3)", () => {
  const req = (h: Record<string, string>) => new Request("http://localhost/", { headers: h });

  it("trusts Cloudflare's header over anything in X-Forwarded-For", () => {
    expect(clientIp(req({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "6.6.6.6, 198.51.100.2" }))).toBe("203.0.113.7");
  });

  it("without it, takes the LAST X-Forwarded-For entry, which the platform added, not the first, which the visitor wrote", () => {
    expect(clientIp(req({ "x-forwarded-for": "6.6.6.6, 7.7.7.7, 198.51.100.2" }))).toBe("198.51.100.2");
    // a visitor can not change their address by faking the header
    expect(clientIp(req({ "x-forwarded-for": "1.1.1.1, 198.51.100.2" }))).toBe(clientIp(req({ "x-forwarded-for": "2.2.2.2, 198.51.100.2" })));
  });

  it("ignores anything that is not an IP address, so the limiter can not be filled with made-up keys", () => {
    expect(clientIp(req({ "cf-connecting-ip": "not-an-ip", "x-forwarded-for": "<script>" }))).toBe("unknown");
    expect(clientIp(req({}))).toBe("unknown");
  });

  it("accepts IPv6", () => {
    expect(clientIp(req({ "cf-connecting-ip": "2001:db8::1" }))).toBe("2001:db8::1");
  });
});

describe("same-origin check (vibeguard #9)", () => {
  it("lets reads through whatever the origin", () => {
    expect(sameOriginOk(new Request("http://localhost/", { method: "GET", headers: { origin: "https://evil.example" } }))).toBe(true);
  });

  it("refuses a POST from another site, and one with an unreadable origin", () => {
    expect(sameOriginOk(post({ host: "tarmoq.example", origin: "https://evil.example" }))).toBe(false);
    expect(sameOriginOk(post({ host: "tarmoq.example", origin: "null" }))).toBe(false);
  });

  it("accepts a POST from this site, behind a proxy too, and one with no Origin (curl, tests)", () => {
    expect(sameOriginOk(post({ host: "tarmoq.example", origin: "https://tarmoq.example" }))).toBe(true);
    expect(sameOriginOk(post({ host: "internal:3000", "x-forwarded-host": "tarmoq.example", origin: "https://tarmoq.example" }))).toBe(true);
    expect(sameOriginOk(post({ host: "tarmoq.example" }))).toBe(true);
  });

  it("accepts APP_URL's host as this site", () => {
    vi.stubEnv("APP_URL", "https://www.tarmoq.example");
    expect(sameOriginOk(post({ host: "internal:3000", origin: "https://www.tarmoq.example" }))).toBe(true);
  });
});

describe("limited body reading (vibeguard #4, #5)", () => {
  it("returns a body that fits", async () => {
    const body = await readBodyLimited(post({}, "hello"), 10, "too big");
    expect(body.toString()).toBe("hello");
  });

  it("refuses at once when Content-Length already says it is too big", async () => {
    await expect(readBodyLimited(post({ "content-length": "5000" }, "x"), 100, "too big")).rejects.toMatchObject({ status: 413, message: "too big" });
  });

  it("stops a chunked upload with NO Content-Length once it passes the limit, without reading it all", async () => {
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new Uint8Array(1024)); // endless
      },
    });
    const req = new Request("http://localhost/", { method: "POST", body: stream, duplex: "half" } as RequestInit);
    expect(req.headers.get("content-length")).toBeNull();
    await expect(readBodyLimited(req, 10 * 1024, "too big")).rejects.toMatchObject({ status: 413 });
    expect(pulled).toBeLessThan(50); // it gave up after about 10 chunks, not after reading forever
  });

  it("counts a chunked body that is exactly at the limit as fine", async () => {
    const body = await readBodyLimited(chunked([512, 512]), 1024, "too big");
    expect(body.length).toBe(1024);
  });

  it("reads JSON, rejects broken JSON with 400 and an oversized body with 413", async () => {
    await expect(readJson(post({}, '{"a":1}'))).resolves.toEqual({ a: 1 });
    await expect(readJson(post({}, "{nope"))).rejects.toMatchObject({ status: 400 });
    await expect(readJson(post({}, ""))).rejects.toMatchObject({ status: 400 });
    await expect(readJson(chunked([300 * 1024]))).rejects.toMatchObject({ status: 413 });
  });

  it("parses a multipart upload within the limit, and cuts one that is over", async () => {
    const form = new FormData();
    form.set("file", new File([new Uint8Array(2000)], "a.bin"));
    form.set("note", "hi");
    // Encode the form to plain bytes first. (Handing a FormData straight to Request makes Node's fetch library stream it, and
    // cancelling that stream mid-way makes the library log a harmless but noisy "stream already closed" rejection.)
    const encoded = new Response(form);
    const contentType = encoded.headers.get("content-type")!;
    const bytes = new Uint8Array(await encoded.arrayBuffer());
    const asRequest = () => new Request("http://localhost/", { method: "POST", headers: { "content-type": contentType }, body: bytes });
    const parsed = await readFormLimited(asRequest(), 10_000, "too big");
    expect((parsed.get("file") as File).size).toBe(2000);
    expect(parsed.get("note")).toBe("hi");
    await expect(readFormLimited(asRequest(), 1000, "too big")).rejects.toMatchObject({ status: 413 });
  });

  it("answers 400 to a body that is not a form", async () => {
    await expect(readFormLimited(post({ "content-type": "multipart/form-data; boundary=x" }, "garbage"), 1000, "too big")).rejects.toMatchObject({ status: 400 });
    await expect(readFormLimited(post({}, "x"), 1000, "too big")).rejects.toMatchObject({ status: 400 });
  });
});

describe("delivery video type (vibeguard #10)", () => {
  const mp4 = Uint8Array.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32, 0, 0, 0, 0]);
  const mov = Uint8Array.from([0, 0, 0, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20, 0, 0, 0, 0]);
  const oldMov = Uint8Array.from([0, 0, 0, 0x08, 0x77, 0x69, 0x64, 0x65, 0, 0, 0, 0x20, 0x6d, 0x64, 0x61, 0x74]); // "wide" box first
  const webm = Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]);
  const text = new TextEncoder().encode("this is just a text file, not a video at all");

  it("recognises MP4/M4V/MOV by their box and WebM by its marker", () => {
    expect(detectVideoFamily(mp4)).toBe("mp4");
    expect(detectVideoFamily(mov)).toBe("mp4");
    expect(detectVideoFamily(oldMov)).toBe("mp4");
    expect(detectVideoFamily(webm)).toBe("webm");
  });

  it("refuses text, an image, a PDF, an HTML page and anything too short", () => {
    expect(detectVideoFamily(text)).toBeNull();
    expect(detectVideoFamily(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]))).toBeNull(); // JPEG
    expect(detectVideoFamily(new TextEncoder().encode("%PDF-1.7 ....."))).toBeNull();
    expect(detectVideoFamily(new TextEncoder().encode("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(detectVideoFamily(Uint8Array.from([0x1a, 0x45]))).toBeNull();
    expect(detectVideoFamily(new Uint8Array(0))).toBeNull();
  });

  it("needs the bytes to agree with the extension", () => {
    expect(videoMatchesExtension(".mp4", mp4)).toBe(true);
    expect(videoMatchesExtension(".MOV", mov)).toBe(true);
    expect(videoMatchesExtension(".webm", webm)).toBe(true);
    expect(videoMatchesExtension(".mp4", webm)).toBe(false); // a WebM called .mp4
    expect(videoMatchesExtension(".webm", mp4)).toBe(false);
    expect(videoMatchesExtension(".mp4", text)).toBe(false); // a text file called .mp4
    expect(videoMatchesExtension(".exe", mp4)).toBe(false); // not a video extension at all
  });
});

describe("session secret (vibeguard #11)", () => {
  const payload = { sub: "u1", role: "CLIENT" as const, name: "A" };

  it("accepts a long random secret", async () => {
    vi.stubEnv("AUTH_SECRET", "k3Jx9mQ2vLz8Pw4nTr6YbH1sDf0GcAeU5iVoXyNq7Ms=");
    expect((await verifyToken(await signToken(payload)))?.sub).toBe("u1");
  });

  it("refuses a secret under 32 characters, a missing one, and the placeholder from .env.example", async () => {
    vi.stubEnv("AUTH_SECRET", "only-twenty-five-chars-xx");
    await expect(signToken(payload)).rejects.toThrow(/AUTH_SECRET/);
    vi.stubEnv("AUTH_SECRET", "");
    await expect(signToken(payload)).rejects.toThrow(/AUTH_SECRET/);
    vi.stubEnv("AUTH_SECRET", "change-me-to-a-long-random-string");
    await expect(signToken(payload)).rejects.toThrow(/AUTH_SECRET/);
    vi.stubEnv("AUTH_SECRET", "Please_Change_Me_Please_Change_Me_Please_Change_Me");
    await expect(signToken(payload)).rejects.toThrow(/AUTH_SECRET/);
  });
});

describe("payout card key (vibeguard #11)", () => {
  const explicit = Buffer.alloc(32, 7).toString("base64");

  it("in production refuses to save a NEW card without its own key, even though AUTH_SECRET is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "k3Jx9mQ2vLz8Pw4nTr6YbH1sDf0GcAeU5iVoXyNq7Ms=");
    vi.stubEnv("PAYOUT_ENCRYPTION_KEY", "");
    expect(() => encryptCard("4242424242424242")).toThrow(/PAYOUT_ENCRYPTION_KEY/);
  });

  it("in production works with its own key, and the card round-trips", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PAYOUT_ENCRYPTION_KEY", explicit);
    expect(decryptCard(encryptCard("8600123412341234"))).toBe("8600123412341234");
  });

  it("still READS a card saved under the derived key before the rule existed", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AUTH_SECRET", "k3Jx9mQ2vLz8Pw4nTr6YbH1sDf0GcAeU5iVoXyNq7Ms=");
    vi.stubEnv("PAYOUT_ENCRYPTION_KEY", "");
    const old = encryptCard("8600123412341234");
    vi.stubEnv("NODE_ENV", "production");
    expect(decryptCard(old)).toBe("8600123412341234");
  });

  it("still derives a key in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_SECRET", "k3Jx9mQ2vLz8Pw4nTr6YbH1sDf0GcAeU5iVoXyNq7Ms=");
    vi.stubEnv("PAYOUT_ENCRYPTION_KEY", "");
    expect(decryptCard(encryptCard("8600123412341234"))).toBe("8600123412341234");
  });
});
