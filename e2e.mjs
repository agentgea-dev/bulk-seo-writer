/**
 * e2e verification for the SEO scorer — checks computed metrics against
 * hand-counted expected values. Run: node e2e.mjs
 *
 * This is the gate: the scorer must match manual counts, not just "render".
 * Uses tsx-free plain import via a tiny transpile shim: we import the compiled
 * logic by re-implementing nothing — instead we exercise the TS through the
 * Next build's node runtime by importing the source with a loader.
 *
 * To keep it dependency-free, we duplicate NO logic: we spawn `npx tsx` if
 * available, else fall back to a JS mirror check. Simpler: we import via a
 * dynamic data: URL after stripping types is overkill — so this file imports
 * the built module through ts at runtime using Node's --experimental loaders
 * is fragile. Instead we test the pure functions by importing a compiled copy.
 */
import assert from "node:assert";
import { execSync } from "node:child_process";

// Transpile the scorer to plain JS on the fly with esbuild (bundled via next).
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Compile the scorer TS -> ESM JS with the local TypeScript compiler, then import it.
let mod;
{
  const dir = mkdtempSync(join(tmpdir(), "seo-"));
  const tsIn = join(dir, "seo-scorer.ts");
  const src = readFileSync(new URL("./src/lib/seo-scorer.ts", import.meta.url), "utf8");
  writeFileSync(tsIn, src);
  execSync(
    `node_modules/.bin/tsc "${tsIn}" --target ES2020 --module esnext --moduleResolution bundler --outDir "${dir}" --skipLibCheck`,
    { cwd: new URL(".", import.meta.url).pathname, stdio: "inherit" }
  );
  const outJs = join(dir, "seo-scorer.js");
  // rename to .mjs so Node treats it as ESM regardless of package type
  const mjs = join(dir, "seo-scorer.mjs");
  writeFileSync(mjs, readFileSync(outJs, "utf8"));
  mod = await import(`file://${mjs}`);
}

const {
  tokenizeWords,
  countKeyword,
  countHeadings,
  splitSentences,
  countSyllables,
  fleschReadingEase,
  scoreContent,
} = mod;

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

console.log(`\n${pass} checks passed.`);
