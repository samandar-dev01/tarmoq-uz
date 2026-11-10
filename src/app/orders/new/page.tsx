import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { formatUZS } from "@/lib/format";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewOrderForm } from "@/components/orders/NewOrderForm";

export const metadata = { title: "New order" };

export default async function NewOrderPage({ searchParams }: { searchParams: { service?: string } }) {
  await requirePageRole("CLIENT");
  if (!searchParams.service) redirect("/search");

  const service = await prisma.service.findUnique({
    where: { id: searchParams.service },
    include: { profile: { include: { user: { select: { name: true, isActive: true } } } } },
  });
  const available = service && service.isActive && service.profile.status === "APPROVED" && service.profile.user.isActive;

  if (!available) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <EmptyState
          title="This package isn’t available"
          description="It may have been removed or the creator is not accepting orders."
          action={<Link href="/search" className="text-sm font-medium text-indigo-600 hover:underline">Find other creators</Link>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">Order: {service.title}</h1>
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <p className="font-medium">
          <Link href={`/providers/${service.profile.slug}`} className="text-indigo-600 hover:underline">{service.profile.user.name}</Link>
        </p>
        <p className="mt-1 text-slate-600">{service.description}</p>
        <p className="mt-2 text-xs text-slate-500">
          {formatUZS(service.price)} · delivery in {service.deliveryDays} {service.deliveryDays === 1 ? "day" : "days"} · {service.revisions} {service.revisions === 1 ? "revision" : "revisions"}
        </p>
      </div>
      <div className="mt-6">
        <NewOrderForm serviceId={service.id} />
      </div>
    </div>
  );
}
