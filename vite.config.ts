import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(rootDir, "data");

function dataDirPlugin(): Plugin {
  return {
    name: "oceanview-data-dir",
    configureServer(server) {
      server.middlewares.use("/data", (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? "/").split("?")[0]!);
        const filePath = path.resolve(dataDir, `.${rel}`);

        if (!filePath.startsWith(dataDir)) {
          res.statusCode = 403;
          res.end("Forbidden");
          return;
        }

        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          next();
          return;
        }

        res.setHeader("Content-Type", "application/json; charset=utf-8");
        fs.createReadStream(filePath).pipe(res);
      });
    },
    writeBundle() {
      const outDir = path.resolve(rootDir, "dist/data");
      if (!fs.existsSync(dataDir)) return;

      fs.mkdirSync(outDir, { recursive: true });
      for (const name of fs.readdirSync(dataDir)) {
        const src = path.join(dataDir, name);
        if (fs.statSync(src).isFile()) {
          fs.copyFileSync(src, path.join(outDir, name));
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), dataDirPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },
});
