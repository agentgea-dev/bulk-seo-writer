/**
 * e2e verification for the SEO scorer, demo samples, and rate limiter —
 * checks computed values against hand-counted expected values.
 * Run: npm test (or node e2e.mjs)
 *
 * This is the gate: the scorer must match manual counts, not just "render".
 * The TS sources are compiled with the local `tsc` into a temp dir and
 * imported as ESM; no logic is duplicated here.
 */
import assert from "node:assert";
import { execSync } from "node:child_process";
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL(".", import.meta.url).pathname;
const dir = mkdtempSync(join(tmpdir(), "seo-"));
const MODULES = ["seo-scorer", "samples", "rate-limit"];
execSync(
  `node_modules/.bin/tsc ${MODULES.map((m) => `src/lib/${m}.ts`).join(" ")} --target ES2020 --module esnext --moduleResolution bundler --outDir "${dir}" --skipLibCheck`,
  { cwd: root, stdio: "inherit" }
);
// .mjs so Node treats the output as ESM regardless of package type. These
// modules have no runtime relative imports (samples.ts imports types only).
async function load(name) {
  const mjs = join(dir, `${name}.mjs`);
  copyFileSync(join(dir, `${name}.js`), mjs);
  return import(`file://${mjs}`);
}
const [scorer, samples, rateLimit] = await Promise.all(MODULES.map(load));

const {
  tokenizeWords,
  countKeyword,
  countHeadings,
  splitSentences,
  countSyllables,
  fleschReadingEase,
  scoreContent,
  plateauScore,
} = scorer;
const { SAMPLE_ARTICLES, pickSample } = samples;
const { createRateLimiter, readPositiveInt } = rateLimit;

let pass = 0;
function check(name, fn) {
  fn();
  pass++;
  console.log(`  ok  ${name}`);
}

console.log("SEO scorer e2e");

// --- word tokenization ---
check("tokenizeWords counts words", () => {
  const words = tokenizeWords("Satu dua tiga, empat lima.");
  assert.strictEqual(words.length, 5, `got ${words.length}`);
});
check("tokenizeWords keeps straight and curly apostrophes inside a word", () => {
  assert.deepStrictEqual(tokenizeWords("don't don\u2019t"), ["don't", "don\u2019t"]);
});

// --- keyword counting (multi-word, non-overlapping) ---
check("countKeyword single word", () => {
  const words = tokenizeWords("kopi enak kopi murah kopi panas");
  assert.strictEqual(countKeyword(words, "kopi"), 3);
});
check("countKeyword phrase", () => {
  const words = tokenizeWords("bisnis dropship itu mudah, bisnis dropship menguntungkan");
  assert.strictEqual(countKeyword(words, "bisnis dropship"), 2);
});
check("countKeyword non-overlapping", () => {
  const words = tokenizeWords("aa aa aa");
  assert.strictEqual(countKeyword(words, "aa aa"), 1);
});

// --- headings ---
check("countHeadings by level", () => {
  const md = "# Judul\n\n## Bagian 1\ntext\n## Bagian 2\n### Sub\n#### too deep";
  const h = countHeadings(md);
  assert.deepStrictEqual(h, { h1: 1, h2: 2, h3: 1 }, JSON.stringify(h));
});

// --- sentences ---
check("splitSentences counts 3", () => {
  const s = splitSentences("Halo dunia. Apa kabar? Baik saja!");
  assert.strictEqual(s.length, 3, `got ${s.length}`);
});

// --- syllables (documented heuristic) ---
check("countSyllables basics", () => {
  assert.strictEqual(countSyllables("cat"), 1);
  assert.ok(countSyllables("readable") >= 3, "readable >=3");
});

// --- flesch formula against a hand computation ---
check("flesch formula matches hand calc", () => {
  // words=100, sentences=5, syllables=150
  // 206.835 - 1.015*(20) - 84.6*(1.5) = 206.835 - 20.3 - 126.9 = 59.635
  const f = fleschReadingEase(100, 5, 150);
  assert.ok(Math.abs(f - 59.6) < 0.1, `got ${f}`);
});

// --- full report on a known article ---
check("scoreContent raw metrics match manual count", () => {
  const md = [
    "# Kopi Hitam",
    "",
    "Kopi hitam enak. Kopi hitam sehat.",
    "",
    "## Manfaat",
    "",
    "Kopi hitam murah dan nikmat.",
  ].join("\n");
  // plain words (14): Kopi hitam enak Kopi hitam sehat Manfaat Kopi hitam murah dan nikmat
  //                    1    2     3   4    5     6    7       8    9     10    11  12
  // wait — recount: Kopi(1) hitam(2) enak(3) Kopi(4) hitam(5) sehat(6) Manfaat(7)
  //   Kopi(8) hitam(9) murah(10) dan(11) nikmat(12) => plus "# Kopi Hitam" H1 line
  //   contributes Kopi(+1) Hitam(+1) => 14 total. keyword "kopi hitam" appears 3x in body
  //   plus once in the H1 = 4 phrase occurrences across the stripped text.
  const r = scoreContent(md, { keyword: "kopi hitam", targetWords: 400, meta: "x".repeat(150) });
  assert.strictEqual(r.raw.wordCount, 14, `wordCount ${r.raw.wordCount}`);
  assert.strictEqual(r.raw.keywordCount, 4, `keywordCount ${r.raw.keywordCount}`);
  // density = 4/14 = 28.6%
  assert.strictEqual(r.raw.keywordDensity, 28.6, `density ${r.raw.keywordDensity}`);
  assert.deepStrictEqual(r.raw.headings, { h1: 1, h2: 1, h3: 0 });
  assert.strictEqual(r.raw.metaLength, 150);
  assert.ok(["A", "B", "C", "D", "F"].includes(r.grade));
});

