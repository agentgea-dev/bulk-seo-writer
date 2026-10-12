"use client";

import { useEffect, useRef, useState } from "react";
import type { Article } from "@/lib/types";
import { LENGTH_WORDS } from "@/lib/types";
import ArticleCard, { slugify } from "./ArticleCard";

type Status = "pending" | "generating" | "done" | "error" | "cancelled";

interface QueueItem {
  id: string;
  keyword: string;
  status: Status;
  /** length target at generation time, so later setting changes don't rescore */
  targetWords: number;
  article?: Article;
  mode?: "llm" | "demo";
  note?: string;
  error?: string;
}

const SAMPLE_KEYWORDS =
  "cara memulai bisnis dropship\ntips seo untuk website baru\nmanfaat kopi hitam tanpa gula";

export default function BatchWriter() {
  const [raw, setRaw] = useState(SAMPLE_KEYWORDS);
  const [tone, setTone] = useState("informatif");
  const [length, setLength] = useState<"pendek" | "sedang" | "panjang">("sedang");
  const [language, setLanguage] = useState<"id" | "en">("id");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const [serverMode, setServerMode] = useState<"llm" | "demo" | "unknown">("unknown");
  const cancelRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const demo = serverMode === "demo";

  useEffect(() => {
    fetch("/api/generate")
      .then((r) => r.json())
      .then((d) => setServerMode(d.mode === "llm" ? "llm" : "demo"))
      .catch(() => setServerMode("unknown"));
  }, []);

  const parseKeywords = (): string[] =>
    raw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);

  const run = async () => {
    const keywords = parseKeywords();
    if (keywords.length === 0) return;
    cancelRef.current = false;
    setRunning(true);
    const targetWords = LENGTH_WORDS[length];
    const items: QueueItem[] = keywords.map((k, i) => ({
      id: `${Date.now()}-${i}`,
      keyword: k,
      status: "pending",
      targetWords,
    }));
    setQueue(items);
    const update = (i: number, patch: Partial<QueueItem>) =>
      setQueue((q) => q.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

    for (let i = 0; i < items.length; i++) {
      if (cancelRef.current) break;
      update(i, { status: "generating" });
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keyword: items[i].keyword,
            config: { tone, length, language },
          }),
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        if (!res.ok || data.error) {
          // Rate-limited: every remaining request would be rejected too.
          if (res.status === 429) cancelRef.current = true;
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        update(i, { status: "done", article: data.article, mode: data.mode, note: data.note });
      } catch (err) {
        if (controller.signal.aborted) {
          update(i, { status: "cancelled" });
          break;
        }
        const msg = err instanceof Error ? err.message : "gagal";
        update(i, { status: "error", error: msg });
      }
    }
    abortRef.current = null;
    setQueue((q) =>
      q.map((it) => (it.status === "pending" ? { ...it, status: "cancelled" } : it))
    );
    setRunning(false);
  };

  const stop = () => {
    cancelRef.current = true;
    abortRef.current?.abort();
  };

  const downloadZip = async () => {
    const done = queue.filter((q) => q.status === "done" && q.article);
    if (done.length === 0) return;
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    const used = new Set<string>();
    for (const it of done) {
      const a = it.article!;
      let name = slugify(a.keyword);
      let n = name;
      let c = 2;
      while (used.has(n)) n = `${name}-${c++}`;
      used.add(n);
      zip.file(
        `${n}.md`,
        `<!-- meta description: ${a.meta} -->\n\n${a.body}\n`
      );
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url;
    el.download = "artikel-seo.zip";
    el.click();
    URL.revokeObjectURL(url);
  };

  const doneCount = queue.filter((q) => q.status === "done").length;

  return (
    <div>
      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_220px]">
        <div>
          <label className="block text-xs font-medium text-slate-500">
            Daftar keyword (satu per baris, maks 20)
          </label>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={5}
            className="mt-1 w-full rounded-md border border-slate-300 p-3 text-sm"
            placeholder="keyword satu&#10;keyword dua&#10;keyword tiga"
          />
          <p className="mt-1 text-xs text-slate-400">
            {parseKeywords().length} keyword siap.
          </p>
        </div>
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-slate-500">Nada</label>
            <select
              value={tone}
              disabled={demo}
              onChange={(e) => setTone(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100 disabled:text-slate-400"
            >
              <option value="informatif">Informatif</option>
              <option value="profesional">Profesional</option>
              <option value="santai">Santai</option>
              <option value="persuasif">Persuasif</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Panjang</label>
            <select
              value={length}
              disabled={demo}
              onChange={(e) => setLength(e.target.value as any)}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100 disabled:text-slate-400"
            >
              <option value="pendek">Pendek (~400)</option>
              <option value="sedang">Sedang (~800)</option>
              <option value="panjang">Panjang (~1400)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Bahasa</label>
            <select
              value={language}
              disabled={demo}
              onChange={(e) => setLanguage(e.target.value as any)}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100 disabled:text-slate-400"
            >
              <option value="id">Indonesia</option>
              <option value="en">English</option>
            </select>
          </div>
          {demo && (
            <p className="text-xs text-slate-400">
              Nada, panjang, dan bahasa hanya berlaku di mode LLM. Artikel
              contoh ditulis dalam bahasa Indonesia, panjang sedang.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!running ? (
          <button
            onClick={run}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Generate Batch
          </button>
        ) : (
          <button
            onClick={stop}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Stop
          </button>
        )}
        <button
          onClick={downloadZip}
          disabled={doneCount === 0}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          Unduh semua .zip ({doneCount})
        </button>
        {serverMode !== "unknown" && (
          <span
            className={`rounded px-2 py-1 text-xs font-medium ${
              serverMode === "llm"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            server: {serverMode === "llm" ? "LLM aktif (API key terpasang)" : "demo mode (tanpa API key)"}
          </span>
        )}
      </div>

      {queue.length > 0 && (
        <div className="mt-6 space-y-4">
          {queue.map((it) => (
            <div key={it.id}>
              {it.status === "done" && it.article ? (
                <ArticleCard
                  article={it.article}
                  mode={it.mode || "demo"}
                  note={it.note}
                  targetWords={it.targetWords}
                />
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
                  <StatusDot status={it.status} />
                  <span className="font-medium">{it.keyword}</span>
                  <span className="text-slate-400">
                    {it.status === "pending" && "menunggu…"}
                    {it.status === "generating" && "sedang menulis…"}
                    {it.status === "error" && `error: ${it.error}`}
                    {it.status === "cancelled" && "dibatalkan"}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: Status }) {
  const map: Record<Status, string> = {
    pending: "bg-slate-300",
    generating: "bg-amber-400 animate-pulse",
    done: "bg-emerald-500",
    error: "bg-red-500",
    cancelled: "bg-slate-200",
  };
  return <span className={`h-2.5 w-2.5 rounded-full ${map[status]}`} />;
}
