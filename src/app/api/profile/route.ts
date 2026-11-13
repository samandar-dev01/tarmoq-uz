import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { HttpError, handle, ok, readJson } from "@/lib/http";
import { CITIES, LANGUAGES } from "@/lib/constants";
import { slugify } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { notifyProfileSubmitted } from "@/lib/notify";

const httpsUrl = z
  .string()
  .trim()
  .url("Havolani toʻgʻri kiriting")
  .refine((u) => u.startsWith("https://"), "Havola https:// bilan boshlanishi kerak");
const optionalUrl = z.preprocess((v) => (v === "" || v == null ? undefined : v), httpsUrl.optional());

const step1 = z.object({
  headline: z.string().trim().min(10, "Kamida 10 ta belgi yozing").max(100, "100 ta belgidan oshmasin"),
  bio: z.string().trim().min(40, "Mijozlarga oʻzingiz haqingizda koʻproq yozing (kamida 40 ta belgi)").max(2000),
  categoryId: z.string().min(1, "Yoʻnalishni tanlang"),
});
const step2 = z.object({
  city: z.enum(CITIES, { errorMap: () => ({ message: "Shaharni tanlang" }) }),
  district: z.string().trim().max(60).optional(),
  equipment: z.string().trim().max(200).optional(),
  languages: z.array(z.enum(LANGUAGES)).min(1, "Kamida bitta tilni tanlang"),
});
const step3 = z.object({
  services: z
    .array(
      z.object({
        id: z.string().optional(),
        title: z.string().trim().min(3, "Nomini kiriting").max(80),
        description: z.string().trim().min(10, "Nimalar kirishini yozing (kamida 10 ta belgi)").max(500),
        price: z.number({ required_error: "Narxni kiriting", invalid_type_error: "Narxni kiriting" }).int().min(20000, "Eng kam narx — 20 000 soʻm").max(50_000_000),
        deliveryDays: z.number({ required_error: "Kunlar sonini kiriting", invalid_type_error: "Kunlar sonini kiriting" }).int().min(1, "Kamida 1 kun").max(60),
        revisions: z.number({ required_error: "Tuzatishlar sonini kiriting", invalid_type_error: "Tuzatishlar sonini kiriting" }).int().min(0).max(10),
      }),
    )
    .min(1, "Kamida bitta paket qoʻshing")
    .max(6, "Koʻpi bilan 6 ta paket qoʻshishingiz mumkin"),
});
const step4 = z.object({
  items: z
    .array(
      z
        .object({ title: z.string().trim().min(2, "Nomini kiriting").max(80), videoUrl: optionalUrl, imageUrl: optionalUrl })
        .refine((i) => i.videoUrl || i.imageUrl, { message: "Video yoki rasm havolasini qoʻshing", path: ["videoUrl"] }),
    )
    .max(8, "Koʻpi bilan 8 ta ish qoʻshishingiz mumkin"),
});
const body = z.object({ step: z.number().int().min(1).max(5), data: z.unknown().optional() });

async function uniqueSlug(name: string) {
  const base = slugify(name);
  for (let i = 0; i < 5; i++) {
    const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    if (!(await prisma.providerProfile.findUnique({ where: { slug }, select: { id: true } }))) return slug;
  }
  throw new HttpError(500, "Profil manzilini yaratib boʻlmadi. Qayta urinib koʻring.");
}

async function summary(userId: string) {
  const p = await prisma.providerProfile.findUniqueOrThrow({
    where: { userId },
    include: {
      services: { where: { isActive: true }, orderBy: { id: "asc" } }, // ids are time-ordered; Service has no createdAt column
      portfolio: { orderBy: { sortOrder: "asc" } },
    },
  });
  return {
    slug: p.slug,
    status: p.status,
    wizardStep: p.wizardStep,
    services: p.services.map((s) => ({
      id: s.id, title: s.title, description: s.description, price: s.price, deliveryDays: s.deliveryDays, revisions: s.revisions,
    })),
    portfolio: p.portfolio.map((i) => ({ title: i.title, videoUrl: i.videoUrl, imageUrl: i.imageUrl })),
  };
}

