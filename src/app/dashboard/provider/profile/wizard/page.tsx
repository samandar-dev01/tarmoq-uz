import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { Alert } from "@/components/ui/Alert";
import { Container } from "@/components/ui/Container";
import { ProfileWizard, type WizardInitial } from "@/components/wizard/ProfileWizard";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Ijodkor profilingiz") };
}

export default async function WizardPage() {
  const user = await requirePageRole("PROVIDER");
  const t = await getT();
  const [profile, categories] = await Promise.all([
    prisma.providerProfile.findUnique({
      where: { userId: user.id },
      include: {
        services: { where: { isActive: true }, orderBy: { id: "asc" } }, // ids are time-ordered; Service has no createdAt column
        portfolio: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, nameRu: true } }),
  ]);

  if (profile?.status === "SUSPENDED") {
    return (
      <Container size="md" pad="section">
        <Alert variant="error">{t("Profilingiz toʻxtatilgan. Kirishni tiklash uchun qoʻllab-quvvatlash xizmatiga murojaat qiling.")}</Alert>
      </Container>
    );
  }

  const initial: WizardInitial = profile && {
    slug: profile.slug,
    status: profile.status,
    wizardStep: profile.wizardStep,
    headline: profile.headline,
    bio: profile.bio,
    categoryId: profile.categoryId,
    city: profile.city,
    district: profile.district ?? "",
    equipment: profile.equipment ?? "",
    languages: profile.languages,
    services: profile.services.map((s) => ({
      id: s.id, title: s.title, description: s.description, price: s.price, deliveryDays: s.deliveryDays, revisions: s.revisions,
    })),
    portfolio: profile.portfolio.map((i) => ({ title: i.title, videoUrl: i.videoUrl, imageUrl: i.imageUrl })),
  };

  return (
    <Container size="lg">
      <h1>{t("Ijodkor profilingiz")}</h1>
      <p className="mt-2 text-ink-soft">{t("Quyidagi qadamlarni bajaring. Yangi profillarni admin tekshiradi, shundan keyin ular ommaga chiqadi.")}</p>
      <div className="mt-8">
        <ProfileWizard initial={initial} categories={categories} />
      </div>
    </Container>
  );
}
