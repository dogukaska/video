// FFmpeg (wasm): tarayıcının açamadığı videolar için yedek çözücü (ör. iPhone HEVC .mov).
// Yalnızca gerektiğinde yüklenir (~31 MB, sonra tarayıcı önbelleğinde kalır).

let ff = null, loading = null, logs = [], mounted = null;
let idle = Promise.resolve();

function enqueue(work) {
  const job = idle.then(work);
  idle = job.catch(() => {});
  return job;
}

export async function getFF(onStatus) {
  if (ff) return ff;
  loading ??= createFF(onStatus, ({ message }) => {
    logs.push(message);
    if (logs.length > 400) logs.shift();
  }).then((instance) => { ff = instance; return instance; });
  try { return await loading; } catch (error) { loading = null; throw error; }
}

export async function createFF(onStatus, onLog, signal) {
  let instance;
  const dispose = () => instance?.terminate();
  try {
    signal?.throwIfAborted();
    onStatus?.("Video çözücü yükleniyor… (ilk kullanımda yaklaşık 31 MB)");
    const { FFmpeg } = await import("../vendor/ffmpeg/index.js");
    signal?.throwIfAborted();
    instance = new FFmpeg();
    if (onLog) instance.on("log", onLog);
    signal?.addEventListener("abort", dispose, { once: true });
    const base = new URL("../vendor/ffmpeg-core/", import.meta.url).href;
    await instance.load({ coreURL: base + "ffmpeg-core.js", wasmURL: base + "ffmpeg-core.wasm" });
    return instance;
  } catch {
    signal?.removeEventListener("abort", dispose);
    dispose();
    throw new Error("Video çözücü yüklenemedi. İnternet bağlantını kontrol et.");
  }
}

export async function mountVideo(instance, file) {
  const filename = "girdi" + (file.name.match(/\.[A-Za-z0-9]{1,5}$/)?.[0] ?? ".mp4").toLowerCase();
  try {
    try { await instance.createDir("/in"); } catch { /* Klasör varsa yeniden kullan. */ }
    const ok = await instance.mount("WORKERFS", { blobs: [{ name: filename, data: file }] }, "/in");
    if (!ok) throw new Error("Dosya bağlanamadı.");
    return { file, path: "/in/" + filename, mount: true };
  } catch {
    await instance.writeFile("/" + filename, new Uint8Array(await file.arrayBuffer()));
    return { file, path: "/" + filename, mount: false };
  }
}

/** Dosyayı FFmpeg'e tanıtır; yolunu döner. Kopyalamadan bağlamayı dener. */
async function input(f, file) {
  if (mounted?.file === file) return mounted.path;
  if (mounted) {
    try { mounted.mount ? await f.unmount("/in") : await f.deleteFile(mounted.path); } catch (e) {}
    mounted = null;
  }
  mounted = await mountVideo(f, file);
  return mounted.path;
}

const toSec = (h, m, s) => +h * 3600 + +m * 60 + parseFloat(s);

/** FFmpeg komutunu çalıştırır; çıktı dosyasını Blob olarak döner. */
export function run(file, argsFn, outName, mime, options) {
  return enqueue(() => runJob(file, argsFn, outName, mime, options));
}

async function runJob(file, argsFn, outName, mime, { total, onProgress, onStatus } = {}) {
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
  return new Blob([data], { type: mime });
}

/** Süreyi (saniye) öğrenir */
export function probe(file, onStatus) {
  return enqueue(() => probeJob(file, onStatus));
}

async function probeJob(file, onStatus) {
  const f = await getFF(onStatus);
  const inPath = await input(f, file);
  logs = [];
  await f.exec(["-hide_banner", "-i", inPath]);
  const all = logs.join("\n");
  const d = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(all);
  return { duration: d ? toSec(d[1], d[2], d[3]) : 0, hasAudio: /Stream #.*Audio:/.test(all), hasVideo: /Stream #.*Video:/.test(all) };
}