export const PUT = handle(async (req) => {
  const user = await requireRole("PROVIDER");
  const { step, data } = body.parse(await readJson(req));

  const profile = await prisma.providerProfile.findUnique({ where: { userId: user.id } });
  if (profile?.status === "SUSPENDED") throw new HttpError(403, "Profilingiz toʻxtatilgan. Qoʻllab-quvvatlash xizmatiga murojaat qiling.");
  if (step > 1 && !profile) throw new HttpError(409, "Avval 1-qadamni bajaring.");
  if (profile && step > profile.wizardStep) throw new HttpError(409, "Avval oldingi qadamni bajaring.");
  const advance = (current: number) => Math.min(5, Math.max(current, step + 1));

  if (step === 1) {
    const input = step1.parse(data);
    if (!(await prisma.category.findUnique({ where: { id: input.categoryId }, select: { id: true } }))) {
      throw new HttpError(400, "Bunday yoʻnalish mavjud emas.");
    }
    if (!profile) {
      await prisma.providerProfile.create({
        data: {
          userId: user.id, slug: await uniqueSlug(user.name), headline: input.headline, bio: input.bio,
          categoryId: input.categoryId, languages: [], startingPrice: 0, wizardStep: 2,
        },
      });
    } else {
      await prisma.providerProfile.update({
        where: { id: profile.id },
        data: { headline: input.headline, bio: input.bio, categoryId: input.categoryId, wizardStep: advance(profile.wizardStep) },
      });
    }
  } else if (step === 2) {
    const input = step2.parse(data);
    await prisma.providerProfile.update({
      where: { id: profile!.id },
      data: {
        city: input.city, district: input.district || null, equipment: input.equipment || null,
        languages: input.languages, wizardStep: advance(profile!.wizardStep),
      },
    });
  } else if (step === 3) {
    const input = step3.parse(data);
    const profileId = profile!.id;
    await prisma.$transaction(async (tx) => {
      const existing = await tx.service.findMany({
        where: { profileId },
        select: { id: true, _count: { select: { orders: true } } },
      });
      const own = new Set(existing.map((e) => e.id));
      const keep = new Set<string>();
      for (const s of input.services) {
        if (s.id) {
          if (!own.has(s.id)) throw new HttpError(400, "Paketlardan biri sizning profilingizga tegishli emas.");
          keep.add(s.id);
        }
      }
      for (const e of existing) {
        if (keep.has(e.id)) continue;
        // Packages that already have orders are hidden, not deleted, so order history stays intact.
        if (e._count.orders > 0) await tx.service.update({ where: { id: e.id }, data: { isActive: false } });
        else await tx.service.delete({ where: { id: e.id } });
      }
      for (const s of input.services) {
        const fields = { title: s.title, description: s.description, price: s.price, deliveryDays: s.deliveryDays, revisions: s.revisions, isActive: true };
        if (s.id) await tx.service.update({ where: { id: s.id }, data: fields });
        else await tx.service.create({ data: { ...fields, profileId } });
      }
      await tx.providerProfile.update({
        where: { id: profileId },
        data: { startingPrice: Math.min(...input.services.map((s) => s.price)), wizardStep: advance(profile!.wizardStep) },
      });
    });
  } else if (step === 4) {
    const input = step4.parse(data);
    const profileId = profile!.id;
    await prisma.$transaction([
      prisma.portfolioItem.deleteMany({ where: { profileId } }),
      prisma.portfolioItem.createMany({
        data: input.items.map((i, idx) => ({
          profileId, title: i.title, videoUrl: i.videoUrl ?? null, imageUrl: i.imageUrl ?? null, sortOrder: idx,
        })),
      }),
      prisma.providerProfile.update({ where: { id: profileId }, data: { wizardStep: advance(profile!.wizardStep) } }),
    ]);
  } else {
    // step 5: submit for admin review
    if (profile!.status !== "DRAFT") throw new HttpError(409, "Bu profil allaqachon yuborilgan.");
    const [services, portfolio] = await Promise.all([
      prisma.service.count({ where: { profileId: profile!.id, isActive: true } }),
      prisma.portfolioItem.count({ where: { profileId: profile!.id } }),
    ]);
    const problems: string[] = [];
    if (profile!.languages.length === 0) problems.push("Kamida bitta tilni tanlang (2-qadam).");
    if (services === 0) problems.push("Kamida bitta paket qoʻshing (3-qadam).");
    if (portfolio === 0) problems.push("Portfolioga kamida bitta ish qoʻshing (4-qadam).");
    if (problems.length) throw new HttpError(422, `Profilingiz hali toʻliq emas: ${problems.join(" ")}`, { problems });
    await prisma.providerProfile.update({ where: { id: profile!.id }, data: { status: "PENDING_REVIEW" } });
    await logAudit({ actorId: user.id, action: "PROFILE_SUBMITTED", entity: "ProviderProfile", entityId: profile!.id });
    // Tell the admin on Telegram. Not awaited, so a slow or unreachable Telegram never delays the creator's
    // submit; the helper never throws and is a no-op when Telegram is not configured.
    void notifyProfileSubmitted({ name: user.name, city: profile!.city });
  }

  return ok({ profile: await summary(user.id) });
});
