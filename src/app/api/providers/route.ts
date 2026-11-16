import { canBrowseCreators, getCurrentUser } from "@/lib/auth";
import { HttpError, handle, ok } from "@/lib/http";
import { parseSearch, searchProviders } from "@/lib/providers";

export const GET = handle(async (req) => {
  if (!canBrowseCreators(await getCurrentUser())) throw new HttpError(403, "Buning uchun sizda ruxsat yoʻq.");
  const params = Object.fromEntries(new URL(req.url).searchParams);
  return ok(await searchProviders(parseSearch(params)));
});
