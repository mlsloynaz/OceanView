import { Link } from "react-router-dom";
import { strategyDocShortSlug } from "./catalog";

type Block =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "hr" }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "blockquote"; lines: string[] }
  | { type: "code"; text: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "img"; alt: string; src: string };

function docHref(href: string): string | null {
  const cleaned = href.trim().replace(/^\.\//, "");
  const file = cleaned.split("/").pop() ?? "";
  if (!file.toLowerCase().endsWith(".md")) return null;
  return `/documents/${strategyDocShortSlug(file)}`;
}

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={index} className="font-semibold text-ocean-foam">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={index} className="rounded bg-ocean-deep px-1 font-mono text-[0.85em]">
              {part.slice(1, -1)}
            </code>
          );
        }
        const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
        if (link) {
          const label = link[1];
          const href = link[2].trim();
          const internal = docHref(href);
          if (internal) {
            return (
              <Link key={index} to={internal} className="text-ocean-teal hover:underline">
                {label}
              </Link>
            );
          }
          return (
            <a
              key={index}
              href={href}
              className="text-ocean-teal hover:underline"
              target={/^https?:\/\//i.test(href) ? "_blank" : undefined}
              rel={/^https?:\/\//i.test(href) ? "noreferrer" : undefined}
            >
              {label}
            </a>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

function parseImageLine(line: string): { alt: string; src: string } | null {
  const match = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(line.trim());
  if (!match) return null;
  return { alt: match[1], src: match[2].trim() };
}

function parseTableRow(line: string): string[] {
  return line
    .split("|")
    .map((cell) => cell.trim())
    .filter((cell, index, arr) => !(index === 0 && cell === "") && !(index === arr.length - 1 && cell === ""));
}

function isTableSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("-") && !trimmed.includes(":")) return false;
  return /^\|?(?:\s*:?\s*-+\s*:?\s*\|)+\s*:?\s*-+\s*:?\s*\|?$/.test(trimmed);
}

function isTableStart(lines: string[], index: number): boolean {
  return (
    lines[index]?.includes("|") === true &&
    index + 1 < lines.length &&
    isTableSeparatorLine(lines[index + 1] ?? "")
  );
}

function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line.trim() === "") {
      index++;
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push({ type: "h1", text: line.slice(2).trim() });
      index++;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ type: "h2", text: line.slice(3).trim() });
      index++;
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push({ type: "h3", text: line.slice(4).trim() });
      index++;
      continue;
    }
    if (line.trim() === "---") {
      blocks.push({ type: "hr" });
      index++;
      continue;
    }
    const image = parseImageLine(line);
    if (image) {
      blocks.push({ type: "img", alt: image.alt, src: image.src });
      index++;
      continue;
    }
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      index++;
      while (index < lines.length && !(lines[index] ?? "").startsWith("```")) {
        codeLines.push(lines[index] ?? "");
        index++;
      }
      blocks.push({ type: "code", text: codeLines.join("\n") });
      index++;
      continue;
    }
    if (line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (index < lines.length && (lines[index] ?? "").startsWith(">")) {
        quoteLines.push((lines[index] ?? "").replace(/^>\s?/, ""));
        index++;
      }
      blocks.push({ type: "blockquote", lines: quoteLines });
      continue;
    }
    if (isTableStart(lines, index)) {
      const headers = parseTableRow(line);
      index += 2;
      const rows: string[][] = [];
      while (
        index < lines.length &&
        (lines[index] ?? "").includes("|") &&
        !isTableSeparatorLine(lines[index] ?? "")
      ) {
        rows.push(parseTableRow(lines[index] ?? ""));
        index++;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (index < lines.length && (lines[index] ?? "").startsWith("- ")) {
        items.push((lines[index] ?? "").slice(2).trim());
        index++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(/^\d+\.\s+/, "").trim());
        index++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    const paragraphLines: string[] = [line.trim()];
    index++;
    while (
      index < lines.length &&
      (lines[index] ?? "").trim() !== "" &&
      !(lines[index] ?? "").startsWith("#") &&
      !(lines[index] ?? "").startsWith("- ") &&
      !/^\d+\.\s+/.test(lines[index] ?? "") &&
      !(lines[index] ?? "").startsWith(">") &&
      !(lines[index] ?? "").startsWith("```") &&
      !parseImageLine(lines[index] ?? "") &&
      (lines[index] ?? "").trim() !== "---" &&
      !isTableStart(lines, index)
    ) {
      paragraphLines.push((lines[index] ?? "").trim());
      index++;
    }
    blocks.push({ type: "p", text: paragraphLines.join(" ") });
  }

  return blocks;
}

export function MarkdownDocument({ source }: { source: string }) {
  const blocks = parseMarkdown(source);
  return (
    <article className="space-y-4 rounded-lg border border-ocean-mid/70 bg-ocean-surface p-5 text-sm leading-relaxed text-ocean-sand sm:p-6">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "h1":
            return (
              <h1 key={index} className="font-display text-2xl font-semibold text-ocean-foam">
                <InlineText text={block.text} />
              </h1>
            );
          case "h2":
            return (
              <h2
                key={index}
                className="border-t border-ocean-mid/50 pt-3 font-display text-xl font-semibold text-ocean-foam"
              >
                <InlineText text={block.text} />
              </h2>
            );
          case "h3":
            return (
              <h3 key={index} className="text-base font-semibold text-ocean-foam">
                <InlineText text={block.text} />
              </h3>
            );
          case "p":
            return (
              <p key={index}>
                <InlineText text={block.text} />
              </p>
            );
          case "hr":
            return <hr key={index} className="border-ocean-mid/60" />;
          case "ul":
            return (
              <ul key={index} className="list-disc space-y-1 pl-5">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <InlineText text={item} />
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={index} className="list-decimal space-y-1 pl-5">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <InlineText text={item} />
                  </li>
                ))}
              </ol>
            );
          case "blockquote":
            return (
              <blockquote
                key={index}
                className="space-y-1 border-l-4 border-ocean-teal/70 bg-ocean-deep px-4 py-2"
              >
                {block.lines.map((line, lineIndex) => (
                  <p key={lineIndex}>
                    <InlineText text={line} />
                  </p>
                ))}
              </blockquote>
            );
          case "code":
            return (
              <pre
                key={index}
                className="overflow-x-auto rounded-md bg-ocean-deep p-3 font-mono text-xs text-ocean-foam"
              >
                <code>{block.text}</code>
              </pre>
            );
          case "table":
            return (
              <div key={index} className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-ocean-mid/70">
                      {block.headers.map((header, headerIndex) => (
                        <th key={headerIndex} className="px-2 py-2 font-semibold text-ocean-foam">
                          <InlineText text={header} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b border-ocean-mid/40">
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-2 py-2 align-top">
                            <InlineText text={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "img":
            return (
              <figure key={index} className="my-2">
                <img
                  src={block.src}
                  alt={block.alt}
                  className="h-auto max-w-full rounded border border-ocean-mid/60"
                />
                {block.alt ? <figcaption className="mt-2 text-xs">{block.alt}</figcaption> : null}
              </figure>
            );
          default:
            return null;
        }
      })}
    </article>
  );
}
