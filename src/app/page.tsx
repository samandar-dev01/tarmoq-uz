import Link from "next/link";
import { prisma } from "@/lib/db";
import { CITIES } from "@/lib/constants";
import { parseSearch, searchProviders } from "@/lib/providers";
import { ProviderCard } from "@/components/ProviderCard";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

const STEPS = [
  ["Find", "Search local creators by city, category and budget."],
  ["Agree", "Send a brief, agree on price and delivery, and both sides accept the terms."],
  ["Pay safely", "Your payment is held until you approve the finished work."],
  ["Approve", "Receive your video, request a revision if needed, then approve and review."],
];

export default async function HomePage() {
  const [featured, categories] = await Promise.all([
    searchProviders(parseSearch({ city: "Andijan", sort: "rating" }), 6),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } }),
  ]);

  return (
    <>
      <section className="bg-gradient-to-b from-indigo-50 to-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">
            Hire trusted videographers and creators in Andijan
          </h1>
          <p className="mt-4 max-w-xl text-slate-600">
            Compare local mobile videographers, agree on clear terms, and pay with protection until the work is approved.
          </p>
          <form action="/search" method="get" className="mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row">
            <input
              name="q"
              aria-label="What do you need?"
              placeholder="e.g. wedding video, product reel"
              className="w-full flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select
              name="city"
              aria-label="City"
              defaultValue="Andijan"
              className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button type="submit" className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-700">
              Search
            </button>
          </form>
          <div className="mt-5 flex flex-wrap gap-2">
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/search?city=Andijan&category=${c.slug}`}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-indigo-400"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="text-xl font-bold">Top creators in Andijan</h2>
          <Link href="/search?city=Andijan" className="text-sm font-medium text-indigo-600 hover:underline">See all</Link>
        </div>
        {featured.items.length === 0 ? (
          <EmptyState title="No creators yet" description="Approved creators will appear here soon." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.items.map((p) => <ProviderCard key={p.id} p={p} />)}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-4">
        <h2 className="mb-5 text-xl font-bold">How it works</h2>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="rounded-xl border border-slate-200 bg-white p-4">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-indigo-600 text-sm font-semibold text-white">{i + 1}</span>
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-slate-600">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="rounded-2xl bg-indigo-700 px-6 py-8 text-white sm:flex sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">Are you a videographer or creator?</h2>
            <p className="mt-1 text-sm text-indigo-100">Build your profile, list your packages, and get booked by local clients.</p>
          </div>
          <Link href="/register" className="mt-4 inline-block rounded-lg bg-white px-5 py-3 text-sm font-medium text-indigo-700 sm:mt-0">
            Become a provider
          </Link>
        </div>
      </section>
    </>
  );
}
