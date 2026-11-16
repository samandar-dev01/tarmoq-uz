import { createHash } from "node:crypto";
import { OrderStatus, ProfileStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { translate } from "@/i18n/dictionary";
import { translateRendered } from "@/i18n/rendered";
import { buildTermsText, readTerms, renderAgreementRu, russianReading, type TermsInput } from "@/lib/agreements";
import { nextAction, PROFILE_STATUS_LABEL, revisionsText, STATUS_LABEL } from "@/lib/orderUi";
import { evaluateTestCard } from "@/lib/payments/pure";
import { checkReceipt, receiptTooBigMessage } from "@/lib/payments/receiptPure";

// The signed-in half of the language work: the Russian reading of an agreement, the label tables, counted words, and the
// sentences the server returns without throwing them.

const CYRILLIC = /[А-Яа-яЁё]/;
const sha = (text: string) => createHash("sha256").update(text).digest("hex");

const base: TermsInput = {
  orderId: "order_1", version: 1, serviceTitle: "Instagram Reel", clientName: "Demo Client",
  providerName: "Jasur Karimov", price: 300000, deliveryDays: 2, revisions: 1,
};

/** Every number in a text, thousands separators removed: "1 500 000 soʻm, 3 kun, 10%" -> ["1500000", "3", "10"]. */
const numbersIn = (text: string) => (text.match(/\d+(?:[  ]\d{3})*/g) ?? []).map((n) => n.replace(/[  ]/g, ""));

describe("the Uzbek agreement is untouched", () => {
  // The Uzbek text is what both people accept and what the hash fingerprints. These fingerprints were taken from the template
  // BEFORE the Russian reading was added; if one fails, the binding text changed, which is never meant to happen here.
  it("builds the same text, byte for byte", () => {
    expect(sha(buildTermsText(base))).toBe("6a375ddaf432683b81fbaf48e53eacad2c58c89b4bb2178a282d24a65ae55955");
    expect(sha(buildTermsText({ ...base, price: 1500000, notes: "Ikki joy\nsoat 18:00 da" }))).toBe("5605e07d9b22581292886f12e8274c11f1a6fb5acc67b8974cdb86189abde818");
  });
});

describe("the Russian reading of an agreement", () => {
  const cases: [string, TermsInput][] = [
    ["a plain order", base],
    ["notes on several lines", { ...base, notes: "Две локации\nНачало в 18:00 (Chilonzor)" }],
    ["a big price, many days and revisions", { ...base, price: 12_345_000, deliveryDays: 30, revisions: 10 }],
    ["the smallest price (the minimum fee applies)", { ...base, price: 20_000, deliveryDays: 1, revisions: 0 }],
    ["a version later than the first", { ...base, version: 7 }],
    ["names and a title with digits and the word va", { ...base, serviceTitle: "Reel 30 soniya, 2 ta kamera", clientName: "Ali va Vali 2", providerName: "Aziz Karimov" }],
    ["notes the creator wrote as «Yoʻq.»", { ...base, notes: "Yoʻq." }],
  ];

  for (const [name, input] of cases) {
    it(`shows the same figures, names and notes as the Uzbek text: ${name}`, () => {
      const uz = buildTermsText(input);
      const ru = renderAgreementRu(input);
      // Every number, in the same order: version, price, days, revisions, percentage, minimum fee, fee, payout, clause numbers.
      expect(numbersIn(ru)).toEqual(numbersIn(uz));
      for (const written of [input.clientName, input.providerName, input.serviceTitle]) {
        expect(ru).toContain(written);
        expect(uz).toContain(written);
      }
      if (input.notes && input.notes !== "Yoʻq.") {
        expect(ru).toContain(input.notes.trim());
        expect(uz).toContain(input.notes.trim());
      }
      expect(ru.split("\n").length).toBeGreaterThanOrEqual(uz.split("\n").length); // the same eleven clauses
      expect(ru).not.toMatch(/[ʻʼ]/);
      expect(CYRILLIC.test(ru)).toBe(true);
    });
  }

  it("has the same eleven clauses in the same order, and says «сум», never «soʻm»", () => {
    const ru = renderAgreementRu(base).split("\n");
    expect(ru).toHaveLength(12); // the title and eleven clauses (the notes of this order are one line)
    ru.slice(1).forEach((line, i) => expect(line.startsWith(`${i + 1}. `)).toBe(true));
    expect(ru.join("\n")).not.toContain("soʻm");
    expect(ru[3]).toContain("300 000 сум");
    expect(ru[10]).toContain("30 000 сум"); // the fee on 300 000
    expect(ru[10]).toContain("270 000 сум"); // the payout
  });

  it("writes «Нет.» for no notes, as the Uzbek text writes «Yoʻq.»", () => {
    expect(buildTermsText(base)).toContain("6. Ish hajmi boʻyicha izoh: Yoʻq.");
    expect(renderAgreementRu(base)).toContain("6. Пояснение к объёму работы: Нет.");
  });

  it("reads the figures back out of a stored text and rebuilds exactly that text", () => {
    for (const [name, input] of cases) {
      const stored = buildTermsText(input);
      const figures = readTerms(stored);
      expect(figures, name).not.toBeNull();
      expect(figures).toMatchObject({
        version: input.version, clientName: input.clientName, providerName: input.providerName, serviceTitle: input.serviceTitle,
        price: input.price, deliveryDays: input.deliveryDays, revisions: input.revisions,
      });
      expect(buildTermsText({ orderId: "x", ...figures! }), name).toBe(stored);
      expect(russianReading(stored), name).toBe(renderAgreementRu(figures!));
    }
  });

  it("shows nothing rather than risk a wrong figure beside a legal text", () => {
    const stored = buildTermsText(base);
    expect(russianReading("")).toBeNull();
    expect(russianReading("Boshqa matn")).toBeNull();
    // a figure edited inside the text: the fee and payout clause no longer agree with the price
    expect(russianReading(stored.replace("3. Narxi: 300 000", "3. Narxi: 400 000"))).toBeNull();
    // a clause missing or reworded (an older template)
    expect(russianReading(stored.split("\n").slice(0, -1).join("\n"))).toBeNull();
    expect(russianReading(stored.replace("Bekor qilish", "Bekor etish"))).toBeNull();
    expect(russianReading(`${stored}\nQoʻshimcha`)).toBeNull();
  });
});

describe("the label tables are total in Russian", () => {
  const ru = (key: string) => translate("ru", key);

  it("every order status has its own Russian label, and Uzbek is the stored word", () => {
    const labels = Object.values(OrderStatus).map((s) => {
      expect(STATUS_LABEL[s], s).toBeTruthy();
      expect(translate("uz", STATUS_LABEL[s])).toBe(STATUS_LABEL[s]);
      expect(ru(STATUS_LABEL[s]), s).not.toBe(STATUS_LABEL[s]);
      expect(CYRILLIC.test(ru(STATUS_LABEL[s])), s).toBe(true);
      return ru(STATUS_LABEL[s]);
    });
    expect(new Set(labels).size).toBe(labels.length); // no two statuses read the same
  });

  it("every profile status has its own Russian label", () => {
    const labels = Object.values(ProfileStatus).map((s) => {
      expect(ru(PROFILE_STATUS_LABEL[s]), s).not.toBe(PROFILE_STATUS_LABEL[s]);
      expect(CYRILLIC.test(ru(PROFILE_STATUS_LABEL[s])), s).toBe(true);
      return ru(PROFILE_STATUS_LABEL[s]);
    });
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("every next step, for both sides, with and without a review, is in Russian", () => {
    for (const status of Object.values(OrderStatus)) {
      for (const role of ["client", "provider"] as const) {
        for (const hasReview of [true, false]) {
          const text = nextAction(status, role, hasReview);
          expect(CYRILLIC.test(ru(text)), `${status} ${role} ${hasReview}`).toBe(true);
          expect(ru(text)).not.toMatch(/[ʻʼ]/);
        }
      }
    }
  });
});

describe("counted words", () => {
  it("revisions: Uzbek keeps «N ta tuzatish», Russian follows the one/few/many rule", () => {
    expect(revisionsText("uz", 0)).toBe("0 ta tuzatish");
    expect(revisionsText("uz", 3)).toBe("3 ta tuzatish");
    const ru: [number, string][] = [
      [0, "0 правок"], [1, "1 правка"], [2, "2 правки"], [4, "4 правки"], [5, "5 правок"], [10, "10 правок"],
      [11, "11 правок"], [12, "12 правок"], [14, "14 правок"], [21, "21 правка"], [22, "22 правки"], [25, "25 правок"], [101, "101 правка"], [111, "111 правок"],
    ];
    for (const [n, text] of ru) expect(revisionsText("ru", n), String(n)).toBe(text);
  });
});

describe("what the server returns without throwing it", () => {
  it("every test-card sentence reaches a Russian reader in Russian", () => {
    const card = { number: "4242 4242 4242 4242", expMonth: 12, expYear: 2099, cvc: "123" };
    const inputs = [
      { ...card, number: "12" }, { ...card, expMonth: 13 }, { ...card, expYear: 2020.5 }, { ...card, expYear: 2020 },
      { ...card, cvc: "1" }, { ...card, number: "4111 1111 1111 1111" }, { ...card, number: "4000 0000 0000 0002" }, { ...card, number: "4000 0000 0000 9995" },
    ];
    const seen = new Set<string>();
    for (const input of inputs) {
      const result = evaluateTestCard(input, new Date("2026-11-16T00:00:00Z"));
      if (result.outcome === "success") continue;
      expect(translateRendered("uz", result.message)).toBe(result.message);
      const ru = translateRendered("ru", result.message);
      expect(ru, result.message).not.toBe(result.message);
      expect(CYRILLIC.test(ru)).toBe(true);
      seen.add(result.message);
    }
    expect(seen.size).toBe(inputs.length); // every case said something different
  });

  it("the receipt checks, and the size limit with its number", () => {
    const messages = [
      checkReceipt(new Uint8Array(0)), checkReceipt(new Uint8Array(6 * 1024 * 1024)), checkReceipt(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9])),
    ].map((r) => (r.ok ? "" : r.message));
    expect(messages).toEqual(["Fayl boʻsh.", "Fayl juda katta (eng koʻpi 5 MB).", "Chekni rasm (JPG, PNG, WebP) yoki PDF shaklida yuklang."]);
    expect(receiptTooBigMessage).toBe("Fayl juda katta (eng koʻpi 5 MB).");
    expect(translateRendered("ru", receiptTooBigMessage)).toBe("Файл слишком большой (не более 5 МБ).");
    for (const m of messages) expect(CYRILLIC.test(translateRendered("ru", m)), m).toBe(true);
  });

  it("the profile submit problems and the sentence that carries them", () => {
    const problems = ["Kamida bitta tilni tanlang (2-qadam).", "Kamida bitta paket qoʻshing (3-qadam).", "Portfolioga kamida bitta ish qoʻshing (4-qadam)."];
    const say = (text: string) => translateRendered("ru", text);
    const told = problems.map(say);
    for (const [i, p] of told.entries()) expect(p, problems[i]).not.toBe(problems[i]);
    // The route puts the list into Russian itself, then the boundary recognises the Uzbek sentence around it.
    const sentence = `Profilingiz hali toʻliq emas: ${told.join(" ")}`;
    expect(say(sentence)).toBe(`Профиль заполнен не полностью: ${told.join(" ")}`);
    expect(translateRendered("uz", `Profilingiz hali toʻliq emas: ${problems.join(" ")}`)).toBe(`Profilingiz hali toʻliq emas: ${problems.join(" ")}`);
  });
});
