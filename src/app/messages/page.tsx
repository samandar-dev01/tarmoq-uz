import Link from "next/link";
import { requirePageRole } from "@/lib/auth";
import { listConversations } from "@/lib/messaging";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const user = await requirePageRole("CLIENT", "PROVIDER");
  const conversations = await listConversations(user.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">Messages</h1>
      <div className="mt-4">
        {conversations.length === 0 ? (
          <EmptyState
            title="No conversations yet"
            description="Message a creator from their profile, or start an order to chat about the details."
            action={<Link href="/search" className="text-sm font-medium text-indigo-600 hover:underline">Find creators</Link>}
          />
        ) : (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link href={`/messages/${c.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{c.other.name}{c.orderTitle ? <span className="font-normal text-slate-500"> · {c.orderTitle}</span> : null}</p>
                    <p className="truncate text-sm text-slate-600">{c.last ? c.last.body.replace(/\s+/g, " ") : "No messages yet"}</p>
                  </div>
                  {c.unread > 0 && (
                    <span className="shrink-0 rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white" aria-label={`${c.unread} unread`}>{c.unread}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
