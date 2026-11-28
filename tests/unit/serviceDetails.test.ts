import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { faqSchema, parseAnswers, questionsSchema, readQa } from "@/lib/serviceDetails";

const issuesOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as ZodError).issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  }
  return [];
};

describe("package details", () => {
  it("takes up to five trimmed questions and refuses short or extra ones", () => {
    expect(questionsSchema.parse(["  Qayerda suratga olamiz?  "])).toEqual(["Qayerda suratga olamiz?"]);
    expect(questionsSchema.safeParse(["ab"]).success).toBe(false);
    expect(questionsSchema.safeParse(Array(6).fill("Savol bormi?")).success).toBe(false);
  });

  it("takes questions with answers", () => {
    expect(faqSchema.parse([{ question: "Musiqa kiradimi?", answer: "Ha." }])).toHaveLength(1);
    expect(faqSchema.safeParse([{ question: "Musiqa kiradimi?", answer: "" }]).success).toBe(false);
  });

  it("reads stored JSON and ignores anything else", () => {
    expect(readQa([{ question: "a", answer: "b" }])).toEqual([{ question: "a", answer: "b" }]);
    for (const bad of [null, undefined, "x", 1, {}, [{ question: "a" }]]) expect(readQa(bad)).toEqual([]);
  });

  it("wants an answer for every question, and keeps the question with it", () => {
    expect(parseAnswers([], undefined)).toEqual([]);
    expect(parseAnswers(["Qayerda?"], [" Toshkentda "])).toEqual([{ question: "Qayerda?", answer: "Toshkentda" }]);
    expect(issuesOf(() => parseAnswers(["Qayerda?", "Qachon?"], ["Toshkentda"]))).toEqual(["answers.1: Savolga javob yozing"]);
    expect(issuesOf(() => parseAnswers(["Qayerda?"], undefined))).toEqual(["answers.0: Savolga javob yozing"]);
    // Extra answers are dropped, never stored.
    expect(parseAnswers(["Qayerda?"], ["Andijon", "yana"])).toHaveLength(1);
  });
});
