import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { GenConfigSchema } from "@/lib/types";
import { generateArticle, hasLlmKey } from "@/lib/generator";
import { SAMPLE_ARTICLES } from "@/lib/samples";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  keyword: z.string().min(1).max(200),
  config: GenConfigSchema.pick({ tone: true, length: true, language: true }).partial(),
});

/**
 * POST /api/generate
 * Body: { keyword: string, config: { tone, length, language } }
 * - LLM mode (OPENAI_API_KEY set): generate a real article.
 * - Demo mode (no key): return a pre-generated sample so the flow works
 *   with zero env. Honest `mode` flag tells the client which path ran.
 *
 * One keyword per request keeps the queue responsive and lets the client
 * drive the batch (visible per-item status).
 */
export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { keyword } = parsed.data;
  const config = {
    tone: parsed.data.config.tone ?? "informatif",
    length: parsed.data.config.length ?? "sedang",
    language: parsed.data.config.language ?? "id",
  } as const;

  if (!hasLlmKey()) {
    // Demo mode: rotate through samples deterministically by keyword hash.
    const idx = simpleHash(keyword) % SAMPLE_ARTICLES.length;
    const base = SAMPLE_ARTICLES[idx];
    return NextResponse.json({
      mode: "demo",
      article: { ...base, keyword },
      note: "Demo mode: artikel contoh (tidak ada OPENAI_API_KEY). SEO scorer tetap live.",
    });
  }

  try {
    const article = await generateArticle(keyword, {
      keywords: [keyword],
      tone: config.tone,
      length: config.length,
      language: config.language,
    });
    return NextResponse.json({ mode: "llm", article });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "generation failed";
    return NextResponse.json(
      { mode: "llm", error: `LLM generation failed: ${msg}` },
      { status: 502 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ mode: hasLlmKey() ? "llm" : "demo" });
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}
