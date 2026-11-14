import { Readable } from "stream";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { HttpError, handle } from "@/lib/http";
import { isS3, localStore, signedFileUrl } from "@/lib/storage";

type Ctx = { params: { id: string } };

/** Shows the receipt a client uploaded with "I paid". Admins only (the middleware and this check both enforce it). */
export const GET = handle(async (_req, { params }: Ctx) => {
  await requireRole("ADMIN");
  const payment = await prisma.payment.findFirst({
    where: { id: params.id, provider: "manual", receiptKey: { not: null } },
    select: { receiptKey: true, receiptName: true, receiptType: true },
  });
  if (!payment?.receiptKey || !payment.receiptType) throw new HttpError(404, "Chek topilmadi.");
  const name = (payment.receiptName ?? "chek").replace(/["\r\n]/g, "");
  // Images are shown in the page; a PDF is downloaded, so no PDF viewer ever runs inside the site's own origin.
  const download = payment.receiptType === "application/pdf";

  if (isS3()) return NextResponse.redirect(await signedFileUrl(payment.receiptKey, name, payment.receiptType, download));

  const total = await localStore.size(payment.receiptKey).catch(() => {
    throw new HttpError(404, "Chek topilmadi.");
  });
  const stream = Readable.toWeb(localStore.read(payment.receiptKey, { start: 0, end: total - 1 })) as unknown as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": payment.receiptType,
      "Content-Length": String(total),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
      // The file is shown, never run: no sniffing, and no script or embedded content may execute from it.
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    },
  });
});
