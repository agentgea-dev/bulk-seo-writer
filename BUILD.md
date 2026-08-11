# BUILD.md — 2026-07-27 bulk-seo-writer

Builder run 08:00 JST. Idea: `ideas/2026-07-27.md` #1 RECOMMENDED (Bulk AI
Content Writer — keyword list → article + deterministic SEO score + export).
Fills the portfolio's one empty lane: content/SEO/marketing automation (all 7
prior builds = infra/billing/RAG/auth). Fallback chain not needed.

## Done (verified, not claimed)

- `npm install` + `npm run build` → **exit 0, 0 TS errors**. Route sizes: `/`
  18.3 kB (106 kB first load), `/api/generate` dynamic. Clean.
- **Deterministic SEO scorer written first** (`src/lib/seo-scorer.ts`, pure TS,
  no I/O) — the heart of the zero-env demo. Metrics: keyword density (non-
  overlapping multi-word phrase count), Flesch reading ease (standard formula),
  heading structure (H1/H2/H3), meta description length, length vs target.
- **Scorer verified against manual counts** — `node e2e.mjs` → **11 checks
  passed**. Not "card appears": actual asserts on tokenization, single- and
  multi-word keyword counts, non-overlap, heading levels, sentence split,
  syllable heuristic, the Flesch formula against a hand calc (59.6), and full-
  report raw metrics against a hand-counted article (14 words, 4 keyword hits
  incl. H1, 28.6% density, H1:1/H2:1). e2e compiles the TS with the local `tsc`
  (esbuild isn't a direct dep on this machine).
- **Both engine paths tested at runtime:**
  - **LLM mode** via local 9router (`127.0.0.1:20128/v1`, model
    `groq/llama-3.3-70b-versatile`, ai-doc-qa pattern): `GET /api/generate` →
    `{"mode":"llm"}`; `POST` with a real keyword → **real JSON article** (valid
    title, H1 present, meta, ~179-word body). The LLM code path is live, not
    dead code.
  - **Demo mode** (no key): `GET` → `{"mode":"demo"}`; `POST` → pre-generated
    sample + honest note "Demo mode … scorer tetap live".
- **Honest scoring guarantee enforced:** the LLM only *writes* articles; the
  route/UI always recompute the score from returned text via the deterministic
  scorer. LLM never emits a score.
- Batch queue UI: paste ≤20 keywords → per-item status (pending/generating/
  done/error), stop button, article card + SEO score card side-by-side.
- Export: copy Markdown, download single `.md`, download all as `.zip` (JSZip,
  client-side — nothing uploaded), dedup filenames.
- Live scorer playground: paste any text, score updates real-time, zero key.
- Provider-portable env (`OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL`),
  documented in README + `.env.example`. Deploys to Vercel with zero env (demo).

## Key situation (for Vercel deploy)

**No OpenAI cloud key on this machine** (same as ai-doc-qa 07-18). LLM path was
verified against the local 9router OpenAI-compatible endpoint. For the public
Vercel demo:
- Deploy with **no env** → full demo works (samples + live scorer). This is the
  intended recruiter experience.
- Optionally set `OPENAI_API_KEY` (+ `OPENAI_BASE_URL`/`OPENAI_MODEL`) in
  Vercel project env for real LLM generation.

## Stubbed / not done (honest)

- Stateless by design — no DB, auth, or saved history. Documented as a design
  choice, not hidden.
- Demo mode = 3 real sample articles rotated by keyword hash. Not "10 articles";
  real generation needs a key.
- Flesch readability is English-tuned; for Indonesian text it's indicative. The
  other four metrics (density, headings, meta, length) are exact and language-
  agnostic — noted in README.
- Markdown preview is a minimal renderer (headings/paragraphs/lists), sufficient
  for generated articles, not a full engine.
- No WordPress publish, image gen, or internal linking/clustering — framed as
  the paid "Pro" follow-ups in the app footer + README (the recurring-work
  angle the idea called out).

## Next steps (manager / Aji)

1. Manager QA: `npm run build` (clean) and optionally `node e2e.mjs` (11 checks).
   To re-verify LLM path: `OPENAI_API_KEY=dummy OPENAI_BASE_URL=http://127.0.0.1:20128/v1 OPENAI_MODEL=groq/llama-3.3-70b-versatile PORT=3199 npm run start`
   then `POST /api/generate`.
2. On promote: deploy Vercel (no env is fine for demo), replace README demo-link
   placeholder. Optionally set `OPENAI_API_KEY` for live generation.
3. Portfolio note: this opens the content/marketing-automation lane. Natural next
   builds in-lane: internal-linking/clustering tool, or WordPress-publish add-on.
```
