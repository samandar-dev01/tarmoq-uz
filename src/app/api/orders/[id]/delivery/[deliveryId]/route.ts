import { Readable } from "stream";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { HttpError, handle } from "@/lib/http";
import { isS3, localStore, signedFileUrl } from "@/lib/storage";

type Ctx = { params: { id: string; deliveryId: string } };

/** Streams a delivered video to the order's client, provider or an admin. Supports Range requests for seeking. */
export const GET = handle(async (req, { params }: Ctx) => {
  const user = await requireUser();
  const delivery = await prisma.delivery.findUnique({ where: { id: params.deliveryId }, include: { order: true } });
  if (!delivery || delivery.orderId !== params.id) throw new HttpError(404, "Fayl topilmadi.");
  const { order } = delivery;
  if (user.role !== "ADMIN" && order.clientId !== user.id && order.providerId !== user.id) throw new HttpError(404, "Fayl topilmadi.");

  const download = new URL(req.url).searchParams.get("download") === "1";
  if (isS3()) {
    return NextResponse.redirect(await signedFileUrl(delivery.fileKey, delivery.fileName, delivery.mimeType, download));
  }

  const total = await localStore.size(delivery.fileKey).catch(() => {
    throw new HttpError(404, "Fayl topilmadi.");
  });
  let start = 0;
  let end = total - 1;
  let status = 200;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    if (range[1]) {
      start = Number(range[1]);
      if (range[2]) end = Math.min(Number(range[2]), total - 1);
    } else {
      start = Math.max(total - Number(range[2]), 0); // suffix range: last N bytes
    }
    if (start > end || start >= total) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
    }
    status = 206;
  }

  const stream = Readable.toWeb(localStore.read(delivery.fileKey, { start, end })) as unknown as ReadableStream;
  const safeName = delivery.fileName.replace(/["\r\n]/g, "");
  const headers: Record<string, string> = {
    "Content-Type": delivery.mimeType,
    "Content-Length": String(end - start + 1),
    "Accept-Ranges": "bytes",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeName}"`,
    "Cache-Control": "private, no-store",
  };
  if (status === 206) headers["Content-Range"] = `bytes ${start}-${end}/${total}`;
  return new Response(stream, { status, headers });
});