check("scoreContent overall is 0..100", () => {
  const r = scoreContent("# T\n\n## A\n\n## B\n\nsome words here to read", {
    keyword: "words",
    targetWords: 10,
    meta: "a".repeat(140),
  });
  assert.ok(r.overall >= 0 && r.overall <= 100, `overall ${r.overall}`);
});

check("empty text does not crash", () => {
  const r = scoreContent("", { keyword: "x", targetWords: 100, meta: "" });
  assert.strictEqual(r.raw.wordCount, 0);
  assert.strictEqual(r.overall >= 0, true);
});

// --- scoring curves agree with the hints ---
check("plateauScore: 0 / ramp / 100 across healthy range / ramp / 0", () => {
  // density curve: 0 at 0%, 100 on [0.5, 3], 0 at 4%
  assert.strictEqual(plateauScore(0, 0, 0.5, 3, 4), 0);
  assert.strictEqual(plateauScore(0.25, 0, 0.5, 3, 4), 50);
  assert.strictEqual(plateauScore(0.5, 0, 0.5, 3, 4), 100);
  assert.strictEqual(plateauScore(3, 0, 0.5, 3, 4), 100);
  assert.strictEqual(plateauScore(3.5, 0, 0.5, 3, 4), 50);
  assert.strictEqual(plateauScore(4, 0, 0.5, 3, 4), 0);
});

check("metric scores on the hand-counted article", () => {
  const md = "# Kopi Hitam\n\nKopi hitam enak. Kopi hitam sehat.\n\n## Manfaat\n\nKopi hitam murah dan nikmat.";
  const r = scoreContent(md, { keyword: "kopi hitam", targetWords: 400, meta: "x".repeat(150), language: "id" });
  const by = Object.fromEntries(r.metrics.map((m) => [m.key, m.score]));
  assert.strictEqual(by.density, 0, "28.6% is past the 4% cutoff");
  assert.strictEqual(by.meta, 100, "150 chars is inside 120-160");
  assert.strictEqual(by.headings, 67, "H1 ok (50) + one H2 (50/3)");
  assert.strictEqual(by.length, 0, "14 words is under 0.4 x 400");
});

check("very easy English text gets full readability (was 0 before)", () => {
  // words=6, sentences=2, syllables=6 -> Flesch 119.2
  const r = scoreContent("The cat sat. The dog ran.", { language: "en" });
  assert.strictEqual(r.raw.flesch, 119.2, `flesch ${r.raw.flesch}`);
  assert.strictEqual(r.metrics.find((m) => m.key === "readability").score, 100);
});

check("Indonesian readability uses average sentence length", () => {
  const short = scoreContent("Satu dua tiga. Empat lima enam.", { language: "id" });
  assert.strictEqual(short.raw.avgSentenceLength, 3);
  assert.strictEqual(short.metrics.find((m) => m.key === "readability").score, 100);
  // one 30-word sentence: (35 - 30) / (35 - 20) = 33%
  const long = scoreContent(Array(30).fill("kata").join(" ") + ".", { language: "id" });
  assert.strictEqual(long.raw.avgSentenceLength, 30);
  assert.strictEqual(long.metrics.find((m) => m.key === "readability").score, 33);
});

// --- demo samples ---
check("pickSample returns the sample written for each default keyword", () => {
  for (const a of SAMPLE_ARTICLES) {
    const { article, exact } = pickSample(`  ${a.keyword.toUpperCase()} `);
    assert.strictEqual(exact, true, a.keyword);
    assert.strictEqual(article.keyword, a.keyword);
  }
  const other = pickSample("resep nasi goreng");
  assert.strictEqual(other.exact, false);
  assert.ok(SAMPLE_ARTICLES.includes(other.article));
});

check("each sample scores >= B on default settings (id, 800 words)", () => {
  for (const a of SAMPLE_ARTICLES) {
    const r = scoreContent(a.body, { keyword: a.keyword, targetWords: 800, meta: a.meta, language: a.language });
    assert.ok(r.overall >= 70, `${a.keyword}: ${r.overall} ${r.grade}`);
  }
});

// --- rate limiter ---
check("rate limiter blocks after max, per key, and resets after the window", () => {
  let t = 0;
  const limit = createRateLimiter(2, 1000, () => t);
  assert.strictEqual(limit("a").ok, true);
  assert.strictEqual(limit("a").ok, true);
  const blocked = limit("a");
  assert.strictEqual(blocked.ok, false);
  assert.strictEqual(blocked.retryAfterSec, 1);
  assert.strictEqual(limit("b").ok, true, "other keys are independent");
  t = 1000;
  assert.strictEqual(limit("a").ok, true, "window reset");
});

check("readPositiveInt falls back on invalid env values", () => {
  assert.strictEqual(readPositiveInt("25", 40), 25);
  for (const bad of [undefined, "", "0", "-3", "2.5", "abc"]) {
    assert.strictEqual(readPositiveInt(bad, 40), 40, String(bad));
  }
});

console.log(`\n${pass} checks passed.`);
