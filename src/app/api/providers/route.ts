import { handle, ok } from "@/lib/http";
import { parseSearch, searchProviders } from "@/lib/providers";

export const GET = handle(async (req) => {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  return ok(await searchProviders(parseSearch(params)));
});
