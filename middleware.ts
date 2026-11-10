import { NextResponse, type NextRequest } from "next/server";
import { verifyToken, type AppRole } from "@/lib/token";

// First line of defense (edge). Every API handler and page ALSO re-checks the role against the database.
const RULES: { prefix: string; roles: AppRole[] }[] = [
  { prefix: "/api/admin", roles: ["ADMIN"] },
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/dashboard/client", roles: ["CLIENT"] },
  { prefix: "/dashboard/provider", roles: ["PROVIDER"] },
  { prefix: "/checkout", roles: ["CLIENT"] },
  { prefix: "/orders", roles: ["CLIENT", "PROVIDER", "ADMIN"] },
  { prefix: "/messages", roles: ["CLIENT", "PROVIDER", "ADMIN"] },
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const rule = RULES.find((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"));
  if (!rule) return NextResponse.next();

  const token = req.cookies.get("session")?.value;
  const session = token ? await verifyToken(token) : null;
  const isApi = pathname.startsWith("/api/");

  if (!session) {
    if (isApi) return NextResponse.json({ error: "Davom etish uchun tizimga kiring." }, { status: 401 });
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (!rule.roles.includes(session.role)) {
    if (isApi) return NextResponse.json({ error: "Buning uchun sizda ruxsat yoʻq." }, { status: 403 });
    return NextResponse.redirect(new URL("/forbidden", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/dashboard/:path*",
    "/checkout/:path*",
    "/orders/:path*",
    "/messages/:path*",
  ],
};
