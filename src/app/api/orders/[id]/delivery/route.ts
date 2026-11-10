import { randomUUID } from "crypto";
import path from "path";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { HttpError, handle, ok } from "@/lib/http";
import { assertTransition } from "@/lib/orderMachine";
import { getParticipantOrder } from "@/lib/orders";
import { putFile, removeFile } from "@/lib/storage";
import { logAudit } from "@/lib/audit";
import { postOrderMessage } from "@/lib/messaging";

type Ctx = { params: { id: string } };
const ALLOWED_EXT = new Set([".mp4", ".mov", ".m4v", ".webm"]);
const CONTENT_TYPE: Record<string, string> = { ".mp4": "video/mp4", ".mov": "video/quicktime", ".m4v": "video/x-m4v", ".webm": "video/webm" };

/** Provider uploads the finished video; the order moves to DELIVERED. */
export const POST = handle(async (req, { params }: Ctx) => {
  const user = await requireRole("PROVIDER");
  const { order, actor } = await getParticipantOrder(params.id, user.id);
  if (actor !== "provider") throw new HttpError(403, "Only the provider can deliver work.");
  assertTransition(order.status, "DELIVERED", "provider");

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Choose a video file to upload.");
  const maxBytes = Number(process.env.MAX_UPLOAD_MB ?? 100) * 1024 * 1024;
  if (file.size === 0) throw new HttpError(400, "The file is empty.");
  if (file.size > maxBytes) throw new HttpError(413, `The file is too large (maximum ${Math.round(maxBytes / 1024 / 1024)} MB).`);
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) throw new HttpError(400, "Upload an MP4, MOV, M4V or WebM video.");
  if (file.type && !file.type.startsWith("video/") && file.type !== "application/octet-stream") {
    throw new HttpError(400, "That file does not look like a video.");
  }
  const note = String(form.get("note") ?? "").trim().slice(0, 500) || null;
  const contentType = CONTENT_TYPE[ext]!;
  const key = `deliveries/${order.id}/${randomUUID()}${ext}`;

  await putFile(key, Buffer.from(await file.arrayBuffer()), contentType);
  try {
    const delivery = await prisma.$transaction(async (tx) => {
      const moved = await tx.order.updateMany({ where: { id: order.id, status: "IN_PROGRESS" }, data: { status: "DELIVERED" } });
      if (moved.count !== 1) throw new HttpError(409, "The order changed. Reload the page.");
      const d = await tx.delivery.create({
        data: { orderId: order.id, fileKey: key, fileName: file.name.slice(0, 200), fileSize: file.size, mimeType: contentType, note },
      });
      await postOrderMessage(order.id, user.id, `I uploaded the delivery: ${file.name}${note ? `\n${note}` : ""}`, tx);
      return d;
    });
    await logAudit({ actorId: user.id, action: "DELIVERY_UPLOADED", entity: "Delivery", entityId: delivery.id, meta: { size: file.size } });
    return ok({ delivery: { id: delivery.id } }, 201);
  } catch (e) {
    await removeFile(key).catch(() => undefined);
    throw e;
  }
});
