// Where a person's photo is shown from. Safe for the browser and the server (no imports).
//
// A photo is public, like a name: it is shown to anyone who can see the person. It is served by GET /api/avatars/<userId>
// (src/app/api/avatars/[userId]/route.ts) with a one-year cache, so the address carries the time the photo last changed
// (`?v=`): a new photo is a new address, and the old one can stay cached for ever.

/**
 * The address of a person's photo, or null when they have none. Pass anything that has the person's `id` and
 * `avatarUpdatedAt` (a Date, or the ISO string it became on the way to the browser): `avatarUpdatedAt` is set exactly when
 * a photo exists. Use it with the `src` of `Avatar` (src/components/ui/Avatar.tsx); a page that lists people only has to
 * add `avatarUpdatedAt` to the person's `select`.
 */
export function avatarUrl(user: { id: string; avatarUpdatedAt?: Date | string | null }): string | null {
  if (!user.avatarUpdatedAt) return null;
  const stamp = new Date(user.avatarUpdatedAt).getTime();
  if (!Number.isFinite(stamp)) return null;
  return `/api/avatars/${encodeURIComponent(user.id)}?v=${stamp}`;
}
