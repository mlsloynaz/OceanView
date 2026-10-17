import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/shared/auth/AuthProvider";
import { cn } from "@/shared/lib/cn";
import {
  docNavLabel,
  documentPath,
  rewriteAssetUrls,
  type DocumentsCatalog,
  type StrategyDocSummary,
  type StrategyPic,
} from "./catalog";
import { fetchDocument, fetchDocuments, uploadDocuments, type StoredDocument } from "./documents-client";
import { MarkdownDocument } from "./MarkdownDocument";

async function loadLocalCatalog(): Promise<DocumentsCatalog | null> {
  try {
    const response = await fetch("/strategy-docs/catalog.json");
    if (!response.ok) return null;
    return (await response.json()) as DocumentsCatalog;
  } catch {
    return null;
  }
}

async function readLocalMarkdown(filename: string): Promise<string> {
  const response = await fetch(`/strategy-docs/raw/${encodeURIComponent(filename)}`);
  if (!response.ok) throw new Error(`Could not read ${filename}`);
  return response.text();
}

function findDoc(docs: StrategyDocSummary[], slug: string | undefined): StrategyDocSummary | null {
  if (slug) return docs.find((doc) => doc.slug === slug) ?? null;
  return docs.find((doc) => doc.kind === "index") ?? docs[0] ?? null;
}

function navClass(active: boolean) {
  return cn(
    "rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors",
    active
      ? "border-ocean-teal bg-ocean-teal text-ocean-deep"
      : "border-ocean-mid/70 bg-ocean-surface text-ocean-foam hover:border-ocean-teal/60",
  );
}

function DocNav({ docs, current }: { docs: StrategyDocSummary[]; current: StrategyDocSummary | null }) {
  const groups: { label: string; items: StrategyDocSummary[] }[] = [
    { label: "Reference", items: docs.filter((doc) => doc.kind === "index" || doc.kind === "element" || doc.kind === "reference") },
    { label: "Strategies", items: docs.filter((doc) => doc.kind === "strategy") },
  ];

  return (
    <div className="space-y-3">
      {groups.map((group) =>
        group.items.length === 0 ? null : (
          <div key={group.label} className="flex flex-wrap items-center gap-2">
            <span className="w-24 text-xs font-semibold uppercase tracking-wide text-ocean-sand/80">
              {group.label}
            </span>
            {group.items.map((doc) => {
              const active = current?.slug === doc.slug;
              const to = doc.kind === "index" ? "/documents" : documentPath(doc.slug);
              return (
                <Link key={doc.slug} to={to} title={doc.title} className={navClass(active)}>
                  {docNavLabel(doc)}
                </Link>
              );
            })}
          </div>
        ),
      )}
    </div>
  );
}

