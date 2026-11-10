import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "Demo12345!";

// Slugs are stable keys (used in URLs and tests); only the names are shown to people.
const categories = [
  { slug: "mobile-videography", name: "Mobilografiya" },
  { slug: "photography", name: "Fotografiya" },
  { slug: "video-editing", name: "Video montaj" },
  { slug: "drone", name: "Dron bilan suratga olish" },
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
    headline: "Mobilograf: reels, tadbirlar va toʻylar",
    bio: "Vertikal va gorizontal videolarni toʻliq flagman smartfonlarda, gimbal va simsiz mikrofon bilan suratga olaman va oʻzim montaj qilaman. Tez topshiraman, ranglar toza, subtitrlar oʻzbek va rus tillarida.",
    city: "Andijon", district: "Markaz", status: "APPROVED",
    equipment: "iPhone 15 Pro, DJI Osmo Mobile, yoqaga qadaladigan simsiz mikrofonlar", languages: ["Oʻzbek", "Rus", "Ingliz"],
    services: [
      { title: "Instagram Reel (60 soniyagacha)", description: "Bitta syomka sessiyasi, musiqa va subtitrli tayyor reel.", price: 300000, deliveryDays: 2, revisions: 1 },
      { title: "Tadbir videosi (eng yorqin lahzalar)", description: "3 soatgacha suratga olish, 2–3 daqiqalik montaj.", price: 700000, deliveryDays: 4, revisions: 2 },
      { title: "Toʻy: kun boʻyi mobil suratga olish", description: "Toʻliq kun davomida suratga olish va kinematografik montaj.", price: 1500000, deliveryDays: 7, revisions: 2 },
    ],
  },
  {
    email: "madina@demo.test", name: "Madina Yusupova", slug: "madina-yusupova",
    headline: "Mahsulot va restoran videolari mobil telefonda",
    bio: "Mahalliy bizneslar uchun mahsulot, kafe va restoran reklama roliklariga ixtisoslashganman.",
    city: "Andijon", district: "Bobur", status: "APPROVED",
    equipment: "Samsung S24 Ultra, shtativ, LED panellar", languages: ["Oʻzbek", "Rus"],
    services: [
      { title: "Mahsulot reklamasi (30 soniya)", description: "5 tagacha mahsulotni bezab suratga olish va tayyor reklama roligi.", price: 450000, deliveryDays: 3, revisions: 1 },
      { title: "Kafe va restoran paketi", description: "Ijtimoiy tarmoqlar uchun 3 ta qisqa lavha.", price: 900000, deliveryDays: 5, revisions: 2 },
    ],
  },
  {
    email: "bobur@demo.test", name: "Bobur Tursunov", slug: "bobur-tursunov",
    headline: "TikTok va Telegram uchun hamyonbop qisqa roliklar",
    bio: "Kichik bizneslar va shaxsiy brendlar uchun tez va arzon vertikal roliklar.",
    city: "Andijon", district: "Shahrixon", status: "APPROVED",
    equipment: "iPhone 13, yoqaga qadaladigan mikrofon", languages: ["Oʻzbek"],
    services: [
      { title: "TikTok roligi", description: "Bitta qisqa rolik, oddiy montaj.", price: 150000, deliveryDays: 2, revisions: 1 },
      { title: "Oyiga 5 ta rolik", description: "Bir oy davomida beshta qisqa rolik.", price: 600000, deliveryDays: 7, revisions: 1 },
    ],
  },
  {
    email: "dilshod@demo.test", name: "Dilshod Rahimov", slug: "dilshod-rahimov",
    headline: "Toshkentdagi mobilograf",
    bio: "Mobil telefonda korporativ va tadbir videolari. Toshkentda ishlayman.",
    city: "Toshkent", district: "Chilonzor", status: "APPROVED",
    equipment: "iPhone 15, gimbal", languages: ["Oʻzbek", "Rus", "Ingliz"],
    services: [{ title: "Korporativ rolik", description: "2 daqiqagacha, bitta joyda suratga olish.", price: 800000, deliveryDays: 5, revisions: 2 }],
  },
  {
    email: "sevara@demo.test", name: "Sevara Aliyeva", slug: "sevara-aliyeva",
    headline: "Mobilograf (admin tasdigʻini kutmoqda)",
    bio: "Profili hozir koʻrib chiqilayotgan yangi ijodkor. Admin tasdiqlash jarayonini sinash uchun.",
    city: "Andijon", district: "Asaka", status: "PENDING_REVIEW",
    equipment: "iPhone 14 Pro", languages: ["Oʻzbek", "Rus"],
    services: [{ title: "Qisqa rolik", description: "Bitta qisqa rolik, oddiy montaj.", price: 250000, deliveryDays: 3, revisions: 1 }],
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
    create: { email: "client@demo.test", name: "Demo Mijoz", phone: "+998901234567", role: "CLIENT", passwordHash },
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
