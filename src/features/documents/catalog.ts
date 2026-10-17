export type DocKind = "index" | "element" | "strategy" | "reference";

export type StrategyDocSummary = {
  slug: string;
  filename: string;
  title: string;
  kind: DocKind;
};

export type StrategyPic = {
  file: string;
  filename: string;
  label: string;
  timeframe: string;
};

export type DocumentsCatalog = {
  baseDir: string;
  docs: StrategyDocSummary[];
  picsBySlug: Record<string, StrategyPic[]>;
};

const STRATEGY_PIC_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);

const TIMEFRAME_SORT: Record<string, number> = {
  Dia: 0,
  Hora: 1,
  "15 min": 2,
  Chart: 3,
};

export function strategyDocShortSlug(filename: string): string {
  const base = filename.replace(/\.md$/i, "");
  const match = /^estrategia-\d+/.exec(base);
  return match?.[0] ?? base;
}

export function docKind(filename: string): DocKind {
  if (filename === "estrategias-indice.md") return "index";
  if (filename.startsWith("elementos-analisis-")) return "element";
  if (/^estrategia-\d+/.test(filename)) return "strategy";
  return "reference";
}

export function isStrategyMarkdownFile(name: string): boolean {
  return name.toLowerCase().endsWith(".md") && !name.toLowerCase().startsWith("strategy-");
}

export function extractTitle(markdown: string, fallback: string): string {
  const match = /^#\s+(.+)$/m.exec(markdown);
  return match?.[1]?.trim() || fallback;
}

export function docNavLabel(doc: StrategyDocSummary): string {
  if (doc.kind === "index") return "Index";
  if (doc.kind === "strategy") {
    const match = /^estrategia-(\d+)/.exec(doc.slug);
    if (match) return String(Number.parseInt(match[1], 10));
  }
  if (doc.filename.includes("temporalidades")) return "Temporalidades";
  if (doc.filename.includes("bollinger")) return "Bollinger";
  if (doc.filename.includes("checklist")) return "Pre-market";
  if (doc.filename.includes("misc")) return "Misc";
  return doc.title;
}

export function sortDocs(docs: StrategyDocSummary[]): StrategyDocSummary[] {
  const rank = (doc: StrategyDocSummary) =>
    doc.kind === "index" ? 0 : doc.kind === "element" ? 1 : doc.kind === "strategy" ? 2 : 3;
  return [...docs].sort((a, b) => rank(a) - rank(b) || a.slug.localeCompare(b.slug));
}

export function documentPath(slug: string): string {
  return `/documents/${slug}`;
}

export function rewriteAssetUrls(markdown: string): string {
  return markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_full, alt: string, src: string) => {
    const trimmed = src.trim();
    if (/^https?:\/\//i.test(trimmed)) return `![${alt}](${trimmed})`;
    const relative = trimmed.replace(/^\.\//, "").replace(/\\/g, "/");
    return `![${alt}](/strategy-docs/raw/${relative})`;
  });
}

const TOPIC_LABELS: Record<string, string> = {
  rebote: "Rebote punto medio",
  cambiot: "Cambio de Tendencia Bolinger H",
  iman: "Efecto iman",
  "lateral-salto": "Lateral + salto apertura",
  lateral: "Lateral + salto",
};

export function parseStrategyPicMeta(
  filename: string,
  prefix: string,
): Pick<StrategyPic, "label" | "timeframe"> {
  const stem = filename.slice(prefix.length).replace(/\.[^.]+$/i, "");
  const lower = stem.toLowerCase();

  let timeframe = "Chart";
  if (/(^|-)15m($|-)/.test(lower)) timeframe = "15 min";
  else if (/(^|-)1h($|-)/.test(lower)) timeframe = "Hora";
  else if (/(^|-)d($|-)/.test(lower) || lower.includes("-d-")) timeframe = "Dia";

  const topic = lower
    .replace(/^(alza|baja)-/, "")
    .replace(/(^|-)(15m|1h|d)($|-)/g, "-")
    .replace(/^-|-$/g, "");

  let label = TOPIC_LABELS[topic];
  if (!label) {
    label = topic
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
  if (!label.trim()) {
    label = stem
      .split("-")
      .filter((part) => !/^(alza|baja)$/i.test(part))
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  return { label: label || "Grafico", timeframe };
}

export function isStrategyPicFile(name: string): boolean {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return false;
  return STRATEGY_PIC_EXTENSIONS.has(name.slice(dot).toLowerCase());
}

export function sortPics(items: StrategyPic[]): StrategyPic[] {
  return [...items].sort((a, b) => {
    const ta = TIMEFRAME_SORT[a.timeframe] ?? 9;
    const tb = TIMEFRAME_SORT[b.timeframe] ?? 9;
    if (ta !== tb) return ta - tb;
    return a.filename.localeCompare(b.filename);
  });
}

export function picsForSlug(slug: string, filenames: string[]): StrategyPic[] {
  const match = /^estrategia-(\d+)$/.exec(slug.trim().toLowerCase());
  if (!match) return [];
  const prefix = `${match[1].padStart(2, "0")}-`;
  const items: StrategyPic[] = [];
  for (const name of filenames) {
    if (!name.startsWith(prefix) || !isStrategyPicFile(name)) continue;
    const meta = parseStrategyPicMeta(name, prefix);
    items.push({
      file: `pics/${name}`,
      filename: name,
      label: meta.label,
      timeframe: meta.timeframe,
    });
  }
  return sortPics(items);
}
