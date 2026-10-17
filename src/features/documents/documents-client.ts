import { apiFetch, errorMessageFromBody, readResponseBody } from "@/shared/api/api-fetch";
import type { StrategyDocSummary } from "./catalog";

export type StoredDocument = StrategyDocSummary & {
  updatedAt?: string;
  markdown?: string;
};

type ListResponse = {
  docs?: StoredDocument[];
};

async function readDocs(response: Response, fallback: string): Promise<StoredDocument[]> {
  const body = await readResponseBody(response);
  if (!response.ok) {
    throw new Error(errorMessageFromBody(body, fallback));
  }
  const docs = (body as ListResponse | null)?.docs;
  return Array.isArray(docs) ? docs : [];
}

export async function fetchDocuments(): Promise<StoredDocument[]> {
  const response = await apiFetch("/documents");
  return readDocs(response, "Could not load documents");
}

export async function fetchDocument(filename: string): Promise<StoredDocument> {
  const response = await apiFetch(`/documents?filename=${encodeURIComponent(filename)}`);
  const body = await readResponseBody(response);
  if (!response.ok) {
    throw new Error(errorMessageFromBody(body, "Could not load document"));
  }
  return body as StoredDocument;
}

export async function uploadDocuments(
  files: { filename: string; markdown: string }[],
): Promise<StoredDocument[]> {
  const response = await apiFetch("/documents", {
    method: "POST",
    body: JSON.stringify({ files }),
  });
  return readDocs(response, "Could not upload documents");
}
