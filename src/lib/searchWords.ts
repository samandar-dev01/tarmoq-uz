// What a sentence typed into the search asks for, so that «Toʻyimiz uchun fotograf kerak» finds wedding photography
// although no package holds those words. Pure. It is used only when the phrase as typed finds nothing
// (src/lib/providers.ts), so a search that already works answers exactly as before.
import { tk } from "../i18n/dictionary";
import { CITIES } from "./constants";

/** The examples the home page's search field shows in turn. Each must be understood here (tests/unit/searchWords.test.ts). */
export const SEARCH_EXAMPLES = [
  tk("Toʻyimiz uchun fotograf kerak…"),
  tk("Kafem uchun kreativ video…"),
  tk("Instagram uchun professional reel…"),
  tk("Dron orqali suratga olish…"),
  tk("Mahsulotlarim uchun fotosessiya…"),
] as const;

/** One thing a visitor can ask for. A package answers it by its direction, its subdirection or its words. */
export type Concept = {
  name: string;
  /** Word beginnings that ask for it, in lower case with no apostrophes: endings such as -imiz or -ga may follow. */
  heard: readonly string[];
  /** The creator's direction is one of these... */
  categories?: readonly string[];
  /** ...or the package's subdirection is one of these... */
  subs?: readonly string[];
  /** ...or its title or description holds one of these (Uzbek written with ʻ). */
  written: readonly string[];
};

const CONCEPTS: readonly Concept[] = [
  { name: "wedding", heard: ["toy", "kelin", "nikoh", "свадь", "свадеб", "невест"], subs: ["wedding-photo", "mobile-events", "wedding-edit", "drone-events"], written: ["toʻy", "свадь", "свадеб"] },
  { name: "photo", heard: ["foto", "rasmga", "rasmlar", "rasmchi", "фото"], categories: ["photography"], subs: ["wedding-photo", "portrait", "product-photo", "event-photo"], written: ["foto", "фото"] },
  { name: "video", heard: ["video", "rolik", "lavha", "operator", "видео", "ролик", "оператор"], categories: ["mobile-videography", "video-editing", "drone"], written: ["video", "rolik", "lavha", "видео", "ролик"] },
  { name: "mobile", heard: ["mobil", "telefon", "smartfon", "мобил", "телефон", "смартфон"], categories: ["mobile-videography"], written: ["mobil", "telefon", "мобил"] },
  { name: "editing", heard: ["montaj", "videomontaj", "монтаж", "видеомонтаж", "смонтир"], categories: ["video-editing"], subs: ["short-edit", "wedding-edit", "youtube-edit", "subtitles"], written: ["montaj", "монтаж"] },
  { name: "drone", heard: ["dron", "kvadrokopter", "дрон", "квадрокоптер", "коптер"], categories: ["drone"], written: ["dron", "дрон"] },
  { name: "reels", heard: ["reel", "rils", "tiktok", "insta", "рилс", "тикток", "инста"], subs: ["reels", "short-edit"], written: ["reel", "tiktok", "instagram", "рилс"] },
  // «tadbirkor» (a business owner) is longer than «tadbir» (an event), so it is heard here.
  { name: "business", heard: ["biznes", "reklama", "kafe", "restoran", "dokon", "korxona", "kompaniya", "tadbirkor", "бизнес", "реклам", "кафе", "ресторан", "магазин", "компани"], subs: ["business-ads", "drone-ads"], written: ["biznes", "reklama", "kafe", "restoran", "doʻkon", "реклам", "кафе", "ресторан"] },
  { name: "product", heard: ["mahsulot", "tovar", "товар", "продукт", "предмет"], subs: ["product-video", "product-photo"], written: ["mahsulot", "товар"] },
  { name: "events", heard: ["tadbir", "bayram", "korporativ", "konsert", "tugilgan", "мероприят", "праздник", "корпоратив", "концерт"], subs: ["event-photo", "mobile-events", "drone-events"], written: ["tadbir", "bayram", "korporativ", "мероприят"] },
  { name: "portrait", heard: ["portret", "портрет"], subs: ["portrait"], written: ["portret", "портрет"] },
  { name: "property", heard: ["kochmas", "mulk", "kvartira", "недвижим", "квартир"], subs: ["real-estate"], written: ["koʻchmas", "mulk", "kvartira", "недвижим"] },
  { name: "youtube", heard: ["youtube", "yutub", "ютуб"], subs: ["youtube-edit"], written: ["youtube"] },
  { name: "subtitles", heard: ["subtitr", "субтитр"], subs: ["subtitles"], written: ["subtitr", "субтитр"] },
  { name: "travel", heard: ["sayohat", "tabiat", "путешеств", "природ"], subs: ["travel"], written: ["sayohat", "tabiat"] },
];

