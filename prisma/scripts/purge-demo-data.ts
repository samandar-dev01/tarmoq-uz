/**
 * Removes demo and test data from a database (hard rule 1: no fake data in production).
 *
 *   npx tsx prisma/scripts/purge-demo-data.ts            # DRY RUN: prints what would be deleted, changes nothing
 *   npx tsx prisma/scripts/purge-demo-data.ts --confirm  # deletes, in one transaction
 *
 * What counts as fake: every account whose email is on a reserved test domain (@demo.test, @example.test).
 * No real person can own such an address, so nothing genuine can match. That covers the seed providers
 * (Jasur Karimov, Dilshod Rahimov, Bobur Tursunov, Madina Yusupova, Sevara Aliyeva), the demo client and
 * demo admin, and every "E2E Tester" account the test suite registered (the author of the "E2E C." review).
 * Everything those accounts touched goes with them: orders, agreements, payments and their ledger,
 * delivered files, conversations, messages, reviews, profiles, packages and portfolio items.
 *
 * Safety:
 *   - an order between a fake account and a REAL account stops the run (nothing is deleted) unless
 *     --include-mixed is passed; read the printed list first;
 *   - the last active admin is never deleted: if the only admin is the demo admin, the run stops and
 *     tells you to promote a real account first.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { removeFile } from "../../src/lib/storage";

const prisma = new PrismaClient();
const FAKE_DOMAINS = ["@demo.test", "@example.test"];
const args = new Set(process.argv.slice(2));
const CONFIRM = args.has("--confirm");
const INCLUDE_MIXED = args.has("--include-mixed");

async function main() {
  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? "").host;
    } catch {
      return "(unreadable DATABASE_URL)";
    }
  })();
  console.log(`Database: ${host}`);
  console.log(CONFIRM ? "Mode: DELETE (--confirm)\n" : "Mode: dry run (pass --confirm to delete)\n");

  const fake = await prisma.user.findMany({
    where: { OR: FAKE_DOMAINS.map((d) => ({ email: { endsWith: d, mode: "insensitive" as const } })) },
    select: { id: true, email: true, name: true, role: true },
    orderBy: { email: "asc" },
  });
  if (fake.length === 0) {
    console.log("No demo or test accounts found. Nothing to do.");
    return;
  }
  const ids = fake.map((u) => u.id);
  const idSet = new Set(ids);

  const realAdmins = await prisma.user.count({ where: { role: "ADMIN", isActive: true, id: { notIn: ids } } });
  if (fake.some((u) => u.role === "ADMIN") && realAdmins === 0) {
    throw new Error(
      "The only active admin is a demo account. Register a real account and promote it first:\n" +
        `  UPDATE "User" SET role = 'ADMIN' WHERE email = 'you@your-domain';\nThen run this script again.`,
    );
  }

  const orders = await prisma.order.findMany({
    where: { OR: [{ clientId: { in: ids } }, { providerId: { in: ids } }] },
    select: { id: true, clientId: true, providerId: true, client: { select: { email: true } }, provider: { select: { email: true } } },
  });
  const mixed = orders.filter((o) => !idSet.has(o.clientId) || !idSet.has(o.providerId));
  const orderIds = orders.map((o) => o.id);

  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ userAId: { in: ids } }, { userBId: { in: ids } }, { orderId: { in: orderIds } }] },
    select: { id: true },
  });
  const conversationIds = conversations.map((c) => c.id);
  const reviewWhere = { OR: [{ orderId: { in: orderIds } }, { authorId: { in: ids } }, { providerUserId: { in: ids } }] };
  const [reviews, deliveries, payments, messages] = await Promise.all([
    prisma.review.findMany({ where: reviewWhere, select: { id: true, providerUserId: true, comment: true, author: { select: { name: true } } } }),
    prisma.delivery.findMany({ where: { orderId: { in: orderIds } }, select: { fileKey: true } }),
    prisma.payment.count({ where: { orderId: { in: orderIds } } }),
    prisma.message.count({ where: { OR: [{ conversationId: { in: conversationIds } }, { senderId: { in: ids } }] } }),
  ]);

  console.log(`Accounts (${fake.length}):`);
  for (const u of fake) console.log(`  ${u.role.padEnd(8)} ${u.email}  "${u.name}"`);
  console.log(`\nOrders: ${orders.length}   Payments: ${payments}   Delivered files: ${deliveries.length}`);
  console.log(`Conversations: ${conversations.length}   Messages: ${messages}`);
  console.log(`Reviews (${reviews.length}):`);
  for (const r of reviews) console.log(`  by "${r.author.name}": ${r.comment.slice(0, 60)}`);

  if (mixed.length) {
    console.log(`\nOrders that involve a REAL account (${mixed.length}):`);
    for (const o of mixed) console.log(`  ${o.id}  client ${o.client.email}  provider ${o.provider.email}`);
    if (!INCLUDE_MIXED) {
      throw new Error("Stopped: these orders belong partly to real people. Check them, then pass --include-mixed to delete them too.");
    }
  }

  if (!CONFIRM) {
    console.log("\nDry run finished. Nothing was changed.");
    return;
  }

  // Real providers whose rating included a fake client's review need their average recomputed.
  const providersToRecount = [...new Set(reviews.map((r) => r.providerUserId))].filter((id) => !idSet.has(id));

  await prisma.$transaction(
    async (tx) => {
      await tx.ledgerEntry.deleteMany({ where: { payment: { orderId: { in: orderIds } } } });
      await tx.payment.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.review.deleteMany({ where: reviewWhere });
      await tx.conversation.deleteMany({ where: { id: { in: conversationIds } } }); // messages cascade
      await tx.message.deleteMany({ where: { senderId: { in: ids } } });
      await tx.order.deleteMany({ where: { id: { in: orderIds } } }); // agreements and delivery rows cascade
      await tx.user.deleteMany({ where: { id: { in: ids } } }); // profile, packages, portfolio cascade; audit log keeps its rows with no actor
      for (const providerUserId of providersToRecount) {
        const agg = await tx.review.aggregate({ where: { providerUserId, isHidden: false }, _avg: { rating: true }, _count: { _all: true } });
        await tx.providerProfile.updateMany({ where: { userId: providerUserId }, data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count._all } });
      }
    },
    { timeout: 60_000 },
  );
  console.log("\nDatabase rows deleted.");

  // Files go last: if the transaction had failed, the rows would still point at them.
  let removed = 0;
  for (const d of deliveries) {
    try {
      await removeFile(d.fileKey);
      removed += 1;
    } catch (e) {
      console.warn(`  could not remove file ${d.fileKey}: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`Delivered files removed: ${removed}/${deliveries.length}`);
}

main()
  .catch((e) => {
    console.error(`\n${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