function Pics({ pics }: { pics: StrategyPic[] }) {
  if (pics.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {pics.map((pic) => (
        <figure key={pic.filename} className="overflow-hidden rounded-lg border border-ocean-mid/70 bg-ocean-surface">
          <img
            src={`/strategy-docs/raw/${pic.file}`}
            alt={pic.label}
            className="h-auto w-full"
          />
          <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-ocean-sand">
            <span>{pic.label}</span>
            <span className="font-semibold text-ocean-foam">{pic.timeframe}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function UploadBar({
  localCount,
  busy,
  onFiles,
  onImportLocal,
}: {
  localCount: number;
  busy: boolean;
  onFiles: (files: FileList | null) => void;
  onImportLocal: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".md,text/markdown"
        multiple
        className="hidden"
        onChange={(event) => {
          onFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="rounded-md bg-ocean-teal px-3 py-1.5 text-sm font-semibold text-ocean-deep disabled:opacity-60"
      >
        {busy ? "Uploading…" : "Upload markdown"}
      </button>
      {localCount > 0 ? (
        <button
          type="button"
          disabled={busy}
          onClick={onImportLocal}
          className="rounded-md border border-ocean-mid/70 px-3 py-1.5 text-sm font-semibold text-ocean-foam disabled:opacity-60"
        >
          Upload {localCount} files from this computer
        </button>
      ) : null}
    </div>
  );
}

export function DocumentsPage() {
  const { slug } = useParams<{ slug?: string }>();
  const { isAdmin } = useAuth();
  const [docs, setDocs] = useState<StoredDocument[] | null>(null);
  const [picsBySlug, setPicsBySlug] = useState<Record<string, StrategyPic[]>>({});
  const [localCount, setLocalCount] = useState(0);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchDocuments()
      .then((next) => {
        if (!cancelled) setDocs(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load documents");
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  useEffect(() => {
    let cancelled = false;
    loadLocalCatalog().then((catalog) => {
      if (cancelled || !catalog) return;
      setPicsBySlug(catalog.picsBySlug ?? {});
      setLocalCount(catalog.docs?.length ?? 0);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const current = docs ? findDoc(docs, slug) : null;
  const currentFilename = current?.filename ?? null;

  useEffect(() => {
    if (!docs) return;
    if (!currentFilename) {
      setMarkdown(null);
      return;
    }
    let cancelled = false;
    setMarkdown(null);
    fetchDocument(currentFilename)
      .then((document) => {
        if (!cancelled) setMarkdown(document.markdown ?? "");
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load document");
      });
    return () => {
      cancelled = true;
    };
  }, [docs, currentFilename]);

  async function saveFiles(files: { filename: string; markdown: string }[]) {
    if (files.length === 0) {
      setError("Choose one or more .md files.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await uploadDocuments(files);
      setNotice(`Saved ${files.length} file${files.length === 1 ? "" : "s"}.`);
      setTick((value) => value + 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not upload documents");
    } finally {
      setBusy(false);
    }
  }

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    const files: { filename: string; markdown: string }[] = [];
    for (const file of list) {
      if (!file.name.toLowerCase().endsWith(".md")) continue;
      files.push({ filename: file.name, markdown: await file.text() });
    }
    await saveFiles(files);
  }

  async function onImportLocal() {
    setBusy(true);
    setError(null);
    try {
      const catalog = await loadLocalCatalog();
      if (!catalog?.docs.length) {
        setError("No markdown files were found on this computer.");
        setBusy(false);
        return;
      }
      const files = await Promise.all(
        catalog.docs.map(async (doc) => ({
          filename: doc.filename,
          markdown: await readLocalMarkdown(doc.filename),
        })),
      );
      setBusy(false);
      await saveFiles(files);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not read the local files");
      setBusy(false);
    }
  }

  const pics = current ? (picsBySlug[current.slug] ?? []) : [];
  const missingSlug = Boolean(docs && slug && !current);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <header className="space-y-3">
        <h1 className="font-display text-3xl font-semibold text-ocean-foam sm:text-4xl">Documents</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-ocean-sand">
          Strategy notes are saved in OceanView. Upload the markdown once and open it from any computer.
          Uploading the same filename replaces the saved copy.
        </p>
        {isAdmin ? (
          <UploadBar localCount={localCount} busy={busy} onFiles={onFiles} onImportLocal={onImportLocal} />
        ) : null}
      </header>

      {error ? <p className="text-sm text-ocean-danger">{error}</p> : null}
      {notice ? <p className="text-sm text-ocean-teal-dim">{notice}</p> : null}

      {docs && docs.length === 0 ? (
        <div className="rounded-lg border border-ocean-mid/70 bg-ocean-surface p-5 text-sm text-ocean-sand">
          No documents uploaded yet.
        </div>
      ) : null}

      {docs && docs.length > 0 ? <DocNav docs={docs} current={current} /> : null}

      {missingSlug ? (
        <p className="text-sm text-ocean-sand">
          No document matches <code>{slug}</code>.
        </p>
      ) : null}

      {current ? (
        <p className="text-xs text-ocean-sand">
          File: <code className="rounded bg-ocean-surface px-1">{current.filename}</code>
        </p>
      ) : null}

      <Pics pics={pics} />

      {markdown != null ? <MarkdownDocument source={rewriteAssetUrls(markdown)} /> : null}
      {current && markdown == null && !error ? (
        <p className="text-sm text-ocean-sand">Loading document…</p>
      ) : null}
    </div>
  );
}
