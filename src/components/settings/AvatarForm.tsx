"use client";
import { useRef, useState, type ChangeEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Button, buttonClasses } from "@/components/ui/Button";
import { useHydrated } from "@/components/ui/useHydrated";
import { useAction } from "@/components/orders/useAction";
import { useT } from "@/i18n/client";
import { AVATAR_SIZE_PX } from "@/lib/avatarPure";

/**
 * The centre square of the chosen photo, shrunk to AVATAR_SIZE_PX as WebP. When the browser cannot do it, the file goes
 * as it is: the server checks size and type either way.
 */
async function squared(file: File): Promise<Blob> {
  try {
    const image = await createImageBitmap(file);
    const side = Math.min(image.width, image.height);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = AVATAR_SIZE_PX;
    canvas.getContext("2d")!.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, AVATAR_SIZE_PX, AVATAR_SIZE_PX);
    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
    return out && out.type === "image/webp" ? out : file;
  } catch {
    return file;
  }
}

export function AvatarForm({ name, src }: { name: string; src: string | null }) {
  const { run, loading, error } = useAction();
  const t = useT();
  const ready = useHydrated();
  const input = useRef<HTMLInputElement>(null);
  const [done, setDone] = useState<string | null>(null);

  const choose = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDone(null);
    const form = new FormData();
    form.append("photo", await squared(file), "photo");
    await run("/api/account/avatar", { form }, () => setDone(t("Rasm saqlandi.")));
    if (input.current) input.current.value = ""; // the same file can be chosen again
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={name} src={src} size="xl" />
        <div className="flex flex-wrap gap-2">
          {/* The real file input is visually hidden; its label is the button, and focus shows on it. */}
          <label className={buttonClasses({ variant: "secondary", className: `cursor-pointer focus-within:outline focus-within:outline-2 ${loading || !ready ? "opacity-50" : ""}` })}>
            {t("Rasm tanlash")}
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={loading || !ready} onChange={choose} />
          </label>
          {src && (
            <Button type="button" variant="ghost" loading={loading} disabled={!ready} onClick={() => { setDone(null); void run("/api/account/avatar", { method: "DELETE" }, () => setDone(t("Rasm oʻchirildi."))); }}>
              {t("Rasmni oʻchirish")}
            </Button>
          )}
        </div>
      </div>
      <p className="text-sm text-ink-soft">{t("JPG, PNG yoki WebP, eng koʻpi 2 MB.")}</p>
      {error ? <Alert variant="error">{error}</Alert> : done ? <Alert variant="success">{done}</Alert> : null}
    </div>
  );
}
