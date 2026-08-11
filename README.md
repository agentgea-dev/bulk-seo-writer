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
   - Flesch Reading Ease (standard formula, documented syllable heuristic)
   - Heading structure (H1/H2/H3 counts, penalizes missing/duplicate H1)
   - Meta description length (SERP-safe 120–160 target)
   - Length vs target word count
3. **Live scorer playground** — paste *any* text and watch the score update in
   real time. Fully interactive with **zero API key**.
4. **Export** — copy Markdown per article, download a single `.md`, or download
   all generated articles as a `.zip` (built client-side; nothing is uploaded).

## Wow-factor: honest dual-engine, zero-env demo

- **Demo mode (no key):** serves 3 pre-generated sample articles and the SEO
  scorer runs 100% live. A recruiter gets the full experience — queue, cards,
  scoring, export — in 10 seconds with nothing to configure.
- **LLM mode (`OPENAI_API_KEY` set):** generates real articles via any
  OpenAI-compatible endpoint (cloud OpenAI, a local server, or a router), using
  structured JSON output validated with Zod.

The UI always tells you honestly which mode ran (badge per article + server
badge). No fake data is dressed up as "real".

## 20-second demo script

1. Open the deployed URL (no key needed).
2. The keyword box is pre-filled with 3 keywords — click **Generate Batch**.
   Watch the queue fill; each article shows a title, body, and SEO score card.
3. Click **Unduh semua .zip** — you get real `.md` files.
4. Scroll to **SEO scorer live** and paste your own text. The score updates
   instantly — that's the deterministic engine, running with no LLM.

## Run locally

```bash
npm install
npm run build      # clean build, 0 TS errors
npm run start      # or: npm run dev
```

Open http://localhost:3000. Runs in demo mode out of the box.

For LLM mode, copy `.env.example` → `.env` and set `OPENAI_API_KEY`
(and optionally `OPENAI_BASE_URL` / `OPENAI_MODEL`).

Verify the scorer against hand-counted values:

```bash
node e2e.mjs       # 11 checks, compiled via local tsc
```

## Deploy (Vercel)

Vercel-ready. Deploy with no env → the public demo works (demo mode + live
scorer). Set `OPENAI_API_KEY` in project env for full LLM generation.

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
- **Demo mode uses 3 sample articles**, rotated by keyword. Real generation
  requires an API key.
- **Flesch is English-tuned.** The syllable count is a standard heuristic; for
  Indonesian text the readability number is indicative, not authoritative
  (density, headings, meta, and length are language-agnostic and exact).
- Markdown preview is a minimal renderer (headings/paragraphs/lists), enough for
  generated articles — not a full markdown engine.
- No WordPress publish, image generation, or internal-linking/clustering — these
  are the natural paid "Pro" follow-ups, listed in the app footer.

## Architecture

```
src/lib/seo-scorer.ts   Pure deterministic scorer (the heart). No I/O.
src/lib/generator.ts    LLM article generation (OpenAI-compatible), Zod-validated.
src/lib/samples.ts      Pre-generated sample articles for demo mode.
src/app/api/generate    Dual-engine route: LLM if key, else sample. Honest mode flag.
src/components/*         Batch queue, article + score cards, live scorer playground.
e2e.mjs                 Scorer verified against manual counts (11 checks).
```
