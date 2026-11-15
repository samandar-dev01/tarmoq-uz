import { randomUUID } from "crypto";
import path from "path";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { readFormLimited } from "@/lib/body";
import { VIDEO_EXTENSIONS, videoMatchesExtension } from "@/lib/deliveryPure";
import { HttpError, handle, ok } from "@/lib/http";
import { assertTransition } from "@/lib/orderMachine";
import { getParticipantOrder } from "@/lib/orders";
import { putFile, removeFile } from "@/lib/storage";
import { logAudit } from "@/lib/audit";
import { postOrderMessage } from "@/lib/messaging";

type Ctx = { params: Promise<{ id: string }> };

/** Provider uploads the finished video; the order moves to DELIVERED. */
export const POST = handle(async (req, ctx: Ctx) => {
  const params = await ctx.params;
  const user = await requireRole("PROVIDER");
  const { order, actor } = await getParticipantOrder(params.id, user.id);
  if (actor !== "provider") throw new HttpError(403, "Ishni faqat ijodkor topshira oladi.");
  assertTransition(order.status, "DELIVERED", "provider");

  const maxBytes = Number(process.env.MAX_UPLOAD_MB ?? 100) * 1024 * 1024;
  const tooBig = `Fayl juda katta (eng koʻpi ${Math.round(maxBytes / 1024 / 1024)} MB).`;
  // SECURITY FIX (vibeguard #4): the body is counted while it is read, so an oversized or endless upload is
  // cut off instead of being loaded into memory first. 64 KB is the form's own framing around the file.
  const form = await readFormLimited(req, maxBytes + 64 * 1024, tooBig);
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Yuklash uchun video faylni tanlang.");
  if (file.size === 0) throw new HttpError(400, "Fayl boʻsh.");
  if (file.size > maxBytes) throw new HttpError(413, tooBig);
  const ext = path.extname(file.name).toLowerCase();
  if (!VIDEO_EXTENSIONS[ext]) throw new HttpError(400, "MP4, MOV, M4V yoki WebM formatidagi video yuklang.");
  if (file.type && !file.type.startsWith("video/") && file.type !== "application/octet-stream") {
    throw new HttpError(400, "Bu fayl videoga oʻxshamaydi.");
  }
  const note = String(form.get("note") ?? "").trim().slice(0, 500) || null;
  const bytes = Buffer.from(await file.arrayBuffer());
  // SECURITY FIX (vibeguard #10): the file's first bytes must agree with its extension (a text file renamed .mp4 is refused).
  if (!videoMatchesExtension(ext, bytes)) throw new HttpError(400, "Bu fayl videoga oʻxshamaydi.");
  const contentType = VIDEO_EXTENSIONS[ext]!.contentType;
  const key = `deliveries/${order.id}/${randomUUID()}${ext}`;

  await putFile(key, bytes, contentType);
  try {
    const delivery = await prisma.$transaction(async (tx) => {
      const moved = await tx.order.updateMany({ where: { id: order.id, status: "IN_PROGRESS" }, data: { status: "DELIVERED" } });
      if (moved.count !== 1) throw new HttpError(409, "Buyurtma oʻzgargan. Sahifani yangilang.");
      const d = await tx.delivery.create({
        data: { orderId: order.id, fileKey: key, fileName: file.name.slice(0, 200), fileSize: file.size, mimeType: contentType, note },
      });
      await postOrderMessage(order.id, user.id, `Ishni topshirdim: ${file.name}${note ? `\n${note}` : ""}`, tx);
      return d;
    });
    await logAudit({ actorId: user.id, action: "DELIVERY_UPLOADED", entity: "Delivery", entityId: delivery.id, meta: { size: file.size } });
    return ok({ delivery: { id: delivery.id } }, 201);
  } catch (e) {
    await removeFile(key).catch(() => undefined);
    throw e;
  }
});
