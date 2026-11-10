import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "Demo12345!";

const categories = [
  { slug: "mobile-videography", name: "Mobile videography" },
  { slug: "photography", name: "Photography" },
  { slug: "video-editing", name: "Video editing" },
  { slug: "drone", name: "Drone filming" },
];

type Svc = { title: string; description: string; price: number; deliveryDays: number; revisions: number };
type SeedProvider = {
  email: string; name: string; slug: string; headline: string; bio: string;
  city: string; district?: string; status: "APPROVED" | "PENDING_REVIEW";
  equipment: string; languages: string[]; services: Svc[];
};

const providers: SeedProvider[] = [
  {
    email: "jasur@demo.test", name: "Jasur Karimov", slug: "jasur-karimov",
    headline: "Mobile videographer: reels, events and weddings",
    bio: "I shoot and edit vertical and horizontal video entirely on flagship smartphones with gimbal and wireless mics. Fast turnaround, clean color, subtitles in Uzbek and Russian.",
    city: "Andijan", district: "Center", status: "APPROVED",
    equipment: "iPhone 15 Pro, DJI Osmo Mobile, wireless lav mics", languages: ["Uzbek", "Russian", "English"],
    services: [
      { title: "Instagram Reel (up to 60s)", description: "One shoot session, edited reel with music and subtitles.", price: 300000, deliveryDays: 2, revisions: 1 },
      { title: "Event highlight video", description: "Up to 3 hours of coverage, 2–3 minute highlight edit.", price: 700000, deliveryDays: 4, revisions: 2 },
      { title: "Full wedding by mobile", description: "Full-day coverage with cinematic edit.", price: 1500000, deliveryDays: 7, revisions: 2 },
    ],
  },
  {
    email: "madina@demo.test", name: "Madina Yusupova", slug: "madina-yusupova",
    headline: "Product and restaurant videos shot on mobile",
    bio: "Specializing in short product, cafe and restaurant promos for local businesses in Andijan.",
    city: "Andijan", district: "Bobur", status: "APPROVED",
    equipment: "Samsung S24 Ultra, tripod, LED panels", languages: ["Uzbek", "Russian"],
    services: [
      { title: "Product promo (30s)", description: "Styled shoot of up to 5 products, edited promo.", price: 450000, deliveryDays: 3, revisions: 1 },
      { title: "Cafe/restaurant package", description: "3 short clips for social media.", price: 900000, deliveryDays: 5, revisions: 2 },
    ],
  },
  {
    email: "bobur@demo.test", name: "Bobur Tursunov", slug: "bobur-tursunov",
    headline: "Affordable short clips for TikTok and Telegram",
    bio: "Quick, budget-friendly vertical clips for small businesses and personal brands.",
    city: "Andijan", district: "Shahrikhon", status: "APPROVED",
    equipment: "iPhone 13, clip-on mic", languages: ["Uzbek"],
    services: [
      { title: "TikTok clip", description: "One short clip, basic edit.", price: 150000, deliveryDays: 2, revisions: 1 },
      { title: "5-clip monthly pack", description: "Five short clips over one month.", price: 600000, deliveryDays: 7, revisions: 1 },
    ],
  },
  {
    email: "dilshod@demo.test", name: "Dilshod Rahimov", slug: "dilshod-rahimov",
    headline: "Mobile videographer based in Tashkent",
    bio: "Corporate and event videos on mobile. Based in Tashkent (used to test city filtering).",
    city: "Tashkent", district: "Chilanzar", status: "APPROVED",
    equipment: "iPhone 15, gimbal", languages: ["Uzbek", "Russian", "English"],
    services: [{ title: "Corporate promo", description: "Up to 2 minutes, one location.", price: 800000, deliveryDays: 5, revisions: 2 }],
  },
  {
    email: "sevara@demo.test", name: "Sevara Aliyeva", slug: "sevara-aliyeva",
    headline: "Mobile videographer (awaiting admin approval)",
    bio: "New provider whose profile is pending review. Used to test the admin approval flow.",
    city: "Andijan", district: "Asaka", status: "PENDING_REVIEW",
    equipment: "iPhone 14 Pro", languages: ["Uzbek", "Russian"],
    services: [{ title: "Short clip", description: "One short clip, basic edit.", price: 250000, deliveryDays: 3, revisions: 1 }],
  },
];

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED_IN_PRODUCTION !== "true") {
    throw new Error("Refusing to seed demo accounts in production (set ALLOW_SEED_IN_PRODUCTION=true to override).");
  }
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  for (const c of categories) {
    await prisma.category.upsert({ where: { slug: c.slug }, update: { name: c.name }, create: c });
  }
  const mobile = await prisma.category.findUniqueOrThrow({ where: { slug: "mobile-videography" } });

  await prisma.user.upsert({
    where: { email: "admin@demo.test" }, update: {},
    create: { email: "admin@demo.test", name: "Demo Admin", role: "ADMIN", passwordHash },
  });
  await prisma.user.upsert({
    where: { email: "client@demo.test" }, update: {},
    create: { email: "client@demo.test", name: "Demo Client", phone: "+998901234567", role: "CLIENT", passwordHash },
  });

  for (const p of providers) {
    const user = await prisma.user.upsert({
      where: { email: p.email }, update: {},
      create: { email: p.email, name: p.name, role: "PROVIDER", passwordHash },
    });
    const profile = await prisma.providerProfile.upsert({
      where: { slug: p.slug }, update: {},
      create: {
        userId: user.id, slug: p.slug, headline: p.headline, bio: p.bio,
        city: p.city, district: p.district, categoryId: mobile.id,
        equipment: p.equipment, languages: p.languages,
        startingPrice: Math.min(...p.services.map((s) => s.price)),
        status: p.status, wizardStep: 5,
      },
    });
    if ((await prisma.service.count({ where: { profileId: profile.id } })) === 0) {
      await prisma.service.createMany({ data: p.services.map((s) => ({ ...s, profileId: profile.id })) });
    }
  }
  console.log("Seed complete. Demo password:", PASSWORD);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
