import OpenAI from "openai";
import { z } from "zod";
import { Article, ArticleSchema, GenConfig, LENGTH_WORDS } from "./types";

/**
 * Dual-engine article generator.
 *
 * LLM mode: if OPENAI_API_KEY is set, generate a real article via an
 *   OpenAI-compatible endpoint (works with cloud OpenAI or any local
 *   OpenAI-compatible server via OPENAI_BASE_URL). Structured JSON output.
 * Demo mode: handled in the route by serving pre-generated samples.
 *
 * The LLM only WRITES articles. It never produces SEO scores — those are
 * always computed by the deterministic scorer from the returned text.
 */

export function hasLlmKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());
}

const LlmJsonSchema = z.object({
  title: z.string().min(1),
  meta: z.string().min(1),
  body: z.string().min(1),
});

function buildPrompt(keyword: string, config: GenConfig): string {
  const words = LENGTH_WORDS[config.length];
  const lang = config.language === "id" ? "Bahasa Indonesia" : "English";
  const toneMap: Record<GenConfig["tone"], string> = {
    profesional: "profesional dan otoritatif",
    santai: "santai dan ramah",
    persuasif: "persuasif dan menjual",
    informatif: "informatif dan netral",
  };
  return `Tulis satu artikel SEO dalam ${lang} untuk target keyword: "${keyword}".

Aturan:
- Nada: ${toneMap[config.tone]}.
- Panjang sekitar ${words} kata.
- Gunakan tepat satu heading H1 (judul) dan minimal 3 heading H2 dalam format Markdown.
- Sisipkan keyword "${keyword}" secara alami beberapa kali (jangan berlebihan / keyword stuffing).
- Buat meta description 120-160 karakter yang mengandung keyword.

Balas HANYA JSON valid dengan bentuk persis:
{"title": "...", "meta": "...", "body": "artikel lengkap dalam Markdown, diawali '# Judul'"}`;
}

export async function generateArticle(
  keyword: string,
  config: GenConfig
): Promise<Article> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.7,
    messages: [
      {
        role: "system",
        content:
          "You are an expert SEO copywriter. You always reply with a single valid JSON object and nothing else.",
      },
      { role: "user", content: buildPrompt(keyword, config) },
    ],
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(content));
  } catch {
    throw new Error("LLM returned non-JSON output");
  }
  const validated = LlmJsonSchema.parse(parsed);

  const article: Article = {
    keyword,
    title: validated.title.trim(),
    meta: validated.meta.trim(),
    body: validated.body.trim(),
    language: config.language,
  };
  return ArticleSchema.parse(article);
}

/** Pull the first JSON object out of a string, tolerating code fences. */
export function extractJson(s: string): string {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : s;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return candidate.trim();
  return candidate.slice(start, end + 1);
}
