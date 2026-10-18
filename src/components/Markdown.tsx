"use client";

import type { ReactNode } from "react";

/**
 * Minimal, dependency-free markdown renderer for article preview.
 * Handles headings, paragraphs, ordered/unordered lists, and inline bold,
 * italic, code, and links — enough for our generated articles. Not a full
 * markdown engine (documented in README).
 */
export default function Markdown({ md }: { md: string }) {
  const lines = md.split(/\r?\n/);
  const blocks: JSX.Element[] = [];
  let list: string[] = [];
  let listType: "ul" | "ol" = "ul";
  let key = 0;

  const flushList = () => {
    if (list.length === 0) return;
    const items = list.map((item, i) => <li key={i}>{renderInline(item)}</li>);
    blocks.push(
      listType === "ol" ? <ol key={`ol-${key++}`}>{items}</ol> : <ul key={`ul-${key++}`}>{items}</ul>
    );
    list = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim() === "") {
      flushList();
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushList();
      const level = h[1].length;
      const text = renderInline(h[2]);
      if (level === 1) blocks.push(<h1 key={key++}>{text}</h1>);
      else if (level === 2) blocks.push(<h2 key={key++}>{text}</h2>);
      else blocks.push(<h3 key={key++}>{text}</h3>);
      continue;
    }
    const li = line.match(/^\s*(?:([-*+])|\d+[.)])\s+(.*)$/);
    if (li) {
      const type = li[1] ? "ul" : "ol";
      if (list.length > 0 && type !== listType) flushList();
      listType = type;
      list.push(li[2]);
      continue;
    }
    flushList();
    blocks.push(<p key={key++}>{renderInline(line)}</p>);
  }
  flushList();

  return <div className="prose-md">{blocks}</div>;
}

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*)/g;

/** Inline bold, italic, code, and links. Links only for safe URL schemes. */
function renderInline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <code key={i}>{part.slice(1, -1)}</code>;
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) {
      const [, label, href] = link;
      if (!/^(https?:\/\/|mailto:|\/|#)/i.test(href)) return label;
      return (
        <a key={i} href={href} target="_blank" rel="noopener noreferrer">
          {label}
        </a>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}
