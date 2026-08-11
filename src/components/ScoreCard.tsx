"use client";

import type { SeoReport } from "@/lib/seo-scorer";

function gradeColor(grade: SeoReport["grade"]): string {
  switch (grade) {
    case "A":
      return "bg-emerald-500";
    case "B":
      return "bg-lime-500";
    case "C":
      return "bg-amber-500";
    case "D":
      return "bg-orange-500";
    default:
      return "bg-red-500";
  }
}

function barColor(score: number): string {
  if (score >= 75) return "bg-emerald-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
}

export default function ScoreCard({ report }: { report: SeoReport }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white ${gradeColor(
            report.grade
          )}`}
          aria-label={`Grade ${report.grade}`}
        >
          {report.grade}
        </div>
        <div>
          <div className="text-2xl font-bold leading-none">{report.overall}</div>
          <div className="text-xs text-slate-500">Skor SEO / 100</div>
        </div>
      </div>

      <ul className="mt-4 space-y-3">
        {report.metrics.map((m) => (
          <li key={m.key}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-slate-700">{m.label}</span>
              <span className="tabular-nums text-slate-500">{m.value}</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${barColor(m.score)}`}
                style={{ width: `${m.score}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-400">{m.hint}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
