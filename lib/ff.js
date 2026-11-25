// FFmpeg (wasm): tarayıcının açamadığı videolar için yedek çözücü (ör. iPhone HEVC .mov).
// Yalnızca gerektiğinde yüklenir (~31 MB, sonra tarayıcı önbelleğinde kalır).

let ff = null, loading = null, logs = [], mounted = null;

export async function getFF(onStatus) {
  if (ff) return ff;
  loading ??= (async () => {
    const { FFmpeg } = await import("../vendor/ffmpeg/index.js");
    const f = new FFmpeg();
    f.on("log", ({ message }) => { logs.push(message); if (logs.length > 400) logs.shift(); });
    onStatus?.("Video çözücü yükleniyor… (yalnızca ilk seferde, 31 MB)");
    const base = new URL("../vendor/ffmpeg-core/", import.meta.url).href;
    await f.load({ coreURL: base + "ffmpeg-core.js", wasmURL: base + "ffmpeg-core.wasm" });
    ff = f;
    return f;
  })();
  try { return await loading; } catch (e) { loading = null; throw new Error("Video çözücü yüklenemedi. İnternet bağlantını kontrol et."); }
}

/** Dosyayı FFmpeg'e tanıtır; yolunu döner. Kopyalamadan bağlamayı dener. */
async function input(f, file) {
  if (mounted?.file === file) return mounted.path;
  if (mounted) {
    try { mounted.mount ? await f.unmount("/in") : await f.deleteFile(mounted.path); } catch (e) {}
    mounted = null;
  }
  const safe = "girdi" + ((file.name.match(/\.[A-Za-z0-9]{1,5}$/) || [".mp4"])[0]).toLowerCase();
  try {
    try { await f.createDir("/in"); } catch (e) {}
    const ok = await f.mount("WORKERFS", { blobs: [{ name: safe, data: file }] }, "/in");
    if (!ok) throw new Error("bağlanamadı");
    mounted = { file, path: "/in/" + safe, mount: true };
  } catch (e) {
    await f.writeFile("/" + safe, new Uint8Array(await file.arrayBuffer()));
    mounted = { file, path: "/" + safe, mount: false };
  }
  return mounted.path;
}

const toSec = (h, m, s) => +h * 3600 + +m * 60 + parseFloat(s);

/** FFmpeg komutunu çalıştırır; çıktı dosyasını Blob olarak döner. */
export async function run(file, argsFn, outName, mime, { total, onProgress, onStatus } = {}) {
  const f = await getFF(onStatus);
  const inPath = await input(f, file);
  logs = [];
  const prog = ({ message }) => {
    const m = /time=(\d+):(\d+):([\d.]+)/.exec(message);
    if (m && total) onProgress?.(Math.min(1, toSec(m[1], m[2], m[3]) / total));
  };
  f.on("log", prog);
  let code;
  try { code = await f.exec(argsFn(inPath)); } finally { f.off("log", prog); }
  let data = null;
  try { data = await f.readFile(outName); await f.deleteFile(outName); } catch (e) {}
  if (code !== 0 || !data || !data.length) {
    const all = logs.join("\n");
    if (/does not contain any stream|matches no streams|Output file is empty/i.test(all)) throw new Error("Bu videoda ses yok.");
    throw new Error("Video işlenemedi. Dosya bozuk ya da desteklenmeyen bir biçimde olabilir.");
  }
  return new Blob([data.buffer], { type: mime });
}

/** Süreyi (saniye) öğrenir */
export async function probe(file, onStatus) {
  const f = await getFF(onStatus);
  const inPath = await input(f, file);
  logs = [];
  await f.exec(["-hide_banner", "-i", inPath]);
  const all = logs.join("\n");
  const d = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(all);
  return { duration: d ? toSec(d[1], d[2], d[3]) : 0, hasAudio: /Stream #.*Audio:/.test(all), hasVideo: /Stream #.*Video:/.test(all) };
}
