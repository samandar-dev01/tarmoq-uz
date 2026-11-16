// Sent with every response (P0-3).
//
// SECURITY FIX (vibeguard #8): in production the Content-Security-Policy now also says where scripts, styles, images,
// video and network calls may come from. Next.js writes small inline scripts into every page, so `script-src` has to
// allow 'unsafe-inline': it still stops a script from being loaded from, or sent data to, another site, but it does
// not stop an injected inline script. A nonce-based policy would. It used to wait for the framework upgrade, because
// Next 14.2's nonce handling had a known XSS advisory (GHSA-ffhc-5mcf-pf4q). The upgrade to Next 16 is now done; the
// nonce-based policy is a separate, later step and is NOT implemented yet.
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

const siteCsp = (isProd ? prodCsp : baseCsp).join("; ");

// The receipt viewer (src/app/api/admin/payments/[id]/receipt/route.ts) shows a file a client uploaded, so it adds a
// second, stricter policy of its own. Up to Next 14 the route's own header went out as a second
// Content-Security-Policy header. Since Next 16 a header that is already set here is no longer added to by a route
// handler, so the route's policy is listed here instead. Two policies joined by a comma mean exactly the same to a
// browser as two separate headers: both apply. Keep this text the same as in the route file.
const receiptCsp = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox";

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: siteCsp },
];

// Search engines must not list the private and account pages or the API. These page files are owned by other parts of
// the app, so the rule lives here as a response header: it covers every page under these prefixes at once. robots.txt
// (src/lib/seo.ts, PRIVATE_PATHS) asks crawlers to stay away as well; keep the two lists the same.
const noindexPrefixes = ["/api", "/admin", "/dashboard", "/orders", "/checkout", "/messages", "/settings", "/login", "/register", "/forbidden"];
const noindexHeaders = noindexPrefixes.map((prefix) => ({
  // ":path*" also matches the bare prefix itself (/admin as well as /admin/payments).
  source: `${prefix}/:path*`,
  headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
}));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // SECURITY FIX (vibeguard #2): the app uses plain <img> and never next/image, so the image optimizer endpoint
  // (/_next/image) has no job here. Several Next 14 advisories are about that endpoint, so it is switched off.
  images: { unoptimized: true },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/api/admin/payments/:id/receipt", headers: [{ key: "Content-Security-Policy", value: `${siteCsp}, ${receiptCsp}` }] },
      ...noindexHeaders,
    ];
  },
};
export default nextConfig;
