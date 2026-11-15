import type { MetadataRoute } from "next";
import { buildRobots } from "@/lib/seo";
import { siteUrl } from "@/lib/site";

// Built per request, so the address comes from APP_URL on the running server and not from the build machine.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return buildRobots(siteUrl());
}
