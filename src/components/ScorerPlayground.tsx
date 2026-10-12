"use client";

import { useMemo, useState } from "react";
import { scoreContent, type ScoreLanguage } from "@/lib/seo-scorer";
import ScoreCard from "./ScoreCard";

const DEFAULT_TEXT = `# Panduan Singkat Menulis Meta Description

Meta description yang baik membuat orang mengklik hasil pencarian Anda.

## Kenapa Penting

Meta description muncul di bawah judul pada hasil Google. Ia meringkas isi halaman.

## Tips Cepat

Tulis 120-160 karakter, sisipkan keyword utama, dan buat ajakan yang jelas.`;

export default function ScorerPlayground() {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [keyword, setKeyword] = useState("meta description");
  const [meta, setMeta] = useState(
    "Pelajari cara menulis meta description yang menarik: panjang ideal, penempatan keyword, dan ajakan klik untuk hasil pencarian Google."
  );

  const [language, setLanguage] = useState<ScoreLanguage>("id");
  const [targetRaw, setTargetRaw] = useState("300");
  const targetWords = Number(targetRaw) > 0 ? Number(targetRaw) : 300;

  const report = useMemo(
    () => scoreContent(text, { keyword, targetWords, meta, language }),
    [text, keyword, meta, language, targetWords]
  );

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_260px]">
      <div>
        <label className="block text-xs font-medium text-slate-500">
          Target keyword
        </label>
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500">
              Bahasa teks
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as ScoreLanguage)}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="id">Indonesia (panjang kalimat)</option>
              <option value="en">English (Flesch)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">
              Target kata
            </label>
            <input
              type="number"
              min={50}
              step={50}
              value={targetRaw}
              onChange={(e) => setTargetRaw(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
        </div>
        <label className="mt-3 block text-xs font-medium text-slate-500">
          Meta description
        </label>
        <input
          value={meta}
          onChange={(e) => setMeta(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
        <label className="mt-3 block text-xs font-medium text-slate-500">
          Teks / artikel (Markdown) — skor berubah real-time
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          className="mt-1 w-full rounded-md border border-slate-300 p-3 font-mono text-xs"
        />
        <p className="mt-1 text-xs text-slate-400">
          Tempel teks Anda sendiri — scorer 100% deterministik, jalan tanpa API key.
        </p>
      </div>
      <ScoreCard report={report} />
    </div>
  );
}
