import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { HttpError, clientIp, handle, ok, readJson } from "@/lib/http";
import { assertTransition } from "@/lib/orderMachine";
import { buildTermsText, hashTerms } from "@/lib/agreements";
import { logAudit } from "@/lib/audit";
import { postOrderMessage } from "@/lib/messaging";

type Ctx = { params: { id: string } };

const schema = z.object({
  price: z.number({ required_error: "Narxni kiriting", invalid_type_error: "Narxni kiriting" }).int().min(20000, "Eng kam narx — 20 000 soʻm").max(50_000_000),
  deliveryDays: z.number({ required_error: "Kunlar sonini kiriting", invalid_type_error: "Kunlar sonini kiriting" }).int().min(1).max(60),
  revisions: z.number({ required_error: "Tuzatishlar sonini kiriting", invalid_type_error: "Tuzatishlar sonini kiriting" }).int().min(0).max(10),
  notes: z.string().trim().max(1000).optional(),
});

/** Provider sends (or re-sends) the terms. The provider's acceptance is recorded immediately. */
export const POST = handle(async (req, { params }: Ctx) => {
  const user = await requireRole("PROVIDER");
  const input = schema.parse(await readJson(req));

  const order = await prisma.order.findFirst({
    where: { id: params.id, providerId: user.id },
    include: { service: { select: { title: true } }, client: { select: { name: true } }, provider: { select: { name: true } } },
  });
  if (!order) throw new HttpError(404, "Buyurtma topilmadi.");
  if (order.status !== "REQUESTED" && order.status !== "AGREEMENT_PENDING") {
    throw new HttpError(409, "Bu buyurtma shartlarini endi oʻzgartirib boʻlmaydi.");
  }
  if (order.status === "REQUESTED") assertTransition("REQUESTED", "AGREEMENT_PENDING", "provider");

  const ip = clientIp(req);
  try {
    const agreement = await prisma.$transaction(async (tx) => {
      const latest = await tx.agreement.findFirst({ where: { orderId: order.id }, orderBy: { version: "desc" } });
      if (latest?.clientAcceptedAt) throw new HttpError(409, "Mijoz shartlarni allaqachon qabul qilgan.");
      const version = (latest?.version ?? 0) + 1;
      const termsText = buildTermsText({
        orderId: order.id, version, serviceTitle: order.service.title,
        clientName: order.client.name, providerName: order.provider.name,
        price: input.price, deliveryDays: input.deliveryDays, revisions: input.revisions,
        notes: input.notes,
      });
      const created = await tx.agreement.create({
        data: {
          orderId: order.id, version, termsText, price: input.price, deliveryDays: input.deliveryDays,
          termsHash: hashTerms({ orderId: order.id, version, price: input.price, deliveryDays: input.deliveryDays, revisions: input.revisions, termsText }),
          providerAcceptedAt: new Date(), providerAcceptedIp: ip,
        },
      });
      const moved = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: { status: "AGREEMENT_PENDING", agreedPrice: input.price, agreedDays: input.deliveryDays, revisionsAllowed: input.revisions },
      });
      if (moved.count !== 1) throw new HttpError(409, "Buyurtma oʻzgargan. Sahifani yangilang.");
      await postOrderMessage(order.id, user.id, `Shartlarni yubordim (${version}-versiya). Iltimos, buyurtma sahifasida koʻrib chiqib, qabul qiling.`, tx);
      return created;
    });
    await logAudit({ actorId: user.id, action: "TERMS_PROPOSED", entity: "Agreement", entityId: agreement.id, meta: { version: agreement.version, termsHash: agreement.termsHash } });
    return ok({ agreement: { id: agreement.id, version: agreement.version, termsHash: agreement.termsHash } }, 201);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new HttpError(409, "Shartlar hozirgina yangilandi. Sahifani yangilang.");
    }
    throw e;
  }
});
