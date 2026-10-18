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
    avgSentenceLength: number; // words per sentence
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
  const matches = text.toLowerCase().match(/[\p{L}\p{N}]+(?:['\u2019-][\p{L}\p{N}]+)*/gu);
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

/**
 * Plateau scoring: 0 at or below `lo0`, rising linearly to 100 at `lo100`,
 * 100 across the healthy range [lo100, hi100], falling linearly to 0 at `hi0`.
 * The healthy range is the same range the metric's hint calls good, so a
 * "healthy" hint never sits next to a red bar.
 */
export function plateauScore(
  value: number,
  lo0: number,
  lo100: number,
  hi100: number,
  hi0: number
): number {
  if (value < lo100) {
    return value <= lo0 ? 0 : clamp(((value - lo0) / (lo100 - lo0)) * 100, 0, 100);
  }
  if (value <= hi100) return 100;
  return value >= hi0 ? 0 : clamp(((hi0 - value) / (hi0 - hi100)) * 100, 0, 100);
}

// Healthy ranges, shared by scores and hints.
const DENSITY = { lo: 0.5, hi: 3, max: 4 }; // percent
const FLESCH = { min: 10, easy: 60, fair: 30 };
const SENTENCE = { ideal: 20, long: 25, max: 35 }; // words per sentence
const META = { min: 50, lo: 120, hi: 160, max: 200 }; // characters
const LENGTH = { min: 0.4, lo: 0.8, hi: 1.3, max: 1.8 }; // x target words

export type ScoreLanguage = "id" | "en";

export interface ScoreOptions {
  /** target keyword to measure density for */
  keyword?: string;
  /** target word count (article length target) */
  targetWords?: number;
  /** meta description text (measured separately) */
  meta?: string;
  /**
   * Language of the text. "en" scores readability with Flesch Reading Ease.
   * "id" uses average sentence length instead: Flesch's constants and the
   * syllable heuristic are English-only and score normal Indonesian prose ~0.
   */
  language?: ScoreLanguage;
}

export function scoreContent(markdown: string, opts: ScoreOptions = {}): SeoReport {
  const { keyword = "", targetWords = 800, meta = "", language = "en" } = opts;

  const plain = stripMarkdown(markdown);
  const words = tokenizeWords(plain);
  const wordCount = words.length;
  const sentences = splitSentences(plain);
  const sentenceCount = sentences.length;
  const syllableCount = words.reduce((acc, w) => acc + countSyllables(w), 0);
  const flesch = fleschReadingEase(wordCount, sentenceCount, syllableCount);
  const avgSentenceLength =
    sentenceCount > 0 ? Math.round((wordCount / sentenceCount) * 10) / 10 : 0;
  const headings = countHeadings(markdown);
  const keywordCount = keyword ? countKeyword(words, keyword) : 0;
  const keywordDensity =
    wordCount > 0 ? Math.round((keywordCount / wordCount) * 1000) / 10 : 0;
  const metaLength = meta.trim().length;

  const metrics: SeoMetric[] = [];

  // 1. Keyword density: healthy 0.5–3%
  if (keyword) {
    const s = plateauScore(keywordDensity, 0, DENSITY.lo, DENSITY.hi, DENSITY.max);
    metrics.push({
      key: "density",
      label: "Keyword density",
      value: `${keywordDensity}% (${keywordCount}x / ${wordCount} kata)`,
      score: Math.round(s),
      hint:
        keywordDensity === 0
          ? `Keyword "${keyword}" tidak muncul — sisipkan secara alami.`
          : keywordDensity > DENSITY.hi
          ? "Terlalu padat, berisiko keyword stuffing."
          : keywordDensity < DENSITY.lo
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

  // 2. Readability. English: Flesch, easy at >= 60 (higher is easier).
  //    Indonesian: average sentence length, easy at <= 20 words.
  if (language === "en") {
    const s = plateauScore(flesch, FLESCH.min, FLESCH.easy, Infinity, Infinity);
    metrics.push({
      key: "readability",
      label: "Keterbacaan (Flesch)",
      value: `${flesch}`,
      score: Math.round(s),
      hint:
        flesch >= FLESCH.easy
          ? "Mudah dibaca (setara SMP–SMA)."
          : flesch >= FLESCH.fair
          ? "Cukup sulit — pendekkan kalimat."
          : "Sangat sulit — banyak kalimat/kata panjang.",
    });
  } else {
    const s =
      sentenceCount === 0
        ? 0
        : plateauScore(avgSentenceLength, 0, 0, SENTENCE.ideal, SENTENCE.max);
    metrics.push({
      key: "readability",
      label: "Keterbacaan (panjang kalimat)",
      value: `${avgSentenceLength} kata/kalimat`,
      score: Math.round(s),
      hint:
        sentenceCount === 0
          ? "Belum ada kalimat untuk diukur."
          : avgSentenceLength <= SENTENCE.ideal
          ? "Kalimat ringkas, mudah dibaca."
          : avgSentenceLength <= SENTENCE.long
          ? "Agak panjang — pecah beberapa kalimat."
          : "Kalimat terlalu panjang — pecah jadi kalimat pendek.",
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
    const s = plateauScore(metaLength, META.min, META.lo, META.hi, META.max);
    metrics.push({
      key: "meta",
      label: "Meta description",
      value: metaLength > 0 ? `${metaLength} karakter` : "kosong",
      score: Math.round(s),
      hint:
        metaLength === 0
          ? "Tulis meta description 120–160 karakter."
          : metaLength < META.lo
          ? "Terlalu pendek untuk SERP."
          : metaLength > META.hi
          ? "Akan terpotong di Google (>160)."
          : "Panjang ideal (120–160).",
    });
  }

  // 5. Length vs target: healthy at 0.8x–1.3x target, 0 below 0.4x / above 1.8x
  {
    const s = plateauScore(
      wordCount,
      targetWords * LENGTH.min,
      targetWords * LENGTH.lo,
      targetWords * LENGTH.hi,
      targetWords * LENGTH.max
    );
    metrics.push({
      key: "length",
      label: "Panjang artikel",
      value: `${wordCount} / target ${targetWords} kata`,
      score: Math.round(s),
      hint:
        wordCount < targetWords * LENGTH.lo
          ? "Di bawah target — tambah kedalaman."
          : wordCount > targetWords * LENGTH.hi
          ? "Di atas target."
          : "Panjang sesuai target.",
    });
  }

  // Weighted overall
  const weights: Record<string, number> = {
    density: 0.2,
    readability: 0.25,
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
      avgSentenceLength,
    },
  };
}
