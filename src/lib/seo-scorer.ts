/**
 * Deterministic SEO scorer — pure TypeScript, no LLM, no network.
 *
 * This is the heart of the zero-env demo: it runs on ANY text the user pastes
 * and produces a fully reproducible score. The LLM (when configured) only
 * WRITES articles; it never touches these numbers. Scores are always computed
 * here from the raw text.
 *
 * All metrics are documented and checkable by hand — see e2e.mjs.
 */

export interface SeoMetric {
  key: string;
  label: string;
  /** raw measured value, human-readable */
  value: string;
  /** 0..100 sub-score for this metric */
  score: number;
  /** short, honest guidance */
  hint: string;
}

export interface SeoReport {
  /** weighted overall 0..100 */
  overall: number;
  grade: "A" | "B" | "C" | "D" | "F";
  metrics: SeoMetric[];
  raw: {
    wordCount: number;
    keywordCount: number;
    keywordDensity: number; // percent
    flesch: number;
    headings: { h1: number; h2: number; h3: number };
    metaLength: number;
    sentenceCount: number;
    syllableCount: number;
  };
}

/** Strip markdown syntax to get readable plain text for word/readability stats. */
export function stripMarkdown(md: string): string {
  return md
    // fenced code blocks
    .replace(/```[\s\S]*?```/g, " ")
    // inline code
    .replace(/`[^`]*`/g, " ")
    // images ![alt](url)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    // links [text](url) -> text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // headings markers
    .replace(/^#{1,6}\s+/gm, "")
    // bold/italic/strike markers
    .replace(/[*_~]{1,3}/g, "")
    // blockquote markers
    .replace(/^>\s?/gm, "")
    // list markers
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    // horizontal rules
    .replace(/^-{3,}$/gm, " ")
    .trim();
}

/** Split plain text into words (unicode-letter/number runs). */
export function tokenizeWords(text: string): string[] {
  const matches = text.toLowerCase().match(/[\p{L}\p{N}]+(?:[''-][\p{L}\p{N}]+)*/gu);
  return matches ?? [];
}

/** Split into sentences on ., !, ? — collapsing empties. */
export function splitSentences(text: string): string[] {
  const parts = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && /[\p{L}\p{N}]/u.test(s));
  return parts;
}

/**
 * Estimate syllables in an English-ish word (Flesch is English-tuned; this is a
 * standard heuristic used by many SEO tools). Deterministic and documented.
 */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length === 0) return 1;
  if (w.length <= 3) return 1;
  let s = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
    .replace(/^y/, "");
  const groups = s.match(/[aeiouy]{1,2}/g);
  const n = groups ? groups.length : 0;
  return Math.max(1, n);
}

/** Flesch Reading Ease: 206.835 - 1.015*(words/sentences) - 84.6*(syllables/words). */
export function fleschReadingEase(
  words: number,
  sentences: number,
  syllables: number
): number {
  if (words === 0 || sentences === 0) return 0;
  const asl = words / sentences;
  const asw = syllables / words;
  const score = 206.835 - 1.015 * asl - 84.6 * asw;
  return Math.round(score * 10) / 10;
}

/** Count markdown headings by level from the RAW markdown (before strip). */
export function countHeadings(md: string): { h1: number; h2: number; h3: number } {
  const lines = md.split(/\r?\n/);
  let h1 = 0,
    h2 = 0,
    h3 = 0;
  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s+\S/);
    if (!m) continue;
    const level = m[1].length;
    if (level === 1) h1++;
    else if (level === 2) h2++;
    else if (level === 3) h3++;
  }
  return { h1, h2, h3 };
}

/** Count non-overlapping occurrences of a (possibly multi-word) keyword phrase. */
export function countKeyword(words: string[], keyword: string): number {
  const kwTokens = tokenizeWords(keyword);
  if (kwTokens.length === 0) return 0;
  if (kwTokens.length === 1) {
    return words.filter((w) => w === kwTokens[0]).length;
  }
  let count = 0;
  for (let i = 0; i + kwTokens.length <= words.length; i++) {
    let match = true;
    for (let j = 0; j < kwTokens.length; j++) {
      if (words[i + j] !== kwTokens[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      count++;
      i += kwTokens.length - 1; // non-overlapping
    }
  }
  return count;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Triangular scoring: 100 at ideal, falling linearly to 0 at the bounds. */
function bandScore(value: number, min: number, ideal: number, max: number): number {
  if (value <= min || value >= max) return 0;
  if (value === ideal) return 100;
  if (value < ideal) {
    return clamp(((value - min) / (ideal - min)) * 100, 0, 100);
  }
  return clamp(((max - value) / (max - ideal)) * 100, 0, 100);
}

export interface ScoreOptions {
  /** target keyword to measure density for */
  keyword?: string;
  /** target word count (article length target) */
  targetWords?: number;
  /** meta description text (measured separately) */
  meta?: string;
}

export function scoreContent(markdown: string, opts: ScoreOptions = {}): SeoReport {
  const { keyword = "", targetWords = 800, meta = "" } = opts;

  const plain = stripMarkdown(markdown);
  const words = tokenizeWords(plain);
  const wordCount = words.length;
  const sentences = splitSentences(plain);
  const sentenceCount = sentences.length;
  const syllableCount = words.reduce((acc, w) => acc + countSyllables(w), 0);
  const flesch = fleschReadingEase(wordCount, sentenceCount, syllableCount);
  const headings = countHeadings(markdown);
  const keywordCount = keyword ? countKeyword(words, keyword) : 0;
  const keywordDensity =
    wordCount > 0 ? Math.round((keywordCount / wordCount) * 1000) / 10 : 0;
  const metaLength = meta.trim().length;

  const metrics: SeoMetric[] = [];

  // 1. Keyword density: ideal 1.5%, acceptable 0.5–3%
  if (keyword) {
    const s = bandScore(keywordDensity, 0, 1.5, 4);
    metrics.push({
      key: "density",
      label: "Keyword density",
      value: `${keywordDensity}% (${keywordCount}x / ${wordCount} kata)`,
      score: Math.round(s),
      hint:
        keywordDensity === 0
          ? `Keyword "${keyword}" tidak muncul — sisipkan secara alami.`
          : keywordDensity > 3
          ? "Terlalu padat, berisiko keyword stuffing."
          : keywordDensity < 0.5
          ? "Terlalu jarang — tambah 1–2 kemunculan."
          : "Rentang sehat (0.5–3%).",
    });
  } else {
    metrics.push({
      key: "density",
      label: "Keyword density",
      value: "tidak ada target keyword",
      score: 50,
      hint: "Set target keyword untuk mengukur density.",
    });
  }

  // 2. Flesch reading ease: ideal ~65 (plain), band 30–90
  {
    const s = bandScore(flesch, 10, 65, 100);
    metrics.push({
      key: "flesch",
      label: "Keterbacaan (Flesch)",
      value: `${flesch}`,
      score: Math.round(s),
      hint:
        flesch >= 60
          ? "Mudah dibaca (setara SMP–SMA)."
          : flesch >= 30
          ? "Cukup sulit — pendekkan kalimat."
          : "Sangat sulit — banyak kalimat/kata panjang.",
    });
  }

  // 3. Heading structure: exactly 1 H1, >=2 H2
  {
    let hs = 0;
    if (headings.h1 === 1) hs += 50;
    else if (headings.h1 === 0) hs += 0;
    else hs += 20; // multiple H1 is bad
    hs += clamp(headings.h2, 0, 3) * (50 / 3);
    const s = clamp(hs, 0, 100);
    metrics.push({
      key: "headings",
      label: "Struktur heading",
      value: `H1:${headings.h1} H2:${headings.h2} H3:${headings.h3}`,
      score: Math.round(s),
      hint:
        headings.h1 !== 1
          ? "Gunakan tepat satu H1 sebagai judul."
          : headings.h2 < 2
          ? "Tambah H2 untuk memecah bagian."
          : "Struktur heading baik.",
    });
  }

  // 4. Meta description: ideal 120–160 chars
  {
    const s = bandScore(metaLength, 50, 150, 200);
    metrics.push({
      key: "meta",
      label: "Meta description",
      value: metaLength > 0 ? `${metaLength} karakter` : "kosong",
      score: Math.round(s),
      hint:
        metaLength === 0
          ? "Tulis meta description 120–160 karakter."
          : metaLength < 120
          ? "Terlalu pendek untuk SERP."
          : metaLength > 160
          ? "Akan terpotong di Google (>160)."
          : "Panjang ideal (120–160).",
    });
  }

  // 5. Length vs target: ideal at target, band target*0.5 .. target*1.5
  {
    const s = bandScore(wordCount, targetWords * 0.4, targetWords, targetWords * 1.8);
    metrics.push({
      key: "length",
      label: "Panjang artikel",
      value: `${wordCount} / target ${targetWords} kata`,
      score: Math.round(s),
      hint:
        wordCount < targetWords * 0.7
          ? "Di bawah target — tambah kedalaman."
          : wordCount > targetWords * 1.5
          ? "Jauh di atas target."
          : "Panjang sesuai target.",
    });
  }

  // Weighted overall
  const weights: Record<string, number> = {
    density: 0.2,
    flesch: 0.25,
    headings: 0.25,
    meta: 0.15,
    length: 0.15,
  };
  let overall = 0;
  for (const m of metrics) overall += m.score * (weights[m.key] ?? 0);
  overall = Math.round(overall);

  const grade: SeoReport["grade"] =
    overall >= 85 ? "A" : overall >= 70 ? "B" : overall >= 55 ? "C" : overall >= 40 ? "D" : "F";

  return {
    overall,
    grade,
    metrics,
    raw: {
      wordCount,
      keywordCount,
      keywordDensity,
      flesch,
      headings,
      metaLength,
      sentenceCount,
      syllableCount,
    },
  };
}
