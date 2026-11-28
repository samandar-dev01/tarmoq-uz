import { z } from "zod";

// What a creator may add to a package: questions the client answers when ordering it, and the creator's own questions
// and answers about it. Pure, so the rules are unit tested.

export const MAX_QUESTIONS = 5;
export const MAX_FAQ = 5;

export type Faq = { question: string; answer: string };
/** One question as it was asked, with the client's answer, kept with the order. */
export type Answer = Faq;

export const questionsSchema = z
  .array(z.string().trim().min(3, "Savol kamida 3 ta belgidan iborat boʻlsin").max(200, "Savol 200 ta belgidan oshmasin"))
  .max(MAX_QUESTIONS, "Koʻpi bilan 5 ta savol qoʻshishingiz mumkin");

export const faqSchema = z
  .array(
    z.object({
      question: z.string().trim().min(3, "Savol kamida 3 ta belgidan iborat boʻlsin").max(200, "Savol 200 ta belgidan oshmasin"),
      answer: z.string().trim().min(2, "Javobni yozing").max(600, "Javob 600 ta belgidan oshmasin"),
    }),
  )
  .max(MAX_FAQ, "Koʻpi bilan 5 ta savol-javob qoʻshishingiz mumkin");

const stored = z.array(z.object({ question: z.string(), answer: z.string() }));

/** A stored JSON value read back as questions and answers; anything else is nothing. */
export const readQa = (value: unknown): Faq[] => {
  const parsed = stored.safeParse(value);
  return parsed.success ? parsed.data : [];
};

/** The client's answers to a package's questions: one for each, none empty. The issue paths are `answers.<n>`. */
export function parseAnswers(questions: readonly string[], raw: unknown): Answer[] {
  const schema = z.object({
    answers: z.preprocess(
      (v) => (Array.isArray(v) ? questions.map((_, i) => v[i] ?? "") : questions.map(() => "")),
      z.array(z.string({ invalid_type_error: "Savolga javob yozing" }).trim().min(1, "Savolga javob yozing").max(1000, "Javob 1000 ta belgidan oshmasin")),
    ),
  });
  const { answers } = schema.parse({ answers: raw });
  return questions.map((question, i) => ({ question, answer: answers[i]! }));
}