// A city named in the sentence narrows the search to it. The beginnings are as people write them, in either language.
const CITY_WORDS: Record<(typeof CITIES)[number], readonly string[]> = {
  Andijon: ["andijon", "андижан"], Toshkent: ["toshkent", "ташкент"], Samarqand: ["samarqand", "самарканд"], Buxoro: ["buxoro", "бухар"], Namangan: ["namangan", "наманган"],
  "Fargʻona": ["fargona", "ферган"], "Qoʻqon": ["qoqon", "коканд"], Nukus: ["nukus", "нукус"], Qarshi: ["qarshi", "карши"], Termiz: ["termiz", "термез"],
};

// Words that ask for nothing in particular, so no package has to hold them: whole words, then word beginnings.
const FILLER_WORDS = new Set(
  (
    "uchun bilan yoki orqali olish olib olaman olinadi men menga mening biz bizga bizning bir qilish qilib berish tez arzon yaxshi zor eng kun bor ham shu bu top topish toping " +
    "для мне нам или мой моя мои моего моей моих наш наша нашу нашей нашего нашу хочу ищу надо через хороший хорошего недорого быстро"
  ).split(" "),
);
const FILLER_BEGINNINGS = ["kerak", "kreativ", "profession", "profesion", "sifatli", "izla", "qidir", "suratga", "xizmat", "ijodkor", "mutaxassis", "креатив", "креатор", "профессионал", "нуж", "съемк", "услуг", "специалист", "качествен", "сним"];

const MAX_OTHER_WORDS = 6;
const APOSTROPHES = /[ʻʼ'’‘`]/g;

/** The ways a word with an apostrophe may be written in a listing (toʻy, to'y, to’y, toy...). */
export const spellings = (word: string): string[] => [...new Set(["ʻ", "ʼ", "'", "‘", "’", ""].map((mark) => word.replace(/ʻ/g, mark)))];

export type Meaning = {
  concepts: Concept[];
  /** Words that are none of the above (a name, a model of camera): a package should hold them. Apostrophes written as ʻ. */
  words: string[];
  city: (typeof CITIES)[number] | null;
};

export function understand(query: string): Meaning {
  const concepts = new Map<string, Concept>();
  const words = new Set<string>();
  let city: Meaning["city"] = null;
  for (const word of query.toLocaleLowerCase("uz").replace(APOSTROPHES, "ʻ").split(/[^\p{L}\p{N}]+/u)) {
    const bare = word.replace(/ʻ/g, "").replace(/ё/g, "е");
    if (bare.length < 3) continue;
    // The longest beginning wins: «videomontaj» is editing, not just video.
    let found: Concept | undefined;
    let length = 0;
    for (const concept of CONCEPTS) {
      for (const beginning of concept.heard) {
        if (beginning.length > length && bare.startsWith(beginning)) [found, length] = [concept, beginning.length];
      }
    }
    if (found) {
      concepts.set(found.name, found);
      continue;
    }
    const place = CITIES.find((c) => CITY_WORDS[c].some((beginning) => bare.startsWith(beginning)));
    if (place) {
      city = place;
      continue;
    }
    if (!FILLER_WORDS.has(bare) && !FILLER_BEGINNINGS.some((beginning) => bare.startsWith(beginning))) words.add(word);
  }
  return { concepts: [...concepts.values()], words: [...words].slice(0, MAX_OTHER_WORDS), city };
}
