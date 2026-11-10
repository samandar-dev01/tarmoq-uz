import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { Alert } from "@/components/ui/Alert";
import { ProfileWizard, type WizardInitial } from "@/components/wizard/ProfileWizard";

export const metadata = { title: "Your creator profile" };

export default async function WizardPage() {
  const user = await requirePageRole("PROVIDER");
  const [profile, categories] = await Promise.all([
    prisma.providerProfile.findUnique({
      where: { userId: user.id },
      include: {
        services: { where: { isActive: true }, orderBy: { createdAt: "asc" } },
        portfolio: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (profile?.status === "SUSPENDED") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Alert variant="error">Your profile is suspended. Please contact support to restore access.</Alert>
      </div>
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
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">Your creator profile</h1>
      <p className="mt-1 text-sm text-slate-600">Complete the steps below. An admin reviews new profiles before they go public.</p>
      <div className="mt-6">
        <ProfileWizard initial={initial} categories={categories} />
      </div>
    </div>
  );
}
