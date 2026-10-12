import { z } from "zod";

export const GenConfigSchema = z.object({
  keywords: z.array(z.string().min(1)).min(1).max(20),
  tone: z.enum(["profesional", "santai", "persuasif", "informatif"]).default("informatif"),
  length: z.enum(["pendek", "sedang", "panjang"]).default("sedang"),
  language: z.enum(["id", "en"]).default("id"),
});
export type GenConfig = z.infer<typeof GenConfigSchema>;

export const ArticleSchema = z.object({
  keyword: z.string(),
  title: z.string(),
  meta: z.string(),
  body: z.string(), // markdown
  language: z.enum(["id", "en"]).optional(), // language the body is written in
});
export type Article = z.infer<typeof ArticleSchema>;

export const LENGTH_WORDS: Record<GenConfig["length"], number> = {
  pendek: 400,
  sedang: 800,
  panjang: 1400,
};
