#!/usr/bin/env node
/* Servidor local para conferir dist/ com URLs limpas (/planos → /planos/index.html). */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = join(fileURLToPath(new URL(".", import.meta.url)), "dist");
const PORT = Number(process.env.PORT) || 4321;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".woff2": "font/woff2",
  ".xml": "application/xml", ".txt": "text/plain; charset=utf-8", ".ico": "image/x-icon",
};

async function resolve(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  for (const candidate of [clean, join(clean, "index.html"), clean + ".html"]) {
    const p = join(DIST, candidate);
    if (!p.startsWith(DIST)) return null;
    try { if ((await stat(p)).isFile()) return p; } catch { /* tenta o próximo */ }
  }
  return null;
}

createServer(async (req, res) => {
  const file = await resolve(req.url);
  const target = file || join(DIST, "404.html");
  res.writeHead(file ? 200 : 404, { "Content-Type": TYPES[extname(target)] || "application/octet-stream" });
  res.end(await readFile(target));
}).listen(PORT, () => console.log(`Warbox TV em http://localhost:${PORT}`));
