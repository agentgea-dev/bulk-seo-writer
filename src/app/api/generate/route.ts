import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { GenConfigSchema } from "@/lib/types";
import { generateArticle, hasLlmKey } from "@/lib/generator";
import { pickSample } from "@/lib/samples";
import { createRateLimiter, readPositiveInt } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// LLM generations per client IP per hour. Only applies in LLM mode.
const RATE_LIMIT_MAX = readPositiveInt(process.env.RATE_LIMIT_MAX, 40);
const limiter = createRateLimiter(RATE_LIMIT_MAX, 60 * 60 * 1000);

const RequestSchema = z.object({
  keyword: z.string().min(1).max(200),
  config: GenConfigSchema.pick({ tone: true, length: true, language: true }).partial(),
});

/**
 * POST /api/generate
 * Body: { keyword: string, config: { tone, length, language } }
 * - LLM mode (OPENAI_API_KEY set): generate a real article, rate-limited
 *   per client IP (RATE_LIMIT_MAX per hour).
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
    // Demo mode: the sample written for this keyword, else a fallback sample
    // scored against its own keyword (scoring it against an unrelated keyword
    // would just show 0% density).
    const { article, exact } = pickSample(keyword);
    return NextResponse.json({
      mode: "demo",
      article,
      note: exact
        ? "Demo mode: artikel contoh untuk keyword ini (tanpa OPENAI_API_KEY). Skor SEO dihitung live."
        : `Demo mode: belum ada artikel contoh untuk "${keyword}", jadi ditampilkan contoh untuk "${article.keyword}" dan skornya dihitung terhadap keyword itu. Set OPENAI_API_KEY untuk artikel sungguhan.`,
    });
  }

  const limit = limiter(clientIp(req));
  if (!limit.ok) {
    const minutes = Math.ceil(limit.retryAfterSec / 60);
    return NextResponse.json(
      {
        mode: "llm",
        error: `Batas ${RATE_LIMIT_MAX} artikel per jam tercapai. Coba lagi dalam ${minutes} menit.`,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
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

/** Client IP as set by the hosting proxy (Vercel overwrites these headers). */
function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "unknown";
}
