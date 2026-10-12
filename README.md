# Bulk SEO Writer — Keyword List → Article + SEO Score + Export

Built to demonstrate practical **AI content automation** for freelance clients.
Tech: **Next.js 14 (App Router) + TypeScript + Tailwind + Zod + JSZip**.
Live demo: _[deploy link placeholder — Vercel]_

Paste a list of keywords → generate SEO articles in a visible batch queue → each
article gets a **deterministic SEO score card** (keyword density, Flesch
readability, heading structure, meta description length, article length) →
export as Markdown, single `.md`, or all articles as one `.zip`.

This is **not** an "ugly ChatGPT clone". The value is the workflow non-devs
actually need: batch queue + reproducible scoring + clean export.

## What it does

1. **Batch generator** — paste up to 20 keywords (one per line), pick tone /
   length / language, and generate articles one by one with live per-item status
   (pending → generating → done/error).
2. **Deterministic SEO scorer** — every article is scored by a pure-TypeScript
   module. The score is computed **from the text**, never invented by the LLM.
   The LLM only *writes* the article. Metrics:
   - Keyword density (%) with non-overlapping multi-word phrase counting
     (healthy 0.5–3%)
   - Readability, language-aware: Flesch Reading Ease for English (easy at
     ≥60); average sentence length for Indonesian (easy at ≤20 words)
   - Heading structure (H1/H2/H3 counts, penalizes missing/duplicate H1)
   - Meta description length (SERP-safe 120–160 target)
   - Length vs target word count (healthy 0.8×–1.3× target)

   Each metric scores 100 across the same range its hint calls healthy and
   falls off linearly outside it, so the bar and the hint never disagree.
3. **Live scorer playground** — paste *any* text and watch the score update in
   real time. Fully interactive with **zero API key**.
4. **Export** — copy Markdown per article, download a single `.md`, or download
   all generated articles as a `.zip` (built client-side; nothing is uploaded).

## Wow-factor: honest dual-engine, zero-env demo

- **Demo mode (no key):** serves 3 pre-generated sample articles (660–700
  words each, one per pre-filled keyword) and the SEO scorer runs 100% live. Any
  other keyword gets a fallback sample, clearly labeled and scored against
  the sample's own keyword. A recruiter gets the full experience — queue, cards,
  scoring, export — in 10 seconds with nothing to configure.
- **LLM mode (`OPENAI_API_KEY` set):** generates real articles via any
  OpenAI-compatible endpoint (cloud OpenAI, a local server, or a router), using
  structured JSON output validated with Zod. Rate-limited per client IP
  (`RATE_LIMIT_MAX`, default 40 articles/hour) so a public deploy can't be
  used to drain your API credits.

The UI always tells you honestly which mode ran (badge per article + server
badge). No fake data is dressed up as "real".

## 20-second demo script

1. Open the deployed URL (no key needed).
2. The keyword box is pre-filled with 3 keywords — click **Generate Batch**.
   Watch the queue fill; each keyword gets its matching article and an SEO
   score card (all three grade A on the default settings).
3. Click **Unduh semua .zip** — you get real `.md` files.
4. Scroll to **SEO scorer live** and paste your own text. The score updates
   instantly — that's the deterministic engine, running with no LLM.

## Run locally

```bash
npm install
npm run build      # clean build, 0 TS errors
npm test           # scorer, samples, and rate-limiter checks
npm run start      # or: npm run dev
```

Open http://localhost:3000. Runs in demo mode out of the box.

For LLM mode, copy `.env.example` → `.env` and set `OPENAI_API_KEY`
(and optionally `OPENAI_BASE_URL` / `OPENAI_MODEL` / `RATE_LIMIT_MAX`).

`npm test` runs `e2e.mjs`: 20 checks against hand-counted values, compiled via
the local `tsc`. CI runs build + tests on every push and pull request.

## Deploy (Vercel)

Vercel-ready. Deploy with no env → the public demo works (demo mode + live
scorer). Set `OPENAI_API_KEY` in project env for full LLM generation, and set a
monthly spending limit at your LLM provider too: the rate limiter is
in-memory, so each serverless instance counts separately.

## Who it's for / pricing

Buyers: SEO agencies, affiliate marketers, dropshippers, content shops,
solopreneurs — non-technical but outcome-driven. Typical Upwork jobs: "bulk AI
content generator", "AI SEO article tool for my agency", "automate blog writing
with OpenAI".

Suggested pricing: **$500–$5k** project, or hourly ongoing (these clients almost
always want "one more feature" next — WordPress publish, image gen, internal
linking).

## Honest limitations (by design for a 1-day scope)

- **Stateless** — no database, no auth, no saved history. This is a deliberate
  utility-tool design, documented, not an oversight.
- **Demo mode uses 3 sample articles.** Tone/length/language settings are
  locked in demo mode because the samples are fixed. Real generation requires
  an API key.
- **Flesch is English-only**, so it is used only for English text. Indonesian
  text is scored by average sentence length instead, a simpler but
  language-agnostic proxy. Density, headings, meta, and length are exact.
- **Rate limiting is per server instance** (in-memory). It stops casual abuse
  of a public demo, not a determined attacker; a provider spending cap is the
  real backstop. It trusts `x-forwarded-for`, which Vercel sets; behind a
  proxy that doesn't overwrite it, the header can be spoofed.
- Markdown preview is a minimal renderer (headings, paragraphs, lists, bold,
  italic, code, links), enough for generated articles — not a full markdown
  engine.
- No WordPress publish, image generation, or internal-linking/clustering — these
  are the natural paid "Pro" follow-ups, listed in the app footer.

## Architecture

```
src/lib/seo-scorer.ts   Pure deterministic scorer (the heart). No I/O.
src/lib/generator.ts    LLM article generation (OpenAI-compatible), Zod-validated.
src/lib/samples.ts      Pre-generated sample articles + keyword matching for demo mode.
src/lib/rate-limit.ts   In-memory per-IP rate limiter for LLM mode.
src/app/api/generate    Dual-engine route: LLM if key, else sample. Honest mode flag.
src/components/*        Batch queue, article + score cards, live scorer playground.
e2e.mjs                 Scorer, samples, and limiter verified against manual counts (20 checks).
```
