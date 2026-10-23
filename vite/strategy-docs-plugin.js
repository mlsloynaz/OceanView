import fs from "node:fs";
import path from "node:path";
import { docKind, extractTitle, isStrategyMarkdownFile, isStrategyPicFile, picsForSlug, sortDocs, strategyDocShortSlug, } from "../src/features/documents/catalog.ts";
const DEFAULT_DIR = "C:\\dta\\strategies";
function readText(filePath) {
    const bytes = fs.readFileSync(filePath);
    const utf8 = bytes.toString("utf8");
    if (!utf8.includes("\uFFFD"))
        return utf8;
    return new TextDecoder("windows-1252").decode(bytes);
}
function contentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".md")
        return "text/plain; charset=utf-8";
    if (ext === ".png")
        return "image/png";
    if (ext === ".jpg" || ext === ".jpeg")
        return "image/jpeg";
    if (ext === ".gif")
        return "image/gif";
    if (ext === ".webp")
        return "image/webp";
    if (ext === ".svg")
        return "image/svg+xml";
    if (ext === ".json")
        return "application/json; charset=utf-8";
    return "application/octet-stream";
}
function safeFile(baseDir, relativePath) {
    const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!normalized || normalized.split("/").includes(".."))
        return null;
    const root = path.resolve(baseDir);
    const full = path.resolve(root, normalized);
    const rel = path.relative(root, full);
    if (rel.startsWith("..") || path.isAbsolute(rel))
        return null;
    if (!fs.existsSync(full) || !fs.statSync(full).isFile())
        return null;
    return full;
}
export function buildDocumentsCatalog(baseDir) {
    const root = path.resolve(baseDir);
    if (!fs.existsSync(root)) {
        return { baseDir: root, docs: [], picsBySlug: {} };
    }
    const docs = [];
    for (const name of fs.readdirSync(root)) {
        if (!isStrategyMarkdownFile(name))
            continue;
        const full = path.join(root, name);
        if (!fs.statSync(full).isFile())
            continue;
        let markdown = "";
        try {
            markdown = readText(full);
        }
        catch {
            continue;
        }
        const slug = strategyDocShortSlug(name);
        docs.push({
            slug,
            filename: name,
            title: extractTitle(markdown, slug),
            kind: docKind(name),
        });
    }
    const picsDir = path.join(root, "pics");
    let picNames = [];
    if (fs.existsSync(picsDir)) {
        picNames = fs.readdirSync(picsDir).filter((name) => {
            const full = path.join(picsDir, name);
            return isStrategyPicFile(name) && fs.statSync(full).isFile();
        });
    }
    const picsBySlug = {};
    for (const doc of docs) {
        if (doc.kind !== "strategy")
            continue;
        const pics = picsForSlug(doc.slug, picNames);
        if (pics.length)
            picsBySlug[doc.slug] = pics;
    }
    return { baseDir: root, docs: sortDocs(docs), picsBySlug };
}
function sendJson(res, body) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.end(JSON.stringify(body));
}
function sendFile(res, filePath) {
    res.statusCode = 200;
    res.setHeader("Content-Type", contentType(filePath));
    res.setHeader("Cache-Control", "no-cache");
    fs.createReadStream(filePath).pipe(res);
}
function handleRequest(baseDir, req, res, next) {
    const rel = decodeURIComponent((req.url ?? "/").split("?")[0] || "/");
    if (rel === "/" || rel === "/catalog.json") {
        sendJson(res, buildDocumentsCatalog(baseDir));
        return;
    }
    if (!rel.startsWith("/raw/")) {
        next();
        return;
    }
    const file = safeFile(baseDir, rel.slice("/raw/".length));
    if (!file) {
        res.statusCode = 404;
        res.end("Not found");
        return;
    }
    sendFile(res, file);
}
function copyRawTree(baseDir, outDir) {
    const rawDir = path.join(outDir, "raw");
    fs.mkdirSync(rawDir, { recursive: true });
    if (!fs.existsSync(baseDir))
        return;
    for (const name of fs.readdirSync(baseDir)) {
        const src = path.join(baseDir, name);
        if (!fs.statSync(src).isFile() || !name.toLowerCase().endsWith(".md"))
            continue;
        fs.copyFileSync(src, path.join(rawDir, name));
    }
    const picsDir = path.join(baseDir, "pics");
    if (!fs.existsSync(picsDir))
        return;
    const outPics = path.join(rawDir, "pics");
    fs.mkdirSync(outPics, { recursive: true });
    for (const name of fs.readdirSync(picsDir)) {
        const src = path.join(picsDir, name);
        if (!fs.statSync(src).isFile() || !isStrategyPicFile(name))
            continue;
        fs.copyFileSync(src, path.join(outPics, name));
    }
}
export function strategyDocsPlugin(options) {
    const baseDir = path.resolve((options.dir || "").trim() || DEFAULT_DIR);
    return {
        name: "oceanview-strategy-docs",
        configureServer(server) {
            server.middlewares.use("/strategy-docs", (req, res, next) => {
                handleRequest(baseDir, req, res, next);
            });
        },
        writeBundle() {
            const outDir = path.resolve(options.rootDir, "dist/strategy-docs");
            fs.mkdirSync(outDir, { recursive: true });
            const catalog = buildDocumentsCatalog(baseDir);
            fs.writeFileSync(path.join(outDir, "catalog.json"), JSON.stringify(catalog));
            copyRawTree(baseDir, outDir);
        },
    };
}
