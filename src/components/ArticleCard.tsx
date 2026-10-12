"use client";

import { useMemo, useState } from "react";
import type { Article } from "@/lib/types";
import { scoreContent } from "@/lib/seo-scorer";
import ScoreCard from "./ScoreCard";
import Markdown from "./Markdown";

function toMarkdownFile(a: Article): string {
  return `<!-- meta description: ${a.meta} -->\n\n${a.body}\n`;
}

export default function ArticleCard({
  article,
  mode,
  note,
  targetWords,
}: {
  article: Article;
  mode: "llm" | "demo";
  note?: string;
  targetWords: number;
}) {
  const [copied, setCopied] = useState(false);
  const report = useMemo(
    () =>
      scoreContent(article.body, {
        keyword: article.keyword,
        targetWords,
        meta: article.meta,
        language: article.language ?? "id",
      }),
    [article, targetWords]
  );

  const copy = async () => {
    await navigator.clipboard.writeText(toMarkdownFile(article));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadMd = () => {
    const blob = new Blob([toMarkdownFile(article)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(article.keyword)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_260px]">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {article.keyword}
          </span>
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              mode === "llm"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {mode === "llm" ? "LLM mode" : "demo mode (artikel contoh)"}
          </span>
        </div>
        {note && <p className="mb-2 text-xs text-amber-700">{note}</p>}
        <h3 className="text-lg font-bold">{article.title}</h3>
        <p className="mt-1 text-sm italic text-slate-500">{article.meta}</p>
        <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
          <Markdown md={article.body} />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={copy}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
          >
            {copied ? "Tersalin ✓" : "Salin Markdown"}
          </button>
          <button
            onClick={downloadMd}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
          >
            Unduh .md
          </button>
        </div>
      </div>
      <ScoreCard report={report} />
    </div>
  );
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "artikel";
}
