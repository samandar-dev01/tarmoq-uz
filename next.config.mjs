// Sent with every response (P0-3).
//
// SECURITY FIX (vibeguard #8): in production the Content-Security-Policy now also says where scripts, styles, images,
// video and network calls may come from. Next.js writes small inline scripts into every page, so `script-src` has to
// allow 'unsafe-inline': it still stops a script from being loaded from, or sent data to, another site, but it does
// not stop an injected inline script. A nonce-based policy would, but Next 14.2's nonce handling has a known XSS
// advisory (GHSA-ffhc-5mcf-pf4q), so that waits for the framework upgrade.
//  - img-src / media-src allow https: because creators link portfolio images from their own hosts, and delivered
//    videos and receipts redirect to short-lived signed links on the storage host.
//  - connect-src 'self': every call the browser code makes goes to this site's own /api.
// `next dev` needs eval and a websocket for hot reload, so it keeps the small policy.
const isProd = process.env.NODE_ENV === "production";

const baseCsp = ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"];
const prodCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  ...baseCsp,
];

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: (isProd ? prodCsp : baseCsp).join("; ") },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // SECURITY FIX (vibeguard #2): the app uses plain <img> and never next/image, so the image optimizer endpoint
  // (/_next/image) has no job here. Several Next 14 advisories are about that endpoint, so it is switched off.
  images: { unoptimized: true },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
export default nextConfig;
