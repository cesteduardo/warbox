#!/usr/bin/env node
/* =====================================================================
   WARBOX.TV — gerador estático (zero dependências)

   src/layout.html        moldura comum (head, header, footer, scripts)
   src/partials/*.html    blocos reutilizáveis  →  {{> nome}}
   src/pages/*.html       uma página por arquivo, com front-matter:

       ---
       title: Planos
       description: Texto para buscadores
       nav: planos
       ---
       <section>…</section>

   Saída em dist/: index.html → /, planos.html → /planos/ (URL limpa).
   Para criar uma página nova basta adicionar um arquivo em src/pages.
   ===================================================================== */
import { readFile, writeFile, readdir, mkdir, rm, cp, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, dirname, basename, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, "src");
const PUBLIC = join(ROOT, "public");
// node build.mjs           → dist/          (hospedagem, URLs limpas)
// node build.mjs --local   → dist-local/    (abre com duplo clique no index.html)
const LOCAL = process.argv.includes("--local");
const DIST = join(ROOT, LOCAL ? "dist-local" : "dist");
const SITE_URL = "https://warbox.tv";

const read = (p) => readFile(p, "utf8");

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

function frontMatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: raw };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) data[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { data, body: raw.slice(m[0].length) };
}

function include(html, partials, depth = 0) {
  if (depth > 10) throw new Error("Includes aninhados demais (loop?)");
  return html.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => {
    if (!(name in partials)) throw new Error(`Partial não encontrado: ${name}`);
    return include(partials[name], partials, depth + 1);
  });
}

// troca caminhos absolutos ("/planos/", "/assets/x.webp") por relativos e
// aponta pastas para o index.html, para funcionar abrindo direto do disco
function relativize(html, depth) {
  const up = "../".repeat(depth);
  return html.replace(/(href|src)="\/(?!\/)([^"]*)"/g, (_, attr, rest) => {
    const [path, hash = ""] = rest.split("#");
    let p = path.split("?")[0] === "" || path.endsWith("/") ? `${path}index.html` : path;
    if (path.includes("?")) p = path;
    return `${attr}="${up}${p}${hash ? "#" + hash : ""}"`;
  });
}

const escapeAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

async function main() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  await cp(PUBLIC, DIST, { recursive: true });

  // hash curto dos arquivos estáticos principais para quebrar cache a cada deploy
  const versions = {};
  for (const f of ["css/styles.css", "js/main.js"]) {
    versions[f] = createHash("sha1").update(await readFile(join(PUBLIC, f))).digest("hex").slice(0, 8);
  }

  const partials = {};
  for (const f of await walk(join(SRC, "partials"))) {
    if (extname(f) === ".html") partials[basename(f, ".html")] = await read(f);
  }
  const layout = await read(join(SRC, "layout.html"));

  const pages = (await walk(join(SRC, "pages"))).filter((f) => extname(f) === ".html");
  const urls = [];

  for (const file of pages) {
    const slug = relative(join(SRC, "pages"), file).replace(/\\/g, "/").replace(/\.html$/, "");
    const { data, body } = frontMatter(await read(file));
    const path = slug === "index" ? "/" : slug === "404" ? "/404.html" : `/${slug.replace(/\/index$/, "")}/`;

    const vars = {
      title: data.title ? `${data.title}` : "Warbox TV",
      description: data.description || "",
      nav: data.nav || slug,
      bodyClass: data.bodyClass || "",
      canonical: SITE_URL + path,
      ...Object.fromEntries(Object.entries(versions).map(([k, v]) => [`v:${k}`, v])),
    };

    let html = include(layout.replace("{{content}}", () => body), partials);
    html = html.replace(/\{\{\s*([\w:./-]+)\s*\}\}/g, (all, key) => (key in vars ? escapeAttr(vars[key]) : all));
    // item ativo do menu
    html = html.replace(new RegExp(`data-nav="${vars.nav}"`, "g"), `data-nav="${vars.nav}" aria-current="page"`);

    const leftovers = html.match(/\{\{[^}]*\}\}/g);
    if (leftovers) throw new Error(`${slug}: marcações não resolvidas ${[...new Set(leftovers)].join(", ")}`);

    // fontes pré-carregadas falham em file:// (CORS); o CSS já as carrega
    if (LOCAL) html = html.replace(/\s*<link rel="preload"[^>]*>/g, "");
    if (LOCAL) html = relativize(html, slug === "index" || slug === "404" ? 0 : slug.split("/").length);

    const out = slug === "index" || slug === "404" ? join(DIST, `${slug}.html`) : join(DIST, slug, "index.html");
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, html);
    if (slug !== "404" && data.sitemap !== "no") urls.push(SITE_URL + path);
    console.log(`  ${path.padEnd(18)} ← src/pages/${slug}.html`);
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${u}</loc></url>`)
    .join("\n")}\n</urlset>\n`;
  await writeFile(join(DIST, "sitemap.xml"), sitemap);
  await writeFile(join(DIST, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);

  const size = (await stat(join(DIST, "css/styles.css"))).size + (await stat(join(DIST, "js/main.js"))).size;
  console.log(`\n✓ ${pages.length} páginas geradas em ${relative(ROOT, DIST)}/ (CSS+JS: ${(size / 1024).toFixed(1)} KB sem gzip)`);
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
