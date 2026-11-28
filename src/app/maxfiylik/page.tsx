import { Container } from "@/components/ui/Container";

// The public privacy policy (Google asks for a link to one before a sign-in app can go live). Written in Uzbek only, on
// purpose: it is a long legal text, and a wrong Russian sentence here would be worse than none. Nothing here goes through
// the translation tables (src/i18n), so a Russian reader sees the Uzbek text.
//
// Every statement below describes what the code does today. When the code changes what it stores, who sees it or which
// outside services it calls, change this text in the same commit.
export const metadata = { title: "Maxfiylik siyosati", description: "Tarmoq.uz qanday maʼlumotlarni yigʻadi, nima uchun va kimga koʻrsatadi." };

const CONTACT_EMAIL = "theaccofsamandar@gmail.com";
const UPDATED = "2026-yil 28-noyabr";

type Section = { title: string; text?: string[]; items?: string[]; after?: string[] };

const SECTIONS: Section[] = [
  {
    title: "Biz kimmiz",
    text: [
      "Tarmoq.uz — Oʻzbekistondagi videograf, fotograf va montajchilarni buyurtmachilar bilan bogʻlaydigan sayt. Bu sahifada saytga kirganingizda va undan foydalanganingizda qanday maʼlumotlar yigʻilishi, ular nima uchun kerakligi va kimga koʻrsatilishi yozilgan.",
      `Savollar uchun: ${CONTACT_EMAIL}`,
    ],
  },
  {
    title: "Qanday maʼlumotlarni yigʻamiz",
    items: [
      "Hisob: ism-familiya, email manzil, telefon raqami (ixtiyoriy) va parol. Parol ochiq koʻrinishda saqlanmaydi, faqat shifrlangan (hash) koʻrinishda.",
      "Google orqali kirsangiz: Google bizga faqat ismingizni, tasdiqlangan email manzilingizni va Google hisobingizning ichki identifikatorini beradi. Biz Google parolingizni koʻrmaymiz, Gmail, kontaktlar, Google Drive yoki boshqa maʼlumotlaringizga kirmaymiz va rasmingizni saqlamaymiz.",
      "Ijodkorlar: ochiq profil (sarlavha, tavsif, shahar, uskunalar, tillar, boshlangʻich narx, portfolio havolalari va rasmlari) hamda pul oʻtkazish uchun karta egasining ismi va karta raqami. Karta raqami shifrlangan holda saqlanadi, ochiq koʻrinishda faqat oxirgi 4 raqami qoladi.",
      "Buyurtmalar: buyurtma shartlari, xabarlar, yuklangan fayllar (masalan, tayyor video), sharhlar va mijoz toʻlov tasdigʻi sifatida yuklagan chek rasmi.",
      "Texnik maʼlumotlar: sayt xavfsizligi uchun muhim harakatlar (roʻyxatdan oʻtish, toʻlovlar) jurnalda qayd etiladi. Sayt joylashgan hosting xizmati texnik jurnallarda IP manzilingizni saqlashi mumkin.",
    ],
  },
  {
    title: "Cookie fayllar",
    text: ["Sayt faqat zarur cookie fayllardan foydalanadi:"],
    items: [
      "session — tizimga kirgan holingizni saqlaydi (taxminan 7 kun).",
      "last_role, lang, theme — oxirgi kirish turi, til va qora/oq mavzu tanlovingizni eslab qoladi.",
      "g_oauth — Google orqali kirish jarayonida 10 daqiqagacha turadigan vaqtinchalik cookie.",
      "seen — soʻnggi ochgan ijodkor sahifalaringiz roʻyxati (bosh sahifada qayta koʻrsatish uchun, 30 kun).",
      "saved — yurakcha bilan saqlagan paketlaringiz roʻyxati (shu brauzerda, 180 kun).",
    ],
    after: ["Reklama yoki foydalanuvchini kuzatish (analytics) cookie fayllari ishlatilmaydi."],
  },
  {
    title: "Maʼlumotlardan nima uchun foydalanamiz",
    items: [
      "hisobingizni yaratish va tizimga kirishingizni taʼminlash;",
      "mijoz va ijodkorni bogʻlash, buyurtma, toʻlov va pul oʻtkazish jarayonini yuritish;",
      "saytni firibgarlik va ruxsatsiz kirishdan himoya qilish;",
      "yangi ijodkor profili tekshiruvga yuborilganda sayt maʼmuriyatini Telegram orqali xabardor qilish (ijodkorning ismi va shahri yuboriladi).",
    ],
    after: ["Google orqali olingan maʼlumotlar faqat tizimga kirish va hisob yaratish uchun ishlatiladi, boshqa maqsadda ishlatilmaydi va sotilmaydi."],
  },
  {
    title: "Maʼlumotlarni kim koʻra oladi",
    items: [
      "Hamma: ijodkorning ochiq profili (ismi, sarlavhasi, tavsifi, shahari, narxi, portfoliosi va sharhlari).",
      "Buyurtma ishtirokchilari: shu buyurtma doirasidagi xabarlar va fayllarni mijoz va ijodkor koʻradi.",
      "Sayt maʼmuriyati: buyurtmalar, toʻlovlar va pul oʻtkazish uchun zarur maʼlumotlarni, shu jumladan ijodkorning karta maʼlumotlarini koʻradi.",
      "Xizmat koʻrsatuvchilar: sayt Render xostingida ishlaydi, maʼlumotlar bazasi va fayllar Supabase xizmatida saqlanadi, Google orqali kirish uchun Google, maʼmuriyat xabarnomalari uchun Telegram ishlatiladi. Email xatlari yoqilgan boʻlsa, ular Resend xizmati orqali yuboriladi. Onlayn karta toʻlovi yoqilgan boʻlsa, toʻlov Whop xizmati sahifasida amalga oshiriladi: karta maʼlumotlari Whop’ga kiritiladi va bizga yetib kelmaydi, biz Whop’ga summa hamda buyurtmaning ichki raqamlarini yuboramiz.",
    ],
    after: ["Maʼlumotlaringizni sotmaymiz va reklama uchun uchinchi tomonlarga bermaymiz."],
  },
  {
    title: "Saqlash muddati va oʻchirish",
    text: [
      "Hisobingiz mavjud ekan, maʼlumotlaringiz saqlanadi. Hisobingiz va maʼlumotlaringizni koʻrish, tuzatish yoki oʻchirishni soʻrash uchun yuqoridagi email manzilga yozing, soʻrovingizni koʻrib chiqamiz. Buyurtmalar va toʻlovlar tarixi kabi hisob-kitob yozuvlari xavfsizlik yoki qonuniy sabablarga koʻra saqlanib qolishi mumkin.",
    ],
  },
  {
    title: "Xavfsizlik",
    text: [
      "Parollar shifrlangan koʻrinishda saqlanadi, karta raqamlari shifrlanadi, sayt HTTPS orqali ishlaydi, kirish urinishlari cheklangan. Shunday boʻlsa-da, hech qanday tizim toʻliq xavfsiz boʻlishiga kafolat bera olmaymiz.",
    ],
  },
  {
    title: "Oʻzgarishlar",
    text: [`Bu siyosat oʻzgarishi mumkin. Yangi variant shu sahifada eʼlon qilinadi, oxirgi yangilanish sanasi: ${UPDATED}.`],
  },
];

export default function PrivacyPolicy() {
  return (
    <Container size="md">
      <h1>Maxfiylik siyosati</h1>
      <p className="mt-2 text-ink-soft">Oxirgi yangilanish: {UPDATED}</p>
      {SECTIONS.map((s) => (
        <section key={s.title} className="mt-8">
          <h2>{s.title}</h2>
          {s.text?.map((p) => (
            <p key={p} className="mt-3 text-ink-soft">{p}</p>
          ))}
          {s.items && (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
              {s.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
          {s.after?.map((p) => (
            <p key={p} className="mt-3 text-ink-soft">{p}</p>
          ))}
        </section>
      ))}
    </Container>
  );
}
