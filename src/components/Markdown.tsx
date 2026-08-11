"use client";

/**
 * Minimal, dependency-free markdown renderer for article preview.
 * Handles headings, paragraphs, and unordered lists — enough for our
 * generated articles. Not a full markdown engine (documented in README).
 */
export default function Markdown({ md }: { md: string }) {
  const lines = md.split(/\r?\n/);
  const blocks: JSX.Element[] = [];
  let list: string[] = [];
  let key = 0;

  const flushList = () => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={`ul-${key++}`}>
        {list.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
    list = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim() === "") {
      flushList();
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flushList();
      const level = h[1].length;
      const text = h[2];
      if (level === 1) blocks.push(<h1 key={key++}>{text}</h1>);
      else if (level === 2) blocks.push(<h2 key={key++}>{text}</h2>);
      else blocks.push(<h3 key={key++}>{text}</h3>);
      continue;
    }
    const li = line.match(/^\s*[-*+]\s+(.*)$/);
    if (li) {
      list.push(li[1]);
      continue;
    }
    flushList();
    blocks.push(<p key={key++}>{line}</p>);
  }
  flushList();

  return <div className="prose-md">{blocks}</div>;
}
