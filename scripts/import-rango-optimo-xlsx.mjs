/**
 * Convert rango_precios_opciones_YYYY-MM-DD.xlsx → data/rango-optimo.json
 *
 * Usage:
 *   npm run import:rango-optimo -- "C:\path\to\rango_precios_opciones_2026-05-20.xlsx"
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import { parseWorkbookRows } from "./lib/rango-optimo-parse.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const defaultOut = join(repoRoot, "data", "rango-optimo.json");

const inputPath = resolve(process.argv[2] ?? "");
const outPath = resolve(process.argv[3] ?? defaultOut);

if (!inputPath) {
  console.error("Usage: npm run import:rango-optimo -- <path-to.xlsx> [output.json]");
  process.exit(1);
}

const buffer = readFileSync(inputPath);
const filename = inputPath.split(/[\\/]/).pop() ?? inputPath;
const workbook = XLSX.read(buffer, { type: "buffer" });
const sheetName = workbook.SheetNames[0];
if (!sheetName) {
  console.error("Workbook has no sheets");
  process.exit(1);
}

const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
const { entries, analysisDate } = parseWorkbookRows(rawRows, filename);

if (entries.length === 0) {
  console.error("No rows parsed. Expected columns: TICKER, RANGO ÓPTIMO, MÍNIMO Y MÁXIMO, Nombre");
  process.exit(1);
}

const payload = { analysisDate, entries };

writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log(`Wrote ${entries.length} tickers → ${outPath}`);
console.log(`Analysis date: ${analysisDate}`);
console.log(`Symbols: ${entries.map((e) => e.symbol).join(", ")}`);
