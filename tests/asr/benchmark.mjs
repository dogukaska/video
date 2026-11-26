import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { errorRates, measure } from "./metrics.mjs";

const folder = dirname(fileURLToPath(import.meta.url));
const root = resolve(folder, "../..");
const reportOnly = process.argv.includes("--report-only");
const dataset = JSON.parse(await readFile(join(folder, "dataset.json"), "utf8"));
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".wasm": "application/wasm",
};

async function serve(req, res) {
  const pathname = new URL(req.url, "http://127.0.0.1").pathname;
  // Ana katalogda bulunan ortak CSS ve simge bu depoda yer almaz.
  if (pathname === "/tool.css" || pathname === "/icons/dijital-caki.svg" || pathname === "/favicon.ico") {
    res.writeHead(204).end();
    return;
  }
  const appAsset = ["/video/ses-yaziya/", "/video/vendor/", "/video/lib/"].some(prefix => pathname.startsWith(prefix));
  const relative = pathname === "/theme.js" ? "theme.js" : appAsset ? pathname.slice(7) : "";
  const file = resolve(root, relative.endsWith("/") ? relative + "index.html" : relative);
  if (!file.startsWith(root + sep)) { res.writeHead(404).end(); return; }

  const entry = await stat(file);
  if (!entry.isFile()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream", "Content-Length": entry.size });
  const data = createReadStream(file);
  data.on("error", () => res.destroy());
  data.pipe(res);
}

const server = createServer((req, res) => {
  serve(req, res).catch(() => { if (res.headersSent) res.destroy(); else res.writeHead(404).end(); });
});
await new Promise((done, fail) => {
  server.once("error", fail);
  server.listen(0, "127.0.0.1", done);
});
const origin = `http://127.0.0.1:${server.address().port}`;
const percentage = value => `${(value * 100).toFixed(2)}%`;
let browser;

try {
  browser = await chromium.launch({
    executablePath: process.env.ASR_CHROMIUM_PATH || undefined,
  });
  const context = await browser.newContext({ serviceWorkers: "block" });
  await context.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(origin + "/video/ses-yaziya/");

  const measurements = [];
  for (const clip of dataset.clips) {
    await page.locator("#file").setInputFiles(join(folder, "fixtures", clip.file));
    await page.locator("#run").click();
    await page.locator("#cancel").waitFor({ state: "hidden", timeout: 120_000 });
    const status = await page.locator("#status").textContent();
    const recognized = await page.locator("#output").isVisible();
    if (!recognized && status !== "Kayıtta anlaşılır konuşma bulunamadı.") {
      throw new Error(`${clip.file} işlenemedi. ${status}`);
    }
    const text = recognized ? await page.locator("#transcript").inputValue() : "";
    const counts = measure(clip.reference, text);
    measurements.push(counts);
    const { wer, cer } = errorRates([counts]);
    console.log(`${clip.file}  WER ${percentage(wer)}  CER ${percentage(cer)}`);
    console.log(`  Referans  ${clip.reference}\n  Çıktı     ${text || "—"}`);
  }
  if (errors.length) throw new Error(errors.join("\n"));

  const { wer, cer } = errorRates(measurements);
  console.log(`\nToplam (${dataset.clips.length} kayıt)  WER ${percentage(wer)}  CER ${percentage(cer)}`);
  if (!reportOnly) {
    const baseline = JSON.parse(await readFile(join(folder, "baseline.json"), "utf8"));
    if (wer > baseline.wer + baseline.tolerance.wer || cer > baseline.cer + baseline.tolerance.cer) {
      throw new Error(`Hata oranı kabul edilen sınırı aştı. WER ≤ ${percentage(baseline.wer + baseline.tolerance.wer)}, CER ≤ ${percentage(baseline.cer + baseline.tolerance.cer)}.`);
    }
  }
} finally {
  try { await browser?.close(); }
  finally { await new Promise(done => server.close(done)); }
}
